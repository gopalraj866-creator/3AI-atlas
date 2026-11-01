"""Procedural cinematic score + SFX (numpy/scipy only). Deterministic, 48 kHz stereo float32."""
import numpy as np
from scipy.signal import butter, lfilter, oaconvolve

SR = 48000

def midi(n): return 440.0 * 2 ** ((n - 69) / 12.0)

CH = {
    'Dm': [50, 57, 62, 65], 'Bb': [46, 53, 58, 62], 'F': [53, 57, 60, 65], 'C': [48, 55, 60, 64], 'Gm': [43, 55, 58, 62],
    'Am': [45, 57, 60, 64], 'D': [50, 57, 62, 66], 'A': [45, 57, 61, 64], 'Em7': [52, 55, 59, 62], 'Dsus': [50, 57, 62, 64],
}
MOODS = {
    #            chords                   len  bright sub  heart arp(bpm,prob) riser  impact
    'mystery':   (['Dm', 'Bb', 'Gm', 'A'], 7.5, 0.30, 1.0, 0, (0, 0), 0.0, 1),
    'wonder':    (['Dm', 'F', 'C', 'Gm'], 8.0, 0.50, 0.8, 0, (84, 0.45), 0.0, 0),
    'journey':   (['Bb', 'F', 'Gm', 'Dm'], 8.0, 0.55, 0.8, 0, (96, 0.55), 0.0, 0),
    'tension':   (['Dm', 'Gm', 'Dm', 'A'], 6.0, 0.25, 1.0, 66, (72, 0.2), 1.0, 0),
    'science':   (['Dm', 'Bb', 'F', 'C'], 8.0, 0.60, 0.7, 0, (108, 0.6), 0.0, 0),
    'epic':      (['Dm', 'Bb', 'F', 'C'], 6.0, 0.75, 1.2, 0, (60, 0.35), 0.5, 0),
    'transition': (['Gm', 'A'], 5.0, 0.40, 0.9, 0, (0, 0), 1.0, 0),
    'signal':    (['Am', 'F', 'C', 'Em7'], 7.5, 0.45, 0.8, 0, (120, 0.5), 0.0, 0),
    'aurora':    (['Bb', 'F', 'Dm', 'A'], 8.0, 0.85, 0.7, 0, (78, 0.6), 0.0, 0),
    'resolve':   (['Dm', 'Bb', 'F', 'D'], 7.5, 0.55, 0.8, 0, (72, 0.4), 0.0, 0),
    'outro':     (['F', 'C', 'Dm', 'D'], 6.0, 0.65, 0.9, 0, (72, 0.4), 0.0, 0),
}

def _env(n, a, r):
    e = np.ones(n, np.float32); na, nr = int(a * SR), int(r * SR)
    if na > 0: e[:na] = np.linspace(0, 1, min(na, n), dtype=np.float32) ** 1.5
    if nr > 0: e[-nr:] *= np.linspace(1, 0, min(nr, n), dtype=np.float32) ** 1.5
    return e

def _lp(x, fc, order=2): b, a = butter(order, fc / (SR / 2), 'low'); return lfilter(b, a, x).astype(np.float32)
def _hp(x, fc, order=2): b, a = butter(order, fc / (SR / 2), 'high'); return lfilter(b, a, x).astype(np.float32)

def pad(freqs, dur, bright, rs):
    n = int(dur * SR); t = (np.arange(n, dtype=np.float64) / SR); out = np.zeros(n, np.float32)
    nh = 7; roll = 1.1 + (1 - bright) * 1.8
    for f in freqs:
        for cents in (-7, 0, 7):
            ff = f * 2 ** (cents / 1200.0); ph0 = rs.uniform(0, 6.28)
            ph = 2 * np.pi * ff * t + 0.5 * np.sin(2 * np.pi * (0.11 + 0.05 * rs.rand()) * t + ph0)
            s = np.zeros(n, np.float64)
            for h in range(1, nh + 1): s += np.sin(h * ph) / h ** roll
            out += (s * (0.3 / len(freqs))).astype(np.float32)
    return out

def bell(f, dur=3.2, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.005 * t) * np.exp(-t * 2.5) + 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 4) + 0.12 * np.sin(2 * np.pi * f * 4.2 * t) * np.exp(-t * 6))
    e = np.exp(-t * 1.5) * np.minimum(1, t / 0.004)
    return (s * e * amp).astype(np.float32)

def thump(amp=1.0, f0=78, f1=38, dur=0.45):
    n = int(dur * SR); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t * 22); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 9) * amp).astype(np.float32)

def impact(rs):
    n = int(5 * SR); t = np.arange(n) / SR; f = 28 + 60 * np.exp(-t * 3.0); ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t * 0.9)
    noise = _lp(rs.randn(n).astype(np.float32), 600) * np.exp(-t * 2.2)
    return (boom * 0.9 + noise * 1.6).astype(np.float32)

def riser(dur, rs):
    n = int(dur * SR); t = np.arange(n) / SR; k = (t / dur)
    nz = _hp(rs.randn(n).astype(np.float32), 1800) * (k ** 2.4)
    f = 180 * (1 + 7 * k ** 2); ph = 2 * np.pi * np.cumsum(f) / SR; tone = np.sin(ph) * (k ** 2) * 0.25
    return (nz * 0.35 + tone * 0.6).astype(np.float32)

def whoosh(rs, dur=2.2):
    n = int(dur * SR); t = np.arange(n) / SR; env = np.exp(-((t - dur * 0.55) / (dur * 0.2)) ** 2)
    z = rs.randn(n).astype(np.float32); lo = _lp(z, 350); hi = _lp(_hp(z, 400), 6000); k = np.clip(t / dur * 1.2, 0, 1)
    return ((lo * (1 - k) + hi * k) * env * 0.6).astype(np.float32)

def reverb(x, secs=3.2, wet=0.3, rs=None, damp=4500):
    rs = rs or np.random.RandomState(3); n = int(secs * SR); t = np.arange(n) / SR
    out = np.zeros((len(x), 2), np.float32) if x.ndim == 1 else None
    irs = []
    for c in range(2):
        ir = rs.randn(n).astype(np.float32) * np.exp(-t * (6.9 / secs)); ir = _lp(ir, damp); ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR)); irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    if x.ndim == 1: x = np.stack([x, x], 1)
    y = np.stack([oaconvolve(x[:, c], irs[c])[: len(x)] for c in range(2)], 1).astype(np.float32)
    return x * (1 - wet) + y * wet * 1.6

def render_block(mood, dur, seed):
    """Return stereo-mono music (float32, length dur*SR) for one block (dry)."""
    chords, clen, bright, sub, heart, (abpm, aprob), riser_k, imp = MOODS[mood]
    rs = np.random.RandomState(seed); n = int(dur * SR); out = np.zeros(n, np.float32)
    k = 0; pos = 0.0
    while pos < dur:
        c = CH[chords[k % len(chords)]]; seg = min(clen + 1.6, dur - pos + 1.6); freqs = [midi(x) for x in c]
        p = pad(freqs, seg, bright, rs) * _env(int(seg * SR), 1.8, 1.8)
        i0 = int(pos * SR); i1 = min(n, i0 + len(p)); out[i0:i1] += p[: i1 - i0]
        if sub:  # sub bass on root
            s = np.sin(2 * np.pi * midi(c[0] - 12) * np.arange(int(seg * SR)) / SR).astype(np.float32) * 0.18 * sub * _env(int(seg * SR), 2.0, 2.0)
            out[i0:i1] += s[: i1 - i0]
        pos += clen; k += 1
    # arpeggio bells
    if abpm:
        step = 60.0 / abpm / 2; pos = 0.6; j = 0
        while pos < dur - 0.5:
            if rs.rand() < aprob:
                c = CH[chords[int(pos // clen) % len(chords)]]; note = c[(j * 2 + int(rs.rand() * 3)) % len(c)] + 12 * (1 + int(rs.rand() * 2))
                b = bell(midi(note), 3.0, 0.07 + 0.05 * bright); i0 = int(pos * SR); i1 = min(n, i0 + len(b)); out[i0:i1] += b[: i1 - i0]
                for d, g in ((0.375, 0.35), (0.75, 0.2)):
                    j0 = i0 + int(d * SR)
                    if j0 < n: j1 = min(n, j0 + len(b)); out[j0:j1] += b[: j1 - j0] * g
            pos += step; j += 1
    # heartbeat
    if heart:
        per = 60.0 / heart; pos = 0.2
        while pos < dur - 0.3:
            for d, g in ((0, 0.55), (0.3, 0.32)):
                th = thump(g); i0 = int((pos + d) * SR); i1 = min(n, i0 + len(th))
                if i0 < n: out[i0:i1] += th[: i1 - i0]
            pos += per
    # riser into the next block
    if riser_k:
        rd = min(3.6, dur * 0.6); r = riser(rd, rs) * riser_k * 0.9; out[-len(r):] += r
    if imp:
        im = impact(rs) * 0.8; out[: min(n, len(im))] += im[:n]
    return out

def build_music(blocks, total, seed=7):
    """blocks: [{start,end,mood}] on the output timeline. Returns stereo float32 (total*SR, 2) with reverb and whooshes."""
    n = int(total * SR); dry = np.zeros(n, np.float32); sfx = np.zeros(n, np.float32)
    for i, b in enumerate(blocks):
        dur = b['end'] - b['start']; m = render_block(b['mood'], dur + 1.6, seed + i)
        m = m * _env(len(m), 0.0 if i == 0 else 1.4, 1.4 if i < len(blocks) - 1 else 2.5)
        i0 = int(b['start'] * SR); i1 = min(n, i0 + len(m)); dry[i0:i1] += m[: i1 - i0]
        if i > 0:
            w = whoosh(np.random.RandomState(seed + 100 + i)); j0 = max(0, int(b['start'] * SR) - int(1.2 * SR)); j1 = min(n, j0 + len(w)); sfx[j0:j1] += w[: j1 - j0]
    st = reverb(dry, 3.4, 0.38, np.random.RandomState(seed))
    st[:, 0] += sfx * 0.9; st[:, 1] += np.roll(sfx, 240) * 0.9
    # gentle stereo widening + master level for the bed
    mid = (st[:, 0] + st[:, 1]) * 0.5; side = (st[:, 0] - st[:, 1]) * 0.5 * 1.25
    st = np.stack([mid + side, mid - side], 1)
    rms = np.sqrt(np.mean(st ** 2) + 1e-12); st *= (0.085 / rms)
    return st.astype(np.float32)
