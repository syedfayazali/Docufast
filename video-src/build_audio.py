#!/usr/bin/env python3
"""Builds the ad's soundtrack from timeline.json: voiceover (Kokoro TTS), sound effects and a music bed,
all synthesised here (no sample libraries, nothing to license).
usage: build_audio.py <outdir> <kokoro.onnx> <voices.bin>"""
import json, sys, os, numpy as np, soundfile as sf
from scipy import signal as sg

OUT, MODEL, VOICES = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
TL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timeline.json')))
SR = 44100
DUR = TL['duration']
N = int((DUR + 2.5) * SR)            # room for the final reverb tail
BEAT = 60.0 / TL['bpm']
rng = np.random.default_rng(11)

def T(n): return np.arange(n) / SR
def sos(kind, fc, order=2): return sg.butter(order, fc, btype=kind, fs=SR, output='sos')
def lp(x, fc, order=2): return sg.sosfilt(sos('low', fc, order), x, axis=0)
def hp(x, fc, order=2): return sg.sosfilt(sos('high', fc, order), x, axis=0)
def bp(x, lo, hi): return sg.sosfilt(sg.butter(2, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)
def st(x): return x if x.ndim == 2 else np.stack([x, x], 1)
def add(buf, x, t, g=1.0):
    x = st(x); i = int(round(t * SR))
    if i >= len(buf): return
    j = min(len(buf), i + len(x)); buf[i:j] += x[:j - i] * g
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12.0)

def make_ir(dur, decay, cutoff):
    n = int(dur * SR); ir = rng.standard_normal((n, 2)) * np.exp(-decay * T(n))[:, None]
    ir = lp(ir, cutoff); ir[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum())
IR_S, IR_L = make_ir(1.0, 6.0, 7000), make_ir(2.4, 2.4, 5000)
def reverb(x, wet=0.25, ir=None):
    ir = IR_S if ir is None else ir; x = st(x)
    wl = sg.fftconvolve(x[:, 0], ir[:, 0]); wr = sg.fftconvolve(x[:, 1], ir[:, 1])
    y = np.zeros((len(wl), 2)); y[:len(x)] += x * (1 - wet * 0.5)
    y[:, 0] += wl * wet * 1.6; y[:, 1] += wr * wet * 1.6
    return y

# ---------- sound effects ----------
def sweep_noise(dur, f0, f1, width=1.0, up=True):
    n = int(dur * SR); x = rng.standard_normal(n)
    f, tt, Z = sg.stft(x, SR, nperseg=1024, noverlap=768)
    u = np.linspace(0, 1, len(tt)); fc = f0 * (f1 / f0) ** u if up else f1 * (f0 / f1) ** u
    M = np.exp(-0.5 * ((np.log2(np.maximum(f, 20))[:, None] - np.log2(fc)[None, :]) / width) ** 2)
    _, y = sg.istft(Z * M, SR, nperseg=1024, noverlap=768); y = np.pad(y, (0, max(0, n - len(y))))[:n]
    return y / (np.abs(y).max() + 1e-9)
def whoosh(d=0.7, up=True, **_):
    n = int(d * SR); y = sweep_noise(d, 250, 7000, 1.1, up); u = np.linspace(0, 1, n)
    env = (u ** 1.6) * ((1 - u) ** 0.7); env /= env.max()
    pan = np.linspace(-0.7, 0.7, n) * (1 if up else -1)
    L, R = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    return np.stack([y * env * L, y * env * R], 1) * 0.9
def impact(g=1.0, **_):
    t = T(int(1.5 * SR)); ph = 2 * np.pi * np.cumsum(38 + 95 * np.exp(-t * 9)) / SR
    x = np.sin(ph) * np.exp(-t * 3.2) + 0.55 * lp(rng.standard_normal(len(t)) * np.exp(-t * 55), 4500)
    return reverb(x, 0.18) * 0.9
def boom(**_):
    t = T(int(2.4 * SR)); ph = 2 * np.pi * np.cumsum(30 + 120 * np.exp(-t * 7)) / SR
    x = np.sin(ph) * np.exp(-t * 1.8) + 0.6 * lp(rng.standard_normal(len(t)) * np.exp(-t * 30), 6000)
    x[:int(0.002 * SR)] *= 0.2
    return reverb(x, 0.35, IR_L) * 1.0
def hit(**_):
    t = T(int(0.5 * SR)); ph = 2 * np.pi * np.cumsum(60 + 150 * np.exp(-t * 28)) / SR
    return reverb(np.sin(ph) * np.exp(-t * 11) + 0.4 * bp(rng.standard_normal(len(t)) * np.exp(-t * 70), 800, 5000), 0.12) * 0.8
def shimmer(**_):
    t = T(int(2.2 * SR)); x = np.zeros(len(t))
    for i, f in enumerate([2093, 2637, 3136, 4186, 5274]):
        x += np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * (5 + i) * t) * 0.2) * np.exp(-t * (2.0 + i * 0.5)) * 0.18
    return reverb(x, 0.35, IR_L)
def pop(**_):
    t = T(int(0.22 * SR)); f = 360 + 700 * np.exp(-t * 22)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) + 0.3 * hp(rng.standard_normal(len(t)) * np.exp(-t * 400), 2500)
    return x * 0.7
def tick(**_):
    t = T(int(0.05 * SR)); return hp(rng.standard_normal(len(t)) * np.exp(-t * 260), 1800) * 0.45
def beep(**_):
    t = T(int(0.12 * SR)); return np.sin(2 * np.pi * 1400 * t) * np.minimum(1, t * 600) * np.exp(-t * 18) * 0.5
def shutter(**_):
    out = np.zeros(int(0.25 * SR))
    for o, gg in [(0.0, 1.0), (0.055, 0.8)]:
        t = T(int(0.04 * SR)); add_ = bp(rng.standard_normal(len(t)) * np.exp(-t * 130), 900, 7000) * gg
        i = int(o * SR); out[i:i + len(add_)] += add_
    return out * 0.8
def bell(f, d=1.3, k=2.76):
    t = T(int(d * SR)); return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * k * t) * np.exp(-t * 6)) * np.exp(-t * 3.2) * np.minimum(1, t * 800)
def ping(**_):
    out = np.zeros(int(1.4 * SR))
    for o, f in [(0.0, 1318.5), (0.13, 1760.0)]:
        b = bell(f, 1.2); i = int(o * SR); out[i:i + len(b)] += b * 0.5
    return reverb(out, 0.2)
def ding(**_):
    out = np.zeros(int(1.9 * SR))
    for o, f in [(0.0, 1046.5), (0.075, 1318.5), (0.15, 1568.0), (0.23, 2093.0)]:
        b = bell(f, 1.5); i = int(o * SR); out[i:i + len(b)] += b * 0.38
    return reverb(out, 0.3, IR_L)
def printer(d=2.6, **_):
    n = int(d * SR); t = T(n); u = t / d
    rate = 7 + 5 * u; ph = 2 * np.pi * np.cumsum(rate) / SR
    pulse = 0.3 + 0.7 * (0.5 + 0.5 * np.tanh(5 * np.sin(ph)))
    car = bp(rng.standard_normal(n), 900, 3800) * pulse * 0.55
    motor = np.sin(2 * np.pi * np.cumsum(120 + 22 * np.sin(2 * np.pi * 0.9 * t)) / SR) * 0.1
    feed = bp(rng.standard_normal(n), 2500, 7000) * (0.15 + 0.15 * np.sin(2 * np.pi * 2.2 * t) ** 2)
    env = np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.15)
    x = (car + motor + feed) * env
    return np.stack([x * 0.9, x * 1.0], 1)
def stamp(**_):
    t = T(int(0.8 * SR)); ph = 2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 30)) / SR
    x = np.sin(ph) * np.exp(-t * 9) + 0.6 * lp(rng.standard_normal(len(t)) * np.exp(-t * 90), 3000) + 0.25 * hp(rng.standard_normal(len(t)) * np.exp(-t * 200), 3000)
    return reverb(x, 0.15) * 0.9
def riser(d=2.5, **_):
    n = int(d * SR); u = np.linspace(0, 1, n)
    y = sweep_noise(d, 180, 9000, 0.9, True) * (u ** 2.2)
    tone = np.sin(2 * np.pi * np.cumsum(140 * (9 ** u)) / SR) * (u ** 2.5) * 0.35
    x = y + tone; x *= np.minimum(1, (d - np.linspace(0, d, n)) / 0.01 + 0)
    sh = int(0.012 * SR); R = np.concatenate([np.zeros(sh), x[:-sh]])
    return np.stack([x, R], 1) * 0.8
def stinger(**_):
    n = int(2.6 * SR); t = T(n); x = np.zeros(n)
    for m, a in [(48, 1.0), (60, 0.8), (64, 0.7), (67, 0.7), (74, 0.5), (79, 0.35)]:
        f = mtof(m)
        for dt in (-0.005, 0.0, 0.005):
            ff = f * (1 + dt)
            x += sum(np.sin(2 * np.pi * ff * k * t) / k for k in range(1, 7)) * a * 0.06
    x = lp(x, 3500) * np.exp(-t * 1.7) * np.minimum(1, t * 400)
    imp = st(impact()[:n, 0]); out = reverb(x, 0.3, IR_L) * 1.0
    out[:len(imp)] += imp * 0.8
    return out
SFX = dict(whoosh=whoosh, impact=impact, boom=boom, hit=hit, shimmer=shimmer, pop=pop, tick=tick, beep=beep, shutter=shutter,
           ping=ping, ding=ding, printer=printer, stamp=stamp, riser=riser, stinger=stinger)

sfx_bus = np.zeros((N, 2))
for e in TL['sfx']:
    kw = {k: v for k, v in e.items() if k not in ('t', 'k', 'g')}
    add(sfx_bus, SFX[e['k']](**kw), e['t'], e.get('g', 1.0))

# ---------- music ----------
def layer_gain(name):
    g = np.zeros(N)
    for s in TL['layers']:
        g[int(s['from'] * SR):int(s['to'] * SR)] = s[name]
    k = int(0.06 * SR); return np.convolve(g, np.ones(k) / k, mode='same')
def addsat(buf, x, t, g=1.0): add(buf, x, t, g)
CH = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [55, 60, 64]), (43, [55, 59, 62])]   # Am F C G
bars = int(np.ceil(DUR / (BEAT * 4)))
mus_t = T(N); ph_beat = (mus_t % BEAT)
pump = 1 - 0.7 * np.exp(-ph_beat / 0.13)        # sidechain-style pump from the kick
drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); pad = np.zeros((N, 2)); arp = np.zeros((N, 2))

def kick():
    t = T(int(0.5 * SR)); ph = 2 * np.pi * np.cumsum(46 + 110 * np.exp(-t * 24)) / SR
    return (np.sin(ph) * np.exp(-t * 7.5) + 0.35 * lp(rng.standard_normal(len(t)) * np.exp(-t * 180), 2500)) * 0.95
def clap():
    t = T(int(0.3 * SR)); x = np.zeros(len(t))
    for o in (0, 0.011, 0.023): 
        i = int(o * SR); x[i:] += (rng.standard_normal(len(t) - i)) * np.exp(-t[:len(t) - i] * (35 if o == 0.023 else 120))
    return bp(x, 900, 6500) * 0.5
def hat(open_=False):
    t = T(int((0.2 if open_ else 0.06) * SR)); return hp(rng.standard_normal(len(t)) * np.exp(-t * (18 if open_ else 90)), 7000) * (0.18 if open_ else 0.14)
KICK, CLAP, HH, OH = kick(), clap(), hat(), hat(True)
for b in range(bars):
    t0 = b * 4 * BEAT; root, tri = CH[b % 4]
    for k in range(4):
        add(drums, KICK, t0 + k * BEAT, 1.0)
        add(drums, HH, t0 + k * BEAT + BEAT / 2, 0.9 if k < 3 else 0.0)
        if k in (1, 3): add(drums, CLAP, t0 + k * BEAT, 1.0)
    add(drums, OH, t0 + 3.5 * BEAT, 1.0)
    # bass: off-beat 8ths on the root, lowpassed saw + sub
    for k in range(8):
        if k % 2 == 1:
            d = BEAT / 2 * 0.85; tt = T(int(d * SR)); f = mtof(root)
            x = (np.sin(2 * np.pi * f * tt) + 0.5 * sum(np.sin(2 * np.pi * f * h * tt) / h for h in range(2, 6))) * np.minimum(1, tt * 300) * np.minimum(1, (d - tt) * 120)
            add(bass, lp(x, 420) * 0.5, t0 + k * BEAT / 2)
    # pad: three detuned voices per chord tone, whole bar
    d = 4 * BEAT + 0.25; tt = T(int(d * SR)); px = np.zeros(len(tt))
    for m in tri:
        for dt in (-0.006, 0.0, 0.006):
            f = mtof(m) * (1 + dt); px += sum(np.sin(2 * np.pi * f * h * tt) / h for h in range(1, 9)) * 0.05
    px *= np.minimum(1, tt / 0.12) * np.minimum(1, (d - tt) / 0.25)
    add(pad, lp(px, 1500), t0)
    # arp: 16ths, triad one octave up, accent each beat
    notes = [tri[0] + 12, tri[1] + 12, tri[2] + 12, tri[1] + 12]
    for k in range(16):
        f = mtof(notes[k % 4] + (12 if k % 8 == 7 else 0)); d = 0.22; tt = T(int(d * SR))
        x = sum(np.sin(2 * np.pi * f * h * tt) / h ** 1.3 for h in range(1, 7)) * np.exp(-tt * 20) * np.minimum(1, tt * 500)
        a = 1.0 if k % 4 == 0 else 0.6
        add(arp, lp(x, 5000) * 0.22 * a, t0 + k * BEAT / 4)

# build-up snare rolls before each drop and a small fill before the languages scene end
def roll(t_end, length=1.0):
    n = 0; t = t_end - length; step = BEAT / 2
    while t < t_end - 1e-6:
        add(drums, CLAP, t, 0.55 + 0.5 * (t - (t_end - length)) / length); t += step; step = max(BEAT / 8, step * 0.72)
roll(8.0, 1.0); roll(40.0, 1.0); roll(47.0, 0.7)
# ping-pong delay on the arp (dotted eighth)
dly = np.zeros_like(arp); D = int(BEAT * 0.75 * SR)
for r, gn in enumerate([0.42, 0.22, 0.1], 1):
    sh = D * r; side = r % 2
    dly[sh:, side] += arp[:-sh, :].mean(1) * gn
arp = arp + dly
music = (drums * np.stack([layer_gain('kick')] * 2, 1) * 0.9 +
         bass * np.stack([layer_gain('bass') * pump] * 2, 1) * 1.1 +
         pad * np.stack([layer_gain('pad') * (0.5 + 0.5 * pump)] * 2, 1) * 0.9 +
         arp * np.stack([layer_gain('arp') * (0.45 + 0.55 * pump)] * 2, 1))
# hats/claps follow their own layers (kick layer covers drums; thin them out where hat/clap are 0)
hatg = layer_gain('hat'); music = music * (0.75 + 0.25 * np.stack([hatg] * 2, 1))
# music stops at the end: fade over the last beat before the stinger, silence after
mus_end = 47.1; fade = np.clip((mus_end - mus_t) / 0.08, 0, 1); music *= fade[:, None]
# intro: brief filter-open on the whole bed
music[:int(8 * SR)] = lp(music[:int(8 * SR)], 9000)

# ---------- voiceover ----------
from kokoro_onnx import Kokoro
K = Kokoro(MODEL, VOICES)
vo_bus = np.zeros((N, 2)); rep = []; clips = {}
def trim(x, thr=0.012):
    e = np.abs(x); idx = np.where(e > thr)[0]
    return x[max(0, idx[0] - int(0.01 * 24000)): idx[-1] + int(0.03 * 24000)] if len(idx) else x
for v in TL['vo']:
    x, sr = K.create(v['text'], voice=TL['voice']['name'], speed=v.get('speed', TL['voice']['speed']), lang='en-us')
    x = trim(np.asarray(x, dtype=np.float64)); x = sg.resample_poly(x, SR, sr)
    x = hp(x, 90); x = np.tanh(x * 1.8) / np.tanh(1.8); x *= 0.9 / (np.abs(x).max() + 1e-9)
    f = int(0.006 * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    x = reverb(x, 0.10)[:len(x) + int(0.4 * SR)]
    add(vo_bus, x, v['at'], 1.0); dur = len(x) / SR - 0.4
    rep.append(dict(id=v['id'], at=v['at'], dur=round(dur, 2), end=round(v['at'] + dur, 2), text=v['text']))
# overlap / scene-boundary report
for a, b in zip(rep, rep[1:]):
    if a['end'] > b['at'] - 0.03: print(f"OVERLAP {a['id']} ends {a['end']} but {b['id']} starts {b['at']}")
json.dump(rep, open(os.path.join(OUT, 'vo_report.json'), 'w'), indent=1)

# ---------- mix ----------
env = sg.sosfiltfilt(sos('low', 7), np.abs(vo_bus).max(1)); env = np.clip(env / 0.05, 0, 1)
duck = 1 - 0.5 * env                                    # music ducks under the voice
mix = music * 0.30 * duck[:, None] + sfx_bus * 0.42 + vo_bus * 1.0
mix = np.tanh(mix * 0.9) / np.tanh(0.9)                  # soft limiter
mix *= 0.89 / np.abs(mix).max()
end = int((DUR + 0.0) * SR) + int(2.0 * SR); mix = mix[:end]
mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))[:, None]
for name, a in [('vo', vo_bus), ('sfx', sfx_bus), ('music', music), ('mix', mix)]:
    sf.write(os.path.join(OUT, name + '.wav'), np.clip(a, -1, 1), SR, subtype='PCM_16')

# captions for the page's text track
def ts(s): return f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{s % 60:06.3f}"
with open(os.path.join(OUT, 'captions.vtt'), 'w') as f:
    f.write('WEBVTT\n\n')
    for i, r in enumerate(rep, 1): f.write(f"{i}\n{ts(r['at'])} --> {ts(r['end'] + 0.15)}\n{r['text']}\n\n")
print('done', round(len(mix) / SR, 1), 's')
