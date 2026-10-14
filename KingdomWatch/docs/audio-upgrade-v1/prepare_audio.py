"""Produce the shipped mix from licensed source recordings, preserving provenance."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import wave
import numpy as np
import imageio_ffmpeg

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
RAW = Path(os.environ['TEMP']) / 'kingdom-watch-audio-source-v1'
DEST = GAME / 'assets/resources/audio/v1'
DEST.mkdir(parents=True, exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
manifest = []
copied = set()

PACKS = {
    'medieval': ('Ben Jaszczak & Brian Nelson / Still North Media', 'CC0-1.0', 'https://opengameart.org/content/medieval-sound-effects-weapon-textures'),
    'kenney-rpg': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/rpg-audio'),
    'kenney-ui': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/interface-sounds'),
    'kenney-jingles': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/music-jingles'),
    'rubberduck-rpg': ('rubberduck', 'CC0-1.0', 'https://opengameart.org/node/86018'),
    'ice-electric': ("Iwan 'qubodup' Gabovitch", 'CC-BY-3.0', 'https://opengameart.org/content/ice-electricity-magic'),
    'town.mp3': ('cynicmusic / pixelsphere.org', 'CC0-1.0', 'https://opengameart.org/content/town-theme-rpg'),
    'battle.mp3': ('cynicmusic / pixelsphere.org', 'CC0-1.0', 'https://opengameart.org/content/battle-theme-a'),
}

def source(rel):
    path = RAW / rel
    if rel not in copied:
        target = OUT / 'sources' / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        copied.add(rel)
    return path

def decode(rel, start=0, seconds=None, rate=1, filters='', stereo=False):
    command = [FFMPEG, '-v', 'error', '-i', str(source(rel))]
    if start: command += ['-ss', str(start)]
    if seconds is not None: command += ['-t', str(seconds)]
    chain = []
    if rate != 1: chain += [f'asetrate={SR * rate}', f'aresample={SR}']
    if filters: chain.append(filters)
    if chain: command += ['-af', ','.join(chain)]
    data = subprocess.check_output(command + ['-f', 'f32le', '-ac', '2' if stereo else '1', '-ar', str(SR), '-'])
    result = np.frombuffer(data, np.float32).copy()
    return result.reshape(-1, 2) if stereo else result

def soften(a, attack=.002, release=.035):
    a = a.copy()
    n = min(int(attack * SR), len(a) // 3)
    m = min(int(release * SR), len(a) // 2)
    if n: a[:n] *= np.linspace(0, 1, n)
    if m: a[-m:] *= np.linspace(1, 0, m) ** 1.3
    return a

def layer(rel, start=0, seconds=.3, gain=1, delay=0, rate=1, filters='highpass=f=65,lowpass=f=12500'):
    a = decode(rel, start, seconds, rate, filters)
    a -= a.mean()
    peak = float(np.max(np.abs(a)))
    if peak: a *= gain / peak
    return soften(a), delay, {'source': rel, 'start': start, 'seconds': seconds, 'gain': gain, 'delay': delay, 'rate': rate, 'filters': filters}

def emit(name, layers, tail=False, rms=-17):
    n = max(len(a) + int(delay * SR) for a, delay, _ in layers)
    a = np.zeros(n + (int(.11 * SR) if tail else 0), np.float32)
    for sample, delay, _ in layers:
        at = int(delay * SR)
        a[at:at+len(sample)] += sample
    if tail:
        dry = a.copy()
        for delay, gain in [(.037, .10), (.079, .045)]:
            d = int(delay * SR)
            a[d:] += dry[:-d] * gain
    active = a[np.abs(a) > max(.001, float(np.max(np.abs(a))) * .025)]
    if len(active):
        a *= 10 ** (rms / 20) / max(float(np.sqrt(np.mean(active ** 2))), .0001)
    peak = float(np.max(np.abs(a)))
    if peak > .708: a *= .708 / peak
    a = soften(a, .001, .018)
    target = DEST / (name + '.wav')
    with wave.open(str(target), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype('<i2').tobytes())
    manifest.append({'file': target.name, 'seconds': round(len(a)/SR, 6), 'peakDBFS': round(20*np.log10(max(float(np.max(np.abs(a))), 1e-9)), 2),
        'layers': [meta for _, _, meta in layers], 'shortRoomTail': tail, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})

W = 'medieval/'
K = 'kenney-rpg/Audio/'
U = 'kenney-ui/Audio/'
R = 'rubberduck-rpg/'
E = 'ice-electric/qubodupIceAndElectricitySpells/'
J = 'kenney-jingles/Audio/Pizzicato jingles/'
for i, at in enumerate([.095, .435, .765], 1):
    emit(f'bow_{i}', [layer(W+'English Longbow Shoot.wav', at, .24), layer(W+'Scythian Recurve Arrow Pass.wav', .08, .18, .13, .012)], rms=-18)
for i, at in enumerate([.31, .83, 1.40], 1):
    emit(f'crossbow_{i}', [layer(W+'Crossbow Shoot.wav', at, .28, 1, rate=.93), layer(K+'metalLatch.ogg', 0, .16, .21, .035)], rms=-17)
for i in range(1, 4):
    emit(f'fire_{i}', [layer(R+f'spell_fire_{i:02}.ogg', 0, .35, 1, rate=1.05), layer(W+'Crossbow Bolt Pass.wav', .05, .17, .13)], tail=True, rms=-19)
for i in range(1, 3):
    emit(f'thunder_{i}', [layer(E+f'qubodupElectricityDamage0{i}.flac', 0, .27, filters='highpass=f=160,lowpass=f=8000')], tail=True, rms=-19)
    emit(f'frost_{i}', [layer(E+f'qubodupIceDamage0{i}.flac', 0, .34, .85), layer(U+f'glass_00{i}.ogg', 0, .19, .22, .015, 1.1)], tail=True, rms=-19)
    emit(f'zap_hit_{i}', [layer(E+f'qubodupElectricityDamage0{i}.flac', .12, .16, rate=.9)], rms=-20)
    emit(f'icebreak_{i}', [layer(E+['qubodupIceDamage03.flac', 'qubodupIceDamage03b.flac'][i-1], 0, .25), layer(U+'glass_003.ogg', 0, .18, .28)], rms=-20)
    emit(f'hit_{i}', [layer(R+f'blade_0{i}.ogg', 0, .18, 1), layer(K+'chop.ogg', 0, .14, .33)], rms=-20)
    emit(f'crush_{i}', [layer(R+f'spell_fire_0{i+3}.ogg', 0, .26, .85, rate=.86), layer(R+f'stones_0{i}.ogg', 0, .22, .26)], rms=-19)
    emit(f'ui_click_{i}', [layer(U+f'click_00{i+2}.ogg', 0, .12)], rms=-23)
emit('crit', [layer(R+'blade_03.ogg', 0, .24), layer(K+'metalPot2.ogg', 0, .18, .24)], rms=-18)
emit('pierce', [layer(R+'blade_02.ogg', 0, .22, rate=.82), layer(K+'chop.ogg', 0, .14, .4)], rms=-18)
emit('kill', [layer(R+'creature_die_01.ogg', 0, .28, .8), layer(K+'dropLeather.ogg', 0, .16, .22)], rms=-24)
emit('wall', [layer(R+'stones_03.ogg', 0, .35, 1, rate=.78), layer(K+'metalPot1.ogg', 0, .22, .32)], rms=-17)
emit('snipe', [layer(W+'Crossbow Shoot.wav', .31, .32, 1, rate=.78), layer(W+'Crossbow Bolt Passby.wav', .08, .25, .38, .012)], tail=True, rms=-16)
emit('skill', [layer(R+'spell_01.ogg', 0, .48), layer(U+'glass_006.ogg', 0, .26, .28, .025)], tail=True, rms=-19)
emit('ult', [layer(R+'spell_fire_07.ogg', 0, .65, .85, rate=.77), layer(E+'qubodupElectricityDamage02.flac', 0, .43, .30, .03), layer(R+'stones_04.ogg', 0, .33, .3)], tail=True, rms=-16)
emit('levelup', [layer(J+'jingles_PIZZI01.ogg', 0, 1.8)], rms=-19)
emit('ready', [layer(U+'confirmation_002.ogg', 0, .55), layer(U+'glass_002.ogg', 0, .26, .22, .06)], tail=True, rms=-20)
emit('surge', [layer(J+'jingles_PIZZI15.ogg', 0, 1.6, rate=.78)], rms=-20)
emit('victory', [layer(J+'jingles_PIZZI00.ogg', 0, 3.2)], rms=-18)
emit('defeat', [layer(J+'jingles_PIZZI10.ogg', 0, 2.6, rate=.94)], rms=-20)
emit('ui_confirm', [layer(U+'confirmation_001.ogg', 0, .3)], rms=-21)
emit('bow_ult', [layer(W+'English Longbow Shoot.wav', .095, .24, .8), layer(W+'English Longbow Shoot.wav', .435, .24, .7, .055), layer(W+'Scythian Recurve Arrow Pass.wav', .08, .3, .3, .04)], tail=True, rms=-17)
emit('fire_skill', [layer(R+'spell_fire_04.ogg', 0, .6), layer(R+'stones_01.ogg', 0, .22, .18, .04)], tail=True, rms=-18)
emit('frost_skill', [layer(E+'qubodupIceDamage03b.flac', 0, .55), layer(U+'glass_006.ogg', 0, .26, .25, .04)], tail=True, rms=-18)
emit('fire_ult', [layer(R+'spell_fire_07.ogg', 0, .8, 1, rate=.8), layer(R+'stones_04.ogg', 0, .4, .35, .06)], tail=True, rms=-16)
emit('thunder_ult', [layer(E+'qubodupElectricityDamage02.flac', 0, .6, 1, rate=.78), layer(R+'stones_03.ogg', 0, .35, .23, .03)], tail=True, rms=-16)
emit('frost_ult', [layer(E+'qubodupIceDamage03c.flac', 0, .7, 1, rate=.84), layer(U+'glass_006.ogg', 0, .4, .3, .07)], tail=True, rms=-17)

for name, rel in [('bgm_camp', 'town.mp3'), ('bgm_battle', 'battle.mp3')]:
    a = decode(rel, stereo=True)
    # Remove encoder silence, then join the end into the beginning with one fixed overlap.
    energy = np.max(np.abs(a), axis=1)
    active = np.flatnonzero(energy > .002)
    a = a[max(0, active[0]-int(.01*SR)):min(len(a), active[-1]+int(.06*SR))]
    overlap = int(.7*SR)
    q = np.linspace(0, 1, overlap)[:, None]
    join = a[-overlap:] * np.cos(q*np.pi/2) + a[:overlap] * np.sin(q*np.pi/2)
    a = np.concatenate([a[overlap:-overlap], join]).astype('<f4')
    target = DEST / (name+'.mp3')
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-',
        '-af', 'loudnorm=I=-18:TP=-2:LRA=10', '-ar', str(SR), '-codec:a', 'libmp3lame', '-b:a', '192k', str(target)], input=a.tobytes(), check=True)
    manifest.append({'file': target.name, 'source': rel, 'title': 'Town Theme RPG' if name.endswith('camp') else 'Battle Theme A',
        'secondsBeforeEncode': round(len(a)/SR, 6), 'loopOverlapSeconds': .7, 'loudnessTargetLUFS': -18, 'encoding': 'stereo MP3 192kbps 44.1kHz',
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})

licensing = []
for rel in sorted(copied):
    author, license_id, page = PACKS[rel.split('/')[0]]
    licensing.append({'source': rel, 'author': author, 'license': license_id, 'page': page,
        'sha256': hashlib.sha256((RAW/rel).read_bytes()).hexdigest()})
(OUT/'assets.json').write_text(json.dumps({'files': manifest, 'sources': licensing}, ensure_ascii=False, indent=2), encoding='utf-8')
credits = """Kingdom Watch audio credits
==========================
Town Theme RPG / Battle Theme A — cynicmusic, cynicmusic.com / pixelsphere.org (CC0)
https://opengameart.org/content/town-theme-rpg
https://opengameart.org/content/battle-theme-a
Medieval Weapon Textures — Ben Jaszczak & Brian Nelson / Still North Media (CC0)
https://opengameart.org/content/medieval-sound-effects-weapon-textures
RPG Audio, Interface Sounds, Music Jingles — Kenney (CC0)
https://kenney.nl/assets/rpg-audio
https://kenney.nl/assets/interface-sounds
https://kenney.nl/assets/music-jingles
80 CC0 RPG SFX — rubberduck (CC0)
https://opengameart.org/node/86018
Ice and Electricity Magic — Iwan 'qubodup' Gabovitch (CC BY 3.0)
https://opengameart.org/users/qubodup
https://opengameart.org/content/ice-electricity-magic
https://creativecommons.org/licenses/by/3.0/
Modifications: selected excerpts, layering, EQ, resampling/pitch, short room tails,
normalization, fades and music loop overlaps. No endorsement is implied.
CC0: https://creativecommons.org/publicdomain/zero/1.0/
"""
(DEST/'CREDITS.txt').write_text(credits, encoding='utf-8')
(OUT/'CREDITS.txt').write_text(credits, encoding='utf-8')
import html
(GAME/'build-templates/web-mobile/audio-credits.html').write_text('<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>音乐与音效鸣谢</title><style>body{margin:32px auto;max-width:760px;padding:0 20px;background:#192129;color:#f5e8cd;font:16px/1.7 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#a7d8ff}</style><h1>音乐与音效鸣谢</h1><p>感谢以下音乐人与声音创作者。</p><pre>'+html.escape(credits)+'</pre><p><a href="javascript:history.back()">返回游戏</a></p></html>', encoding='utf-8')
print(json.dumps({'audioFiles': len(manifest), 'sources': len(licensing), 'totalBytes': sum(p.stat().st_size for p in DEST.glob('*'))}))
