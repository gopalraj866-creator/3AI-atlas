"""Text-to-speech engines. edge (Microsoft neural voices, best quality) -> espeak-ng (fallback) -> estimate (silent timing only)."""
import asyncio, hashlib, os, re, shutil, subprocess, sys
import numpy as np

SR = 48000

def spoken(text, pron):
    for k in sorted(pron, key=len, reverse=True): text = text.replace(k, pron[k])
    return text

def _ff(args):
    r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error'] + args, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)

def to_wav(src, dst, tempo=1.0):
    af = [] if abs(tempo - 1) < 1e-3 else ['-af', f'atempo={tempo:.5f}']
    _ff(['-i', src] + af + ['-ar', str(SR), '-ac', '1', '-c:a', 'pcm_f32le', dst])

def dur_of(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    return float(out)

async def _edge(text, voice, rate, pitch, out):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary='WordBoundary')
    words = []
    with open(out, 'wb') as f:
        async for ch in comm.stream():
            if ch['type'] == 'audio': f.write(ch['data'])
            elif ch['type'] == 'WordBoundary': words.append((ch['offset'] / 1e7, ch['duration'] / 1e7, ch['text']))
    if os.path.getsize(out) < 2000: raise RuntimeError('edge-tts returned no audio')
    return words

def synth_line(text, cache, cfg, engine):
    """Return (wav_path, words|None, engine_used). cfg: voice, rate, pitch, pron."""
    os.makedirs(cache, exist_ok=True); sp = spoken(text, cfg['pron'])
    key = hashlib.sha1(f"{engine}|{cfg['voice']}|{cfg['rate']}|{cfg['pitch']}|{sp}".encode()).hexdigest()[:16]
    wav = os.path.join(cache, key + '.wav'); meta = os.path.join(cache, key + '.words')
    if os.path.exists(wav):
        words = None
        if os.path.exists(meta):
            words = [(float(a), float(b), c) for a, b, c in (l.rstrip('\n').split('\t') for l in open(meta, encoding='utf-8'))]
        return wav, words, engine
    if engine == 'edge':
        mp3 = os.path.join(cache, key + '.mp3'); last = None
        for attempt in range(4):
            try:
                words = asyncio.run(_edge(sp, cfg['voice'], cfg['rate'], cfg['pitch'], mp3)); break
            except Exception as e:
                last = e; print(f'  edge-tts retry {attempt + 1}: {e}', file=sys.stderr); import time; time.sleep(2 + attempt * 3)
        else: raise RuntimeError(f'edge-tts failed: {last}')
        to_wav(mp3, wav)
        with open(meta, 'w', encoding='utf-8') as f:
            for a, b, c in words: f.write(f'{a}\t{b}\t{c}\n')
        return wav, words, 'edge'
    if engine == 'espeak':
        exe = shutil.which('espeak-ng') or shutil.which('espeak')
        if not exe: raise RuntimeError('espeak-ng not installed')
        raw = os.path.join(cache, key + '_raw.wav'); subprocess.run([exe, '-v', 'en-us+m3', '-s', '150', '-p', '40', '-w', raw, sp], check=True); to_wav(raw, wav)
        return wav, None, 'espeak'
    # estimate: silence of estimated duration
    d = len(sp.split()) / 2.55 + 0.35
    _ff(['-f', 'lavfi', '-i', f'anullsrc=r={SR}:cl=mono', '-t', f'{d:.3f}', '-c:a', 'pcm_f32le', wav])
    return wav, None, 'estimate'

def pick_engine(requested):
    """auto: edge-tts if importable & reachable, else espeak, else estimate."""
    if requested != 'auto': return requested
    try:
        import edge_tts  # noqa
        import socket; socket.create_connection(('speech.platform.bing.com', 443), timeout=5).close()
        return 'edge'
    except Exception as e:
        print(f'[tts] edge-tts unavailable ({e}); falling back', file=sys.stderr)
    if shutil.which('espeak-ng') or shutil.which('espeak'): return 'espeak'
    return 'estimate'
