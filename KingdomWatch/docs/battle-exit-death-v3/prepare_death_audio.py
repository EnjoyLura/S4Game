"""Offline kill-cue sound design from the project's archived licensed recordings.

No downloads, generated tones, game launch or gameplay validation. Each edit,
source hash, output level and importer UUID is retained for review.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import uuid
import wave
import imageio_ffmpeg
import numpy as np

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/audio/death-v3'
SR = 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
records, provenance = [], {}
DEST.mkdir(parents=True, exist_ok=True)


def meta(path, audio=False):
    p = Path(str(path) + '.meta')
    if not p.exists():
        p.write_text(json.dumps(dict(ver='1.0.0' if audio else '1.2.0',
            importer='audio-clip' if audio else 'directory', imported=True,
            uuid=str(uuid.uuid4()), files=['.json', '.wav'] if audio else [],
            subMetas={}, userData={'downloadMode': 0} if audio else {}), indent=2), encoding='utf-8')


def layer(rel, gain, seconds, rate=1, low=3600, high=95, decay=.085, delay=0, start=0):
    candidates = [GAME/'docs/combat-audio-v2/sources'/rel, GAME/'docs/audio-upgrade-v1/sources'/rel]
    source = next(p for p in candidates if p.is_file())
    pack = rel.split('/')[0]
    author, license_id, page = {
        'kenney-impact': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/impact-sounds'),
        'kenney-rpg': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/rpg-audio'),
        'rubberduck-rpg': ('rubberduck', 'CC0-1.0', 'https://opengameart.org/node/86018'),
        'ice-electric': ("Iwan 'qubodup' Gabovitch", 'CC-BY-3.0', 'https://opengameart.org/content/ice-electricity-magic'),
    }[pack]
    provenance[rel] = dict(source=str(source.relative_to(GAME)), author=author, license=license_id,
        page=page, sha256=hashlib.sha256(source.read_bytes()).hexdigest())
    filters = f'aresample={SR},asetrate={round(SR*rate)},aresample={SR},highpass=f={high}:p=2,lowpass=f={low}:p=2,equalizer=f=2800:t=q:w=1:g=-3'
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(source), '-ss', str(start),
        '-t', str(seconds), '-af', filters, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'])
    a = np.frombuffer(raw, np.float32).copy()
    a -= a.mean()
    peak = max(float(np.max(np.abs(a))), 1e-8)
    onset = np.flatnonzero(np.abs(a) > peak*.045)
    if len(onset):
        a = a[max(0, min(onset[0]-44, round(.05*SR))):]
    a /= max(float(np.max(np.abs(a))), 1e-8)
    a *= np.exp(-np.arange(len(a))/(SR*decay))
    attack, release = min(66, len(a)//3), min(round(.028*SR), len(a)//3)
    a[:attack] *= np.sin(np.linspace(0, np.pi/2, attack))**2
    a[-release:] *= np.cos(np.linspace(0, np.pi/2, release))**2
    return a*gain, round(delay*SR), dict(source=rel, gain=gain, seconds=seconds, rate=rate,
        lowpassHz=low, highpassHz=high, decaySeconds=decay, delaySeconds=delay, start=start)


def emit(name, layers, rms=-20.8):
    a = np.zeros(max(len(s)+offset for s, offset, _ in layers), np.float64)
    for sample, offset, _ in layers:
        a[offset:offset+len(sample)] += sample
    blocks = np.array([np.mean(a[i:i+441]**2) for i in range(0, len(a), 441)])
    active = blocks > max(float(blocks.max())*.02, 1e-10)
    a *= 10**(rms/20)/max(float(np.sqrt(blocks[active].mean())), 1e-8)
    a *= min(1, 10**(-7.5/20)/max(float(np.max(np.abs(a))), 1e-8))
    target = DEST/(name+'.wav')
    with wave.open(str(target), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a*32767).astype('<i2').tobytes())
    meta(target, True)
    records.append(dict(file=target.name, seconds=round(len(a)/SR, 4),
        peakDBFS=round(20*np.log10(max(float(np.max(np.abs(a))), 1e-9)), 2),
        activeRmsTargetDBFS=rms, layers=[d for _, _, d in layers],
        sha256=hashlib.sha256(target.read_bytes()).hexdigest()))


meta(DEST)
I = 'kenney-impact/Audio/'
R = 'rubberduck-rpg/'
K = 'kenney-rpg/Audio/'
E = 'ice-electric/qubodupIceAndElectricitySpells/'
for i in range(3):
    # Shared short body/rupture transient. No long scream or ringing metal.
    body = [layer(I+f'impactPunch_heavy_{i:03}.ogg', .72, .16, .92+i*.025, 2450, decay=.065),
        layer(K+'dropLeather.ogg', .34, .17, 1.13+i*.04, 3400, decay=.075, delay=.009)]
    crack = layer(I+f'impactWood_light_{i:03}.ogg', .22, .13, 1.12+i*.025, 3200, decay=.055, delay=.012)
    emit(f'physical_{i+1}', body+[crack], -20.4)
    emit(f'heavy_{i+1}', body+[crack,
        layer(R+'creature_die_01.ogg', .13, .22, .91+i*.035, 2400, high=180, decay=.10, delay=.012),
        layer(I+'impactSoft_heavy_004.ogg', .33, .20, .78, 1800, decay=.08)], -19.8)
    emit(f'fire_{i+1}', body+[
        layer(R+f'spell_fire_{i+1:02}.ogg', .35, .25, .90+i*.03, 3400, high=180, decay=.09, delay=.008, start=.14)], -20.8)
    emit(f'volt_{i+1}', body+[crack,
        layer(E+f'qubodupElectricityDamage0{1+i%2}.flac', .18, .105, .85+i*.035, 3400,
            high=700, decay=.032, delay=.008, start=.145)], -21)
    emit(f'frost_{i+1}', body+[
        layer(I+f'impactGlass_light_{i:03}.ogg', .36, .21, .80+i*.025, 4100, high=260, decay=.065, delay=.006),
        layer(I+f'footstep_snow_{i:03}.ogg', .2, .20, 1.08, 3800, high=380, decay=.07, delay=.018)], -21)

(OUT/'audio-assets.json').write_text(json.dumps(dict(sampleRate=SR, channels=1,
    method='licensed recordings; short body + rupture + elemental finish; offline band limiting and envelopes',
    assets=records, sources=list(provenance.values())), ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(files=len(records), bytes=sum(p.stat().st_size for p in DEST.glob('*.wav')),
    durationRange=[min(d['seconds'] for d in records), max(d['seconds'] for d in records)])))
