"""Step 1: voiceover lines -> wav files + timeline.json (scene starts snapped to 2-second bars at 120 BPM).
Usage: python3 make_vo.py <workdir> <kokoro.onnx> <voices.bin>"""
import json, math, sys, os
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

work, model, voices = sys.argv[1:4]
os.makedirs(f'{work}/vo', exist_ok=True)
VOICE, SPEED = 'af_heart', 1.04
SCENES = [
    # id, [lines], pause between lines, min duration
    ('hook',     ['Queues. Pen drives. Files on WhatsApp.', ('There is a better way, to run a print shop.', 0.86)], 0.55, 6),
    ('logo',     ['Meet DocuFast.'], 0, 4),
    ('customer', ['Customers scan your QR code, upload from their phone, see the price, and pay by UPI.'], 0, 8),
    ('shop',     ['The moment they pay, your printer starts. No forwarding. No pen drives. No waiting.'], 0, 6),
    ('value',    ['Your prices. Your reports. Your shop, running smoother.'], 0, 6),
    ('privacy',  ['And customer files are deleted after printing.'], 0, 4),
    ('cta',      ['DocuFast India. Try it free for fourteen days.'], 0, 6),
]
k = Kokoro(model, voices)
SR = 24000
def trim(x, thr=0.004):
    idx = np.where(np.abs(x) > thr)[0]
    return x[idx[0]:idx[-1] + 1] if len(idx) else x
t = 0.0; scenes = []; n = 0
for sid, lines, gap, mind in SCENES:
    clips = []; cursor = 0.45   # voice starts just after the cut
    for item in lines:
        text, sp = item if isinstance(item, tuple) else (item, SPEED)
        x, sr = k.create(text, voice=VOICE, speed=sp, lang='en-us')
        x = trim(np.asarray(x, dtype=np.float32))
        fn = f'{work}/vo/{n:02d}.wav'; sf.write(fn, x, sr); n += 1
        d = len(x) / sr
        clips.append({'file': fn, 'text': text, 'offset': round(cursor, 3), 'dur': round(d, 3)})
        cursor += d + gap
    voice_end = cursor - gap
    dur = max(mind, math.ceil((voice_end + 0.9) / 2) * 2)   # whole bars
    scenes.append({'id': sid, 'start': t, 'dur': dur, 'vo': clips})
    t += dur
json.dump({'bpm': 120, 'total': t, 'scenes': scenes}, open(f'{work}/timeline.json', 'w'), indent=1)
for s in scenes: print(s['id'], s['start'], s['dur'], [(c['offset'], c['dur']) for c in s['vo']])
print('total', t)
