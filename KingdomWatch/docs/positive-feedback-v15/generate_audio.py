"""Author original short harmonic UI stingers, without third-party samples or auditioning."""
from pathlib import Path
import array
import hashlib
import json
import math
import uuid
import wave

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/resources/audio/feedback-v15'
RATE = 24000
SCORES = {
    'tick': (.19, [(0, 79, .17, .68)]),
    'star': (.27, [(0, 84, .23, .7), (.035, 91, .22, .22)]),
    'growth': (.62, [(0, 72, .29, .55), (.10, 76, .32, .55), (.21, 79, .37, .66)]),
    'purchase': (.76, [(0, 79, .25, .48), (.075, 84, .25, .5), (.17, 88, .31, .48), (.28, 91, .43, .56)]),
    'reward': (1.12, [(0, 72, .39, .56), (.12, 76, .43, .58), (.24, 79, .43, .58), (.40, 84, .64, .66), (.40, 72, .63, .22)]),
    'breakthrough': (1.32, [(0, 48, .75, .34), (0, 60, .50, .32), (.10, 67, .44, .4), (.23, 72, .47, .5), (.37, 76, .46, .52), (.52, 79, .48, .54), (.68, 84, .58, .62)]),
    'recruit': (1.66, [(0, 48, 1.05, .28), (0, 60, .65, .28), (.13, 67, .54, .38), (.29, 72, .58, .48), (.46, 76, .57, .48), (.65, 79, .59, .5), (.86, 84, .73, .59), (.86, 76, .72, .20)]),
    'construction': (1.42, [(0, 43, .65, .34), (0, 48, .63, .28), (.14, 55, .47, .42), (.30, 60, .52, .48), (.47, 64, .52, .5), (.64, 67, .53, .52), (.82, 72, .54, .56)]),
}

def meta(path, importer, version, files, user=None):
    destination = Path(str(path) + '.meta')
    if destination.exists():
        return
    destination.write_text(json.dumps({'ver': version, 'importer': importer, 'imported': True,
        'uuid': str(uuid.uuid4()), 'files': files, 'subMetas': {}, 'userData': user or {}}, indent=2), encoding='utf-8')

OUT.mkdir(parents=True, exist_ok=True)
meta(OUT, 'directory', '1.2.0', [])
report = []
for name, (duration, notes) in SCORES.items():
    samples = [0.0] * round(RATE * duration)
    for onset, midi, length, amplitude in notes:
        frequency = 440 * 2 ** ((midi - 69) / 12)
        for i in range(round(length * RATE)):
            frame = round(onset * RATE) + i
            if frame >= len(samples):
                break
            t = i / RATE
            attack = min(1, t / .006)
            release = min(1, max(0, (length - t) / .05)) ** 2
            envelope = attack * release * math.exp(-3.3 * t / length)
            # Fundamental plus softer decaying overtones: a rounded mallet, not a square-wave beep.
            tone = math.sin(2 * math.pi * frequency * t)
            tone += .28 * math.exp(-9 * t) * math.sin(2 * math.pi * frequency * 2 * t)
            tone += .12 * math.exp(-13 * t) * math.sin(2 * math.pi * frequency * 3 * t)
            tone += .055 * math.exp(-18 * t) * math.sin(2 * math.pi * frequency * 4 * t)
            samples[frame] += tone * amplitude * envelope
    # Quiet two-tap room tail; deterministic with no live runtime synthesis.
    dry = samples[:]
    for seconds, gain in [(.047, .13), (.093, .075)]:
        offset = round(seconds * RATE)
        for i in range(offset, len(samples)):
            samples[i] += dry[i - offset] * gain
    peak = max(abs(s) for s in samples) or 1
    ceiling = .66 if name in ('tick', 'star') else .79
    pcm = array.array('h', (round(s / peak * ceiling * 32767) for s in samples))
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(RATE); audio.writeframes(pcm.tobytes())
    meta(path, 'audio-clip', '1.0.0', ['.json', '.wav'], {'downloadMode': 0})
    report.append({'file': path.relative_to(ROOT).as_posix(), 'seconds': duration, 'sampleRate': RATE,
        'peak': max(abs(s) for s in pcm) / 32767, 'bytes': path.stat().st_size,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'auditioned': False})
(Path(__file__).parent / 'audio-manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'originalStingers': len(report), 'bytes': sum(r['bytes'] for r in report), 'auditioned': False}))
