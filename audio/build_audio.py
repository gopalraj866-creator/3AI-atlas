#!/usr/bin/env python3
"""Build narration, subtitles (SRT/VTT/JSON cues), score and the mastered audio for one format (long | short).

  python3 audio/build_audio.py --format long --out build/audio [--engine auto|edge|espeak|estimate]
"""
import argparse, json, os, re, subprocess, sys, textwrap
import numpy as np
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(__file__))
import tts, synth  # noqa

SR = 48000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def ts(sec, comma=True):
    ms = int(round(sec * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d}{"," if comma else "."}{ms:03d}'

def ffrun(args):
    r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + args, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)

def load_wav(p):
    sr, x = wavfile.read(p); assert sr == SR, sr
    x = x.astype(np.float32); return x if x.ndim == 1 else x.mean(1)

def word_times(line, words, pron, d_clip, stretch):
    """Return [(word, start, end)] relative to clip start for each *display* word."""
    disp = line.split(); n = len(disp)
    if words:
        tokens = [max(1, len(tts.spoken(w, pron).split())) for w in disp]
        if sum(tokens) == len(words):
            out = []; k = 0
            for w, tk in zip(disp, tokens):
                a = words[k]; b = words[k + tk - 1]; out.append((w, a[0] / stretch, (b[0] + b[1]) / stretch)); k += tk
            return out
    # proportional fallback (weights by length + punctuation pauses)
    wts = [len(w) + (4 if re.search(r'[,.;:?!]$', w) else 0) for w in disp]; tot = sum(wts); out = []; c = 0
    for w, g in zip(disp, wts):
        out.append((w, d_clip * c / tot, d_clip * (c + g - (2 if g > 6 else 0)) / tot)); c += g
    return out

def chunk_cues(wt, max_chars):
    cues = []; cur = [];
    for w in wt:
        trial = ' '.join(x[0] for x in cur + [w])
        if cur and len(trial) > max_chars: cues.append(cur); cur = [w]
        else: cur.append(w)
        if re.search(r'[.?!]$', w[0]) and len(' '.join(x[0] for x in cur)) > max_chars * 0.55: cues.append(cur); cur = []
    if cur: cues.append(cur)
    return [{'start': c[0][1], 'end': c[-1][2], 'text': ' '.join(x[0] for x in c)} for c in cues]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--format', required=True, choices=['long', 'short']); ap.add_argument('--out', default='build/audio')
    ap.add_argument('--engine', default='auto'); ap.add_argument('--voice'); ap.add_argument('--rate'); ap.add_argument('--no-master', action='store_true')
    ap.add_argument('--max-blocks', type=int, default=0, help='debug: only first N blocks')
    a = ap.parse_args()
    script = json.load(open(os.path.join(ROOT, 'content/script.json'), encoding='utf-8'))
    fmt = script['formats'][a.format]; meta = script['meta']
    cfg = {'voice': a.voice or meta['voice'], 'rate': a.rate or meta['rate'], 'pitch': meta['pitch'], 'pron': script['pronounce']}
    engine = tts.pick_engine(a.engine); print(f'[audio] format={a.format} engine={engine} voice={cfg["voice"]}')
    out = os.path.join(ROOT, a.out) if not os.path.isabs(a.out) else a.out; os.makedirs(out, exist_ok=True); cache = os.path.join(out, 'cache')

    blocks = fmt['blocks'][: a.max_blocks or None]; cursor = 0.0; plan = []
    for b in blocks:
        d = b['t1'] - b['t0']; plan.append({**b, 'start': cursor, 'end': cursor + d, 'dur': d}); cursor += d
    total = cursor; lead = 0.5 if a.format == 'long' else 0.15; tail = 0.4
    narr = np.zeros(int(total * SR) + SR, np.float32); cues = []; transcript = []; warnings = []; used = set()
    for b in plan:
        clips = []
        for line in b['lines']:
            wav, words, eng = tts.synth_line(line, cache, cfg, engine); used.add(eng); clips.append([line, wav, words, tts.dur_of(wav), 1.0])
        n = len(clips); avail = b['dur'] - lead - tail; gap0 = 0.45 if a.format == 'long' else 0.3
        total_d = sum(c[3] for c in clips) + gap0 * (n - 1)
        if total_d > avail:
            f = min(1.3, total_d / avail)
            for c in clips:
                p2 = c[1].replace('.wav', f'_t{int(f * 1000)}.wav')
                if not os.path.exists(p2): ffrun(['-i', c[1], '-af', f'atempo={f:.4f}', '-c:a', 'pcm_f32le', p2])
                c[1] = p2; c[3] = tts.dur_of(p2); c[4] = f
            total_d = sum(c[3] for c in clips) + gap0 * (n - 1)
            if total_d > avail + 0.05: warnings.append(f'{b["id"]}: narration {total_d:.1f}s exceeds slot {avail:.1f}s'); gap0 = 0.15
        gap = gap0 + (min((avail - total_d) / max(n - 1, 1), 1.1) if (total_d < avail and n > 1) else 0)
        t = b['start'] + lead
        for line, wav, words, d, f in clips:
            x = load_wav(wav); i0 = int(t * SR); narr[i0:i0 + len(x)] += x[: len(narr) - i0]
            wt = [(w, t + s, t + e) for w, s, e in word_times(line, words, cfg['pron'], d, f)]
            cues += chunk_cues(wt, fmt['captionChars'] * (2 if a.format == 'long' else 1))
            transcript.append(f'[{ts(t, False)}] {line}'); t += d + gap
    # tidy caption timing
    for i, c in enumerate(cues):
        nxt = cues[i + 1]['start'] if i + 1 < len(cues) else total
        c['end'] = max(c['start'] + 0.35, min(c['end'] + 0.12, nxt - 0.02, total)); c['start'] = round(c['start'], 3); c['end'] = round(c['end'], 3)
    for w in warnings: print('::warning::' + w)
    json.dump(cues, open(os.path.join(out, f'cues.{a.format}.json'), 'w'), ensure_ascii=False)
    wrap = lambda s: '\n'.join(textwrap.wrap(s, fmt['captionChars'] * (1 if a.format == 'long' else 1) + (2 if a.format == 'long' else 0))[:3])
    with open(os.path.join(out, f'captions.{a.format}.srt'), 'w', encoding='utf-8') as f:
        for i, c in enumerate(cues, 1): f.write(f'{i}\n{ts(c["start"])} --> {ts(c["end"])}\n{wrap(c["text"])}\n\n')
    with open(os.path.join(out, f'captions.{a.format}.vtt'), 'w', encoding='utf-8') as f:
        f.write('WEBVTT\n\n')
        for c in cues: f.write(f'{ts(c["start"], False)} --> {ts(c["end"], False)}\n{wrap(c["text"])}\n\n')
    open(os.path.join(out, f'transcript.{a.format}.txt'), 'w', encoding='utf-8').write('\n'.join(transcript) + '\n')
    json.dump({'blocks': [{k: b[k] for k in ('id', 'scene', 't0', 't1', 'start', 'end', 'mood')} for b in plan], 'total': total, 'engine': sorted(used)}, open(os.path.join(out, f'timeline.{a.format}.json'), 'w'))

    # ---- voice processing ----
    vraw = os.path.join(out, f'voice_raw.{a.format}.wav'); vproc = os.path.join(out, f'voice.{a.format}.wav')
    n_tot = int(total * SR); narr = narr[:n_tot]; wavfile.write(vraw, SR, narr)
    ffrun(['-i', vraw, '-af', 'highpass=f=70,equalizer=f=190:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2.5,equalizer=f=9000:t=q:w=1:g=1.5,deesser=i=0.35,'
           'acompressor=threshold=-22dB:ratio=3:attack=6:release=140:makeup=5dB,alimiter=limit=0.9', '-c:a', 'pcm_f32le', vproc])
    voice = load_wav(vproc)[:n_tot]
    if len(voice) < n_tot: voice = np.pad(voice, (0, n_tot - len(voice)))
    vrev = synth.reverb(voice, 0.55, 0.07, np.random.RandomState(5), damp=5000)  # stereo with a touch of room

    # ---- music + ducking ----
    print('[audio] composing score ...'); mus = synth.build_music([{'start': b['start'], 'end': b['end'], 'mood': b['mood']} for b in plan], total, seed=11)
    from scipy.signal import lfilter
    env = lfilter([1 - np.exp(-1 / (0.02 * SR))], [1, -np.exp(-1 / (0.02 * SR))], np.abs(voice)); env = lfilter([1 - np.exp(-1 / (0.35 * SR))], [1, -np.exp(-1 / (0.35 * SR))], np.maximum(env, 0))
    duck = 1.0 - 0.58 * np.clip(env / 0.05, 0, 1); mus = mus * duck[:, None].astype(np.float32)
    mix = vrev * 1.0 + mus
    wavfile.write(os.path.join(out, f'premaster.{a.format}.wav'), SR, mix.astype(np.float32))
    wavfile.write(os.path.join(out, f'music.{a.format}.wav'), SR, mus.astype(np.float32))
    if a.no_master: return

    # ---- loudness mastering: two-pass loudnorm to -14 LUFS / -1.5 dBTP (YouTube reference) ----
    pre = os.path.join(out, f'premaster.{a.format}.wav'); tgt = 'I=-14:TP=-1.5:LRA=9'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', pre, '-af', f'loudnorm={tgt}:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S).group(0))
    ln = f'loudnorm={tgt}:measured_I={m["input_i"]}:measured_TP={m["input_tp"]}:measured_LRA={m["input_lra"]}:measured_thresh={m["input_thresh"]}:offset={m["target_offset"]}:linear=true'
    master = os.path.join(out, f'master.{a.format}.wav')
    ffrun(['-i', pre, '-af', ln + ',alimiter=limit=0.84:level=false', '-ar', '48000', '-c:a', 'pcm_s24le', master])
    ffrun(['-i', master, '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', os.path.join(out, f'master.{a.format}.m4a')])
    chk = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', master, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    summ = chk[chk.rfind('Summary:'):]
    open(os.path.join(out, f'loudness.{a.format}.txt'), 'w').write(summ); print(summ)
    print(f'[audio] done {a.format}: {total:.1f}s, {len(cues)} caption cues, engine={sorted(used)}')

if __name__ == '__main__': main()
