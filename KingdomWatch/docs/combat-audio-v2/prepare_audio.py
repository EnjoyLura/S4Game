"""Design short game combat cues from licensed recordings. No runtime synthesis.

Repeatable source edits, envelopes and bus-ready levels are recorded per cue.
The original recordings and the v1 delivery remain intact.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import uuid
import wave

import imageio_ffmpeg
import numpy as np

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
SOURCES = OUT / 'sources'
DEST = GAME / 'assets/resources/audio/v2'
OLD = GAME / 'docs/audio-upgrade-v1/sources'
RAW = Path(os.environ['TEMP']) / 'kingdom-watch-audio-source-v1'
IMPACTS = Path(os.environ['TEMP']) / 'kw-kenney-impact-sounds'
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
manifest, provenance = [], {}
cache = {}

for directory in (SOURCES, DEST):
    directory.mkdir(parents=True, exist_ok=True)


def meta(path, importer):
    target = Path(str(path) + '.meta')
    if target.exists():
        return
    target.write_text(json.dumps({
        'ver': '1.0.0' if importer == 'audio-clip' else '1.2.0',
        'importer': importer, 'imported': True, 'uuid': str(uuid.uuid4()),
        'files': ['.json', '.wav'] if importer == 'audio-clip' else [],
        'subMetas': {}, 'userData': {'downloadMode': 0} if importer == 'audio-clip' else {},
    }, indent=2), encoding='utf-8')


meta(DEST, 'directory')


def source(rel):
    dest = SOURCES / rel
    if not dest.exists():
        candidates = [IMPACTS / rel.removeprefix('kenney-impact/')]
        if not rel.startswith('kenney-impact/'):
            candidates = [OLD / rel, RAW / rel]
        src = next(p for p in candidates if p.exists())
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    if rel not in provenance:
        pack = rel.split('/')[0]
        who, license_id, page = {
            'kenney-impact': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/impact-sounds'),
            'kenney-rpg': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/rpg-audio'),
            'kenney-ui': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/interface-sounds'),
            'medieval': ('Ben Jaszczak & Brian Nelson / Still North Media', 'CC0-1.0', 'https://opengameart.org/content/medieval-sound-effects-weapon-textures'),
            'rubberduck-rpg': ('rubberduck', 'CC0-1.0', 'https://opengameart.org/node/86018'),
            'ice-electric': ("Iwan 'qubodup' Gabovitch", 'CC-BY-3.0', 'https://opengameart.org/content/ice-electricity-magic'),
        }[pack]
        provenance[rel] = dict(source=rel, author=who, license=license_id, page=page,
                               sha256=hashlib.sha256(dest.read_bytes()).hexdigest())
    return dest


def fade(a, attack=.002, release=.025, decay=0):
    a = a.copy()
    if decay:
        a *= np.exp(-np.arange(len(a)) / (SR * decay))
    n, m = min(round(attack * SR), len(a)//3), min(round(release * SR), len(a)//2)
    if n:
        a[:n] *= np.sin(np.linspace(0, np.pi/2, n)) ** 2
    if m:
        a[-m:] *= np.cos(np.linspace(0, np.pi/2, m)) ** 2
    return a


def layer(rel, start=0, seconds=.22, gain=1, rate=1, low=5000, high=90,
          decay=0, delay=0, attack=.002, notch=0):
    key = (rel, start, seconds, rate, low, high, notch)
    if key not in cache:
        # Resample BEFORE asetrate: recording sample rates are not assumed.
        filters = f'aresample={SR},asetrate={round(SR*rate)},aresample={SR},highpass=f={high}:p=2,lowpass=f={low}:p=2'
        if notch:
            filters += f',equalizer=f={notch}:t=q:w=1.1:g=-6'
        raw = subprocess.check_output([FF, '-v', 'error', '-i', str(source(rel)),
            '-ss', str(start), '-t', str(seconds), '-af', filters,
            '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'])
        a = np.frombuffer(raw, np.float32).copy()
        a -= a.mean()
        peak = float(np.max(np.abs(a)))
        active = np.flatnonzero(np.abs(a) > peak * .045)
        # Cut recording lead-in, never delay an actual game attack by tens of ms.
        if len(active):
            a = a[max(0, min(active[0]-44, round(.075*SR))):]
        # Peak-reference only the individual layer; final cue keeps its crest.
        a /= max(float(np.max(np.abs(a))), 1e-6)
        cache[key] = a
    a = fade(cache[key], attack=attack, decay=decay) * gain
    return a, delay, dict(source=rel, start=start, seconds=seconds, gain=gain,
        rate=rate, lowpassHz=low, highpassHz=high, decaySeconds=decay,
        delaySeconds=delay, attackSeconds=attack, notchHz=notch)


def emit(name, layers, rms=-20, peak_db=-6, tail=0):
    n = max(len(a)+round(delay*SR) for a, delay, _ in layers)
    a = np.zeros(n + round(tail*SR), np.float64)
    for sample, delay, _ in layers:
        i = round(delay*SR)
        a[i:i+len(sample)] += sample
    if tail:
        dry = a.copy()
        for seconds, weight in [(.031, .045), (.057, .022)]:
            i = round(seconds*SR)
            a[i:] += dry[:-i] * weight
    # RMS across the audible section rather than peak matching every click.
    frames = [np.mean(a[i:i+441]**2) for i in range(0, len(a), 441)]
    frames = np.array(frames)
    active = frames > max(frames.max() * .015, 1e-10)
    energy = float(np.sqrt(np.mean(frames[active])))
    a *= 10**(rms/20) / max(energy, 1e-8)
    # Smoothly contain only the top peaks; leave normal transients unflattened.
    ceiling = 10**(peak_db/20)
    maximum = float(np.max(np.abs(a)))
    if maximum > ceiling:
        a *= ceiling/maximum
    a = fade(a, .0015, .022)
    target = DEST / (name+'.wav')
    with wave.open(str(target), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype('<i2').tobytes())
    meta(target, 'audio-clip')
    manifest.append(dict(file=target.name, seconds=round(len(a)/SR, 6),
        peakDBFS=round(20*np.log10(max(float(np.max(np.abs(a))), 1e-9)), 2),
        activeRmsTargetDBFS=rms, roomTailSeconds=tail,
        layers=[p for _, _, p in layers], sha256=hashlib.sha256(target.read_bytes()).hexdigest()))


W = 'medieval/'
K = 'kenney-rpg/Audio/'
R = 'rubberduck-rpg/'
E = 'ice-electric/qubodupIceAndElectricitySpells/'
I = 'kenney-impact/Audio/'


def foley(kind, variant=0, gain=1, seconds=.16, rate=1, low=3300, decay=.065, delay=0):
    return layer(I+f'{kind}_{variant:03}.ogg', seconds=seconds, gain=gain, rate=rate,
                 low=low, high=80, decay=decay, delay=delay)


def wind(gain=.4, rate=1, seconds=.19, low=5200, delay=0):
    return layer(W+'Scythian Recurve Arrow Pass.wav', .06, seconds,
                 gain, rate, low=low, high=240, decay=.09, delay=delay, attack=.004)


def flame(variant=0, gain=.5, seconds=.25, rate=.86, delay=0):
    return layer(R+f'spell_fire_{[1,2,3,4,7][variant%5]:02}.ogg', .14 if variant<3 else .2,
                 seconds, gain, rate, low=3700, high=130, decay=.12, delay=delay, attack=.004)


def electric(variant=0, gain=.24, seconds=.095, rate=.8, delay=0):
    # Tiny irregular crackle, never the sustained damage-sound buzz from v1.
    return layer(E+f'qubodupElectricityDamage0{1+variant%2}.flac', .145, seconds,
                 gain, rate, low=4100, high=650, decay=.035, delay=delay, notch=2700)


def ice(variant=0, gain=.27, seconds=.14, rate=.78, delay=0):
    return foley('impactGlass_light', variant%5, gain, seconds, rate,
                 low=4400, decay=.045, delay=delay)


# Primary attacks: elastic release / solid string mechanism / ignition / pulse / shard.
for i, at in enumerate([.105, .443, .77], 1):
    emit(f'bow_{i}', [layer(W+'English Longbow Shoot.wav', at, .18, .85,
        rate=.99+(i-2)*.025, low=5600, high=130, decay=.07), wind(.28)], rms=-20.5, peak_db=-7)
for i, at in enumerate([.32, .834, 1.41], 1):
    emit(f'crossbow_{i}', [
        layer(W+'Crossbow Shoot.wav', at, .20, .75, rate=.84+(i-2)*.015,
              low=3900, high=105, decay=.052, notch=2800),
        foley('impactWood_medium', i-1, .32, .13, .85, low=1900),
        foley('impactPunch_heavy', i-1, .31, .15, .9, low=1100), wind(.35, .88, .21, 4200, .006),
    ], rms=-18.8, peak_db=-6)
for i in range(1, 4):
    emit(f'fire_{i}', [flame(i-1, .65), foley('impactSoft_heavy', i-1, .48, .15, .82, 1900),
                      wind(.23, .9, .18, 3100, .012)], rms=-20, peak_db=-7)
    emit(f'thunder_{i}', [foley('impactPunch_medium', i-1, .68, .14, .82, 2300),
        electric(i-1, .36), electric(i, .14, .06, .92, .028), wind(.25, 1.13, .14, 4000)], rms=-20.5, peak_db=-7)
    emit(f'frost_{i}', [foley('impactSoft_medium', i-1, .52, .13, .95, 2800),
        ice(i-1, .32), wind(.34, 1.16, .22, 5100),
        layer(I+f'footstep_snow_{i-1:03}.ogg', seconds=.19, gain=.15, low=4800,
              high=400, decay=.08, delay=.012)], rms=-21, peak_db=-7.5)

# Enemy contact has a body, not a clang. Short variants leave room for the next hit.
for i in range(1, 4):
    emit(f'hit_{i}', [foley('impactPunch_medium', i-1, .8),
        foley('impactSoft_medium', i-1, .3, .12, 1.1, 3800)], rms=-23, peak_db=-9)
    emit(f'pierce_{i}', [foley('impactPunch_heavy', i-1, .8, .16, .9, 2500),
        foley('impactWood_light', i-1, .25, .10, .88, 3200)], rms=-22, peak_db=-8)
    emit(f'crush_{i}', [foley('impactPunch_heavy', i-1, .8, .18, .8, 1900),
        flame(i-1, .32, .18, .78, .008)], rms=-22.5, peak_db=-8)
    emit(f'zap_hit_{i}', [foley('impactPunch_medium', i-1, .7, .12, .9, 2100),
        electric(i-1, .26, .075, .75, .004)], rms=-23.5, peak_db=-9)
    emit(f'icebreak_{i}', [foley('impactSoft_heavy', i-1, .68, .15, .88, 2600),
        ice(i-1, .37, .13, .85)], rms=-23.5, peak_db=-9)

emit('pierce_heavy', [foley('impactPunch_heavy', 3, .85, .24, .7, 2300),
    foley('impactWood_medium', 3, .35, .16, .8, 2800)], rms=-20, peak_db=-6.5)
emit('fire_heavy', [foley('impactPunch_heavy', 3, .75, .26, .66, 1800),
    flame(4, .6, .38, .76)], rms=-20.5, peak_db=-6.5, tail=.06)
emit('thunder_heavy', [foley('impactPunch_heavy', 4, .85, .24, .7, 2200),
    electric(1, .35, .13, .65), wind(.27, .7, .28, 3200)], rms=-20.5, peak_db=-6.5)
emit('frost_heavy', [foley('impactSoft_heavy', 4, .7, .27, .7, 2100),
    ice(4, .5, .24, .65), wind(.23, 1, .26, 4500)], rms=-21, peak_db=-7, tail=.06)
emit('crit', [foley('impactPunch_heavy', 2, .8, .22, .78, 2600),
    foley('impactWood_light', 4, .24, .13, 1.1, 3800)], rms=-21, peak_db=-7)
emit('kill', [foley('impactSoft_medium', 4, .7, .14, 1.03, 2300)], rms=-26, peak_db=-12)
emit('wall', [foley('impactPunch_heavy', 4, .7, .28, .62, 1700),
    foley('impactWood_heavy', 3, .45, .22, .74, 2400)], rms=-20, peak_db=-6.5)

# Stronger casts have a wider body and a small natural tail, never a high siren.
emit('snipe', [layer(W+'Crossbow Shoot.wav', .32, .26, .7, .74, 3600, 85, .07),
    foley('impactPunch_heavy', 3, .5, .27, .7, 1600), wind(.48, .75, .29, 4200)], rms=-18.2, peak_db=-5.5, tail=.06)
emit('bow_ult', [layer(W+'English Longbow Shoot.wav', .105, .22, .75, .85, 5000, 110, .08),
    wind(.6, .8, .34), wind(.19, 1.1, .21, 4600, .047),
    foley('impactSoft_heavy', 2, .3, .22, .8, 1700)], rms=-18.8, peak_db=-6, tail=.06)
emit('fire_skill', [flame(3, .7, .37, .82),
    foley('impactPunch_heavy', 2, .5, .24, .78, 1800), wind(.25, .8, .28, 3400)], rms=-19, peak_db=-6, tail=.06)
emit('thunder_skill', [foley('impactPunch_heavy', 2, .6, .26, .76, 2300),
    electric(0, .33, .12, .72), electric(1, .2, .08, .85, .055), wind(.3, .83, .28, 4000)], rms=-19, peak_db=-6, tail=.06)
emit('frost_skill', [foley('impactSoft_heavy', 1, .56, .28, .75, 2500),
    ice(1, .48, .25, .72), wind(.42, .88, .35, 5000)], rms=-19.5, peak_db=-6.5, tail=.06)
emit('skill', [wind(.6, .8, .32, 4800), foley('impactSoft_heavy', 2, .6, .25, .78, 2400)], rms=-19.5, peak_db=-6, tail=.06)
emit('fire_ult', [foley('impactPunch_heavy', 3, .78, .4, .56, 1700),
    flame(4, .7, .45, .7), flame(3, .2, .32, .85, .05), wind(.3, .65, .42, 3200)], rms=-17.8, peak_db=-5, tail=.09)
emit('thunder_ult', [foley('impactPunch_heavy', 4, .8, .4, .58, 2100),
    electric(0, .4, .13, .63), electric(1, .19, .1, .74, .06),
    wind(.45, .65, .46, 3600)], rms=-18, peak_db=-5, tail=.09)
emit('frost_ult', [foley('impactSoft_heavy', 4, .67, .4, .62, 2500),
    ice(2, .5, .28, .65), ice(3, .24, .20, .75, .045), wind(.5, .78, .48, 4800)], rms=-18.5, peak_db=-5.5, tail=.09)
emit('ult', [foley('impactPunch_heavy', 1, .8, .4, .6, 2200),
    wind(.5, .7, .43, 4200)], rms=-18, peak_db=-5, tail=.09)
emit('ready', [layer('kenney-ui/Audio/confirmation_001.ogg', seconds=.27,
                    gain=.8, rate=.88, low=4300, high=300, decay=.16)], rms=-24, peak_db=-10)

# Keep all previous music, UI and library credits; append this actual new pack.
shutil.copy2(IMPACTS/'License.txt', OUT/'Kenney-Impact-License.txt')
credits = (GAME/'docs/audio-upgrade-v1/CREDITS.txt').read_text(encoding='utf-8')
credits += ('\nCombat audio redesign v2\n'
    'Impact Sounds — Kenney (CC0)\nhttps://kenney.nl/assets/impact-sounds\n'
    'Additional modifications: transient selection, low-mid body layering, pitch, '
    'band limiting, resonance reduction, short shaped envelopes, family-level mixing.\n'
    'Original recordings and complete per-file edit recipes: docs/combat-audio-v2.\n')
(OUT/'CREDITS.txt').write_text(credits, encoding='utf-8')
(DEST/'CREDITS.txt').write_text(credits, encoding='utf-8')
import html
(GAME/'build-templates/web-mobile/audio-credits.html').write_text(
    '<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>音乐与音效鸣谢</title><style>body{margin:32px auto;max-width:760px;padding:0 20px;background:#192129;color:#f5e8cd;'
    'font:16px/1.7 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#a7d8ff}</style><h1>音乐与音效鸣谢</h1>'
    '<p>感谢以下音乐人与声音创作者。</p><pre>'+html.escape(credits)+
    '</pre><p><a href="javascript:history.back()">返回游戏</a></p></html>', encoding='utf-8')
(OUT/'assets.json').write_text(json.dumps(dict(version=2, files=manifest,
    sources=list(provenance.values()), method='licensed recordings, offline sound design; no paid generation'),
    ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(audioFiles=len(manifest), sources=len(provenance),
    bytes=sum(p.stat().st_size for p in DEST.glob('*.wav')))))
