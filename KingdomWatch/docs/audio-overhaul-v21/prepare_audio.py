"""Offline, reproducible sample editing. Never plays audio or executes the game.

Use authored jingles / recorded foley, not generated oscillator melodies. Each
render retains its source recipe, crest factor and a click-free natural tail.
"""
from pathlib import Path
import hashlib
import html
import json
import os
import shutil
import subprocess
import uuid
import wave
import imageio_ffmpeg
import numpy as np

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
DEST = ROOT / 'assets/resources/audio/v21'
SOURCES = OUT / 'sources'
RAW = Path(os.environ['TEMP']) / 'kingdom-watch-audio-source-v1'
IMPACTS = Path(os.environ['TEMP']) / 'kw-kenney-impact-sounds'
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
manifest, provenance, cache = [], {}, {}
DEST.mkdir(parents=True, exist_ok=True)

def meta(path, audio=False):
    target = Path(str(path) + '.meta')
    if target.exists():
        return
    target.write_text(json.dumps(dict(ver='1.0.0' if audio else '1.2.0',
        importer='audio-clip' if audio else 'directory', imported=True,
        uuid=str(uuid.uuid4()), files=['.json', '.wav'] if audio else [],
        subMetas={}, userData={'downloadMode': 0} if audio else {}), indent=2), encoding='utf-8')

meta(DEST)
LICENSES = {
    'little-robot': ('Little Robot Sound Factory', 'CC-BY-3.0', 'https://opengameart.org/content/fantasy-sound-effects-library'),
    'kenney-impact': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/impact-sounds'),
    'kenney-rpg': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/rpg-audio'),
    'kenney-ui': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/interface-sounds'),
    'kenney-jingles': ('Kenney', 'CC0-1.0', 'https://kenney.nl/assets/music-jingles'),
    'medieval': ('Ben Jaszczak & Brian Nelson / Still North Media', 'CC0-1.0', 'https://opengameart.org/content/medieval-sound-effects-weapon-textures'),
    'rubberduck-rpg': ('rubberduck', 'CC0-1.0', 'https://opengameart.org/node/86018'),
    'ice-electric': ("Iwan 'qubodup' Gabovitch", 'CC-BY-3.0', 'https://opengameart.org/content/ice-electricity-magic'),
}

def source(rel):
    path = SOURCES / rel
    if not path.exists():
        candidates = [ROOT / 'docs/combat-audio-v2/sources' / rel,
                      ROOT / 'docs/audio-upgrade-v1/sources' / rel, RAW / rel,
                      IMPACTS / rel.removeprefix('kenney-impact/')]
        original = next(p for p in candidates if p.exists())
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, path)
    if rel not in provenance:
        author, license_id, page = LICENSES[rel.split('/')[0]]
        provenance[rel] = dict(source=rel, author=author, license=license_id, page=page,
                              sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return path

def fade(a, attack=.001, release=.035, decay=0):
    a = a.copy()
    if decay:
        a *= np.exp(-np.arange(len(a)) / (SR * decay))
    n, m = min(round(SR*attack), len(a)//3), min(round(SR*release), len(a)//2)
    if n: a[:n] *= np.sin(np.linspace(0, np.pi/2, n))**2
    if m: a[-m:] *= np.cos(np.linspace(0, np.pi/2, m))**2
    return a

def layer(rel, start=0, seconds=None, gain=1, rate=1, low=10500, high=70,
          decay=0, delay=0, attack=.001, release=.04, tempo=1, reverse=False):
    key = (rel, start, seconds, rate, low, high, tempo, reverse)
    if key not in cache:
        filters = f'aresample={SR},asetrate={round(SR*rate)},aresample={SR},atempo={tempo},highpass=f={high}:p=2,lowpass=f={low}:p=2'
        if reverse: filters += ',areverse'
        cmd = [FF, '-v', 'error', '-ss', str(start), '-i', str(source(rel))]
        if seconds is not None: filters += f',atrim=duration={seconds}'
        raw = subprocess.check_output(cmd + ['-af', filters, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'])
        a = np.frombuffer(raw, np.float32).astype(np.float64)
        if not len(a): raise ValueError(f'Empty source cut: {key}')
        a -= a.mean()
        peak = float(np.max(np.abs(a)))
        active = np.flatnonzero(abs(a) > max(peak*.002, .00001))
        if len(active):
            a = a[max(0, active[0]-88):min(len(a), active[-1]+round(.075*SR))]
        a /= max(float(np.max(np.abs(a))), 1e-8)
        cache[key] = a
    a = fade(cache[key], attack, release, decay) * gain
    return a, delay, dict(source=rel, sourceStart=start, renderDuration=seconds,
        gain=gain, rate=rate, tempo=tempo, lowpassHz=low, highpassHz=high,
        decaySeconds=decay, delaySeconds=delay, attackSeconds=attack,
        releaseSeconds=release, reversed=reverse)

def emit(name, layers, rms=-20, peak=-5, room=0):
    n = max(len(a)+round(delay*SR) for a, delay, _ in layers)
    a = np.zeros(n+round(room*SR), np.float64)
    for sample, delay, _ in layers:
        i = round(delay*SR); a[i:i+len(sample)] += sample
    if room:
        dry = a.copy()
        for sec, weight in [(.043,.075),(.079,.035),(.113,.015)]:
            i = round(sec*SR)
            if i < len(a): a[i:] += dry[:-i]*weight
    a -= a.mean()
    blocks = np.array([np.mean(a[i:i+441]**2) for i in range(0,len(a),441)])
    active = blocks > max(blocks.max()*.008, 1e-10)
    energy = np.sqrt(np.mean(blocks[active]))
    a *= 10**(rms/20)/max(energy,1e-8)
    ceiling = 10**(peak/20)
    # A needle-like recording peak must not turn down the entire body by 10 dB.
    # Bound offline lookahead reduction to 6 dB, preserving the initial transient
    # while leaving a fuller, consistent material body. No runtime loudness boost.
    maximum = max(float(np.max(abs(a))),1e-8)
    a *= min(1,ceiling*10**(6/20)/maximum)
    reduction = max(0,20*np.log10(max(float(np.max(abs(a))),1e-8)/ceiling))
    if reduction > .001:
        raw = subprocess.check_output([FF,'-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-',
            '-af',f'alimiter=limit={ceiling}:attack=2:release=55:level=false:latency=true',
            '-f','f32le','-ac','1','-ar',str(SR),'-'],input=a.astype('<f4').tobytes())
        a = np.frombuffer(raw,np.float32).astype(np.float64)
    a = fade(a,.0008,.025)
    pcm = np.round(a*32767).astype('<i2')
    target = DEST/(name+'.wav')
    with wave.open(str(target),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    meta(target,True)
    peak_actual = float(np.max(abs(a)))
    manifest.append(dict(file=target.name, seconds=round(len(a)/SR,4),
        peakDBFS=round(20*np.log10(max(peak_actual,1e-9)),2),
        rmsDBFS=round(20*np.log10(max(float(np.sqrt(np.mean(a*a))),1e-9)),2),
        crestDB=round(20*np.log10(max(peak_actual,1e-9)/max(float(np.sqrt(np.mean(a*a))),1e-9)),2),
        dc=round(float(a.mean()),8), maxOfflinePeakReductionDB=round(reduction,2),
        clippedSamples=int(np.count_nonzero(abs(pcm.astype(np.int32))>=32767)),
        firstSample=int(pcm[0]),lastSample=int(pcm[-1]), layers=[p for _,_,p in layers],
        sha256=hashlib.sha256(target.read_bytes()).hexdigest()))

W='medieval/'
I='kenney-impact/Audio/'
R='rubberduck-rpg/'
K='kenney-rpg/Audio/'
E='ice-electric/qubodupIceAndElectricitySpells/'
L='little-robot/Fantasy Sound Library/Wav/'

def body(i=0,gain=.5,seconds=.22,rate=.85,delay=0,kind='impactPunch_heavy'):
    return layer(I+f'{kind}_{i%5:03}.ogg',seconds=seconds,gain=gain,rate=rate,
                 low=4600,high=85,delay=delay,decay=.17)
def wind(gain=.35,seconds=.3,rate=1,delay=0):
    return layer(W+'Scythian Recurve Arrow Pass.wav',start=.06,seconds=seconds,
                 gain=gain,rate=rate,high=350,low=10500,delay=delay,release=.055)
def fire(i=0,gain=.6,seconds=.42,rate=.95,delay=0):
    return layer(R+f'spell_fire_{[1,2,3,4,7][i%5]:02}.ogg',start=.12,
                 seconds=seconds,gain=gain,rate=rate,low=8000,high=110,decay=.32,delay=delay)
def spark(i=0,gain=.35,seconds=.19,rate=.95,delay=0):
    return layer(E+f'qubodupElectricityDamage0{1+i%2}.flac',start=.145,
                 seconds=seconds,gain=gain,rate=rate,low=6800,high=460,decay=.10,delay=delay)
def ice(i=0,gain=.45,seconds=.32,rate=.9,delay=0):
    return layer(I+f'impactGlass_light_{i%5:03}.ogg',seconds=seconds,gain=gain,
                 rate=rate,low=9200,high=250,decay=.20,delay=delay)
def gold(i=0,gain=.3,delay=0,rate=1):
    return layer(L+f'Pickup_Gold_{i%5:02}.wav',gain=gain,delay=delay,rate=rate,high=220,low=10000)
def spell(i=0,gain=.4,seconds=.7,delay=0,rate=1):
    return layer(L+f'Spell_{i:02}.wav',seconds=seconds,gain=gain,rate=rate,
                 high=180,low=8500,attack=.008,release=.12,delay=delay)

# The firing transient and the target's impact have separate timbres and budgets.
for i,at in enumerate([.105,.443,.77],1):
    emit(f'bow_{i}',[layer(W+'English Longbow Shoot.wav',at,.32,.95,
        rate=.98+(i-2)*.02,high=100,low=11000),wind(.22,.26,1.08,.008)],rms=-19.8,peak=-5.6)
for i,at in enumerate([.32,.834,1.41],1):
    emit(f'crossbow_{i}',[layer(W+'Crossbow Shoot.wav',at,.36,.88,
        rate=.90+(i-2)*.018,low=9500,high=85),body(i-1,.3,.22,.86),
        wind(.2,.3,.91,.009)],rms=-18.8,peak=-5)
for i in range(1,4):
    emit(f'fire_{i}',[fire(i-1,.85,.34,1+(i-2)*.025),body(i-1,.22,.18,.85),wind(.12,.22)],rms=-20,peak=-6)
    emit(f'thunder_{i}',[spark(i-1,.6,.19),body(i-1,.45,.20,.9),spark(i,.14,.10,1.13,.036)],rms=-20.3,peak=-6)
    emit(f'frost_{i}',[ice(i-1,.6,.27,1+(i-2)*.025),wind(.3,.31,1.06),
        body(i-1,.22,.17,.98,kind='impactSoft_medium')],rms=-21,peak=-6.5)
    emit(f'hit_{i}',[body(i-1,.8,.21,1,kind='impactPunch_medium'),
        layer(I+f'impactWood_light_{i-1:03}.ogg',seconds=.12,gain=.19,high=550,low=7000)],rms=-22,peak=-7.5)
    emit(f'pierce_{i}',[body(i-1,.8,.25,.86),body(i-1,.27,.16,.98,kind='impactWood_medium')],rms=-21.5,peak=-7)
    emit(f'crush_{i}',[body(i-1,.8,.27,.77),fire(i-1,.38,.29,.84,.007)],rms=-21.5,peak=-7)
    emit(f'zap_hit_{i}',[body(i-1,.7,.19,.95,kind='impactPunch_medium'),spark(i-1,.38,.13,.9)],rms=-22.5,peak=-8)
    emit(f'icebreak_{i}',[body(i-1,.64,.22,.88,kind='impactSoft_heavy'),ice(i-1,.6,.25,.84)],rms=-22,peak=-7.5)

emit('pierce_heavy',[body(3,.85,.35,.70),wind(.25,.32,.78),body(3,.35,.25,.84,kind='impactWood_medium')],-19,-5)
emit('fire_heavy',[body(3,.8,.38,.65),fire(4,.65,.55,.76)],-19.5,-5,room=.10)
emit('thunder_heavy',[body(4,.85,.34,.7),spark(1,.5,.23,.74),spark(0,.2,.13,1.1,.055)],-20,-5.5)
emit('frost_heavy',[body(4,.65,.32,.74,kind='impactSoft_heavy'),ice(3,.65,.42,.72),ice(4,.25,.24,1.13,.03)],-20,-5.5,room=.08)
emit('crit',[body(2,.9,.30,.8),ice(1,.2,.16,1.2),wind(.18,.25)],-20,-5.5)
emit('wall',[body(4,.8,.4,.61),body(3,.5,.35,.72,kind='impactWood_heavy')],-19.5,-5.5)

# Casts have a strong first transient, wider material body and natural tail.
emit('snipe',[layer(W+'Crossbow Shoot.wav',.32,.50,.9,.76,10500,75),body(3,.52,.36,.7),wind(.45,.49,.8)],-17.8,-4.5,room=.12)
emit('skill',[wind(.8,.48,.9),body(2,.4,.3,.85,kind='impactSoft_heavy'),spell(0,.22,.72,delay=.03)],-19,-5,room=.10)
emit('bow_ult',[layer(W+'English Longbow Shoot.wav',.105,.42,.8,.88),
    wind(.75,.65,.78),wind(.33,.4,1.12,.065),body(2,.35,.36,.76)],-18,-4.5,room=.14)
emit('fire_skill',[fire(3,.8,.72,.85),body(2,.55,.35,.73),wind(.24,.5,.8)],-18.6,-4.8,room=.12)
emit('thunder_skill',[body(2,.7,.34,.73),spark(0,.55,.26,.78),spark(1,.25,.21,1.04,.07),spell(1,.18,.65,.025)],-19,-5,room=.10)
emit('frost_skill',[ice(1,.75,.54,.72),wind(.45,.64,.92),body(1,.48,.35,.74,kind='impactSoft_heavy')],-19,-5,room=.12)
emit('fire_ult',[body(3,.9,.58,.56),fire(4,.85,1.0,.71),fire(3,.27,.65,.92,.08),wind(.32,.65,.7)],-17,-4,room=.16)
emit('thunder_ult',[body(4,.85,.56,.58),spark(0,.65,.4,.69),spark(1,.33,.24,.94,.11),
    spell(1,.25,.95,.04,.85),wind(.34,.64,.7)],-17.4,-4.2,room=.16)
emit('frost_ult',[body(4,.8,.5,.6,kind='impactSoft_heavy'),ice(2,.8,.7,.63),ice(3,.38,.46,.91,.07),
    wind(.5,.85,.76)],-17.6,-4.2,room=.16)
emit('ult',[body(1,.85,.55,.62),wind(.65,.75,.7),spell(0,.3,.95,.03,.9)],-17.5,-4.5,room=.14)
emit('charge',[layer(L+'Spell_00.wav',seconds=.70,gain=.7,reverse=True,attack=.07,release=.015),
    wind(.25,.54,.9)],-24,-9)

# Distinct, short death materials; no human cries or repeated long monster screams.
for i in range(1,4):
    emit(f'physical_{i}',[body(i-1,.8,.25,.82,kind='impactSoft_heavy'),body(i-1,.2,.19,.86,kind='impactWood_light')],-24,-8.5)
    emit(f'fire_death_{i}',[body(i-1,.7,.25,.78,kind='impactSoft_heavy'),fire(i-1,.35,.33,.85)],-24,-8.5)
    emit(f'volt_death_{i}',[body(i-1,.7,.24,.82,kind='impactSoft_heavy'),spark(i-1,.35,.17,.84)],-24,-8.5)
    emit(f'frost_death_{i}',[body(i-1,.65,.26,.78,kind='impactSoft_heavy'),ice(i-1,.5,.30,.85)],-24,-8.5)
    emit(f'heavy_{i}',[body(i-1,.85,.35,.66),body(i-1,.25,.23,.82,kind='impactWood_heavy')],-22.5,-7)

# Card entrance / refresh / choice each has a different material and landing.
emit('pick_open',[layer(K+'bookOpen.ogg',seconds=.40,gain=.6),
    layer(L+'Inventory_Open_01.wav',seconds=.78,gain=.6,delay=.025),wind(.12,.4)],-22,-7,room=.08)
emit('pick_refresh',[layer(K+'bookFlip2.ogg',seconds=.3,gain=.7),
    layer(K+'bookFlip3.ogg',seconds=.25,gain=.4,rate=1.1,delay=.07)],-23,-8)
emit('pick_choose',[layer(L+'Menu_Select_00.wav',gain=.5),spell(1,.65,.65),gold(2,.2,.045)],-18.5,-5,room=.10)
emit('levelup',[spell(0,.6,.68),gold(3,.25,.12),gold(2,.3,.20)],-22,-7,room=.10)
emit('ready',[layer(L+'Menu_Select_00.wav',gain=.6,rate=.92)],-23,-8)
emit('surge',[layer(L+'Trap_01.wav',gain=.6,seconds=.7,rate=.8),wind(.45,.6,.8)],-20,-6,room=.08)

# Keep the authored win/loss phrases complete; tempo edits preserve musical pitch.
emit('victory',[layer(L+'Jingle_Win_00.wav',tempo=1.28,gain=1,high=65,low=14500,release=.20)],-17,-4)
emit('defeat',[layer(L+'Jingle_Lose_00.wav',tempo=1.16,gain=1,high=75,low=12500,release=.23)],-20,-5)
emit('reward',[layer(L+'Jingle_Achievement_00.wav',tempo=1.18,gain=.85,high=90,low=14000),
    layer(K+'handleCoins2.ogg',gain=.2,seconds=.42,delay=.08)],-18,-4.5)
emit('purchase',[layer(K+'handleCoins.ogg',gain=.48,seconds=.65),
    layer(L+'Inventory_Open_00.wav',gain=.5,delay=.07),gold(0,.38,.12),gold(2,.2,.23)],-19.2,-5,room=.12)
emit('growth',[spell(0,.6,.9,rate=1.12),gold(2,.25,.08),gold(0,.35,.15)],-18.5,-5,room=.12)
emit('growth_tick',[layer(L+'Menu_Select_00.wav',gain=.45),gold(2,.7,.012)],-23,-8.5)
emit('growth_land',[gold(0,.8),gold(3,.25,.04,1.12)],-24,-8.5,room=.08)
emit('reward_land',[gold(1,.6),gold(0,.55,.045),gold(2,.38,.095)],-24,-9,room=.08)
emit('breakthrough',[layer(L+'Jingle_Achievement_00.wav',tempo=1.32,gain=.8,rate=1.05946,low=14000),
    wind(.18,.5),body(2,.18,.35,.78)],-17.5,-4.5,room=.12)
emit('recruit',[layer(L+'Jingle_Achievement_00.wav',tempo=1.03,gain=.8,high=90,low=14000),
    layer(K+'bookOpen.ogg',gain=.13,seconds=.35),spell(0,.2,.8)],-18,-4.5,room=.12)
emit('construction',[body(3,.4,.34,.8,kind='impactWood_heavy'),
    body(1,.2,.26,1.05,delay=.10,kind='impactWood_medium'),
    layer(L+'Jingle_Achievement_00.wav',tempo=1.24,gain=.75,delay=.045,high=100,low=14000)],-18.2,-4.5)
emit('star',[gold(1,.4),ice(0,.18,.18,1.2)],-25,-9)
emit('star_finish',[gold(0,.6),ice(2,.18,.21,1.12)],-23.5,-8)
emit('loot_drop',[layer(L+'Inventory_Open_00.wav',gain=.65,rate=1.08),gold(3,.3,.05)],-25,-9)
emit('loot_pickup',[gold(0,.65),layer(K+'handleSmallLeather.ogg',gain=.25,seconds=.25)],-23,-8)

credits = (OUT/'before/audio-credits.html.txt').read_text(encoding='utf-8-sig')
extra = '''<h2>音效重制 v21</h2><p>Fantasy Sound Effects Library —
<a href="https://www.littlerobotsoundfactory.com/">Little Robot Sound Factory</a>，
<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>。
<a href="https://opengameart.org/content/fantasy-sound-effects-library">原始素材与作者授权</a>。
本游戏进行了裁切、调速、滤波、录音叠层、包络、混音和响度调整；作者未参与或认可这些修改。</p>
<p>另使用既有已署名的 Kenney CC0、Still North Media CC0、rubberduck CC0、
qubodup CC BY 3.0 素材。完整来源、原文件散列与逐条制作参数保存在项目
docs/audio-overhaul-v21/assets.json。背景音乐沿用原版。</p>'''
credits = credits.replace('</body>',extra+'</body>') if '</body>' in credits else credits.replace('</html>',extra+'</html>')
(ROOT/'build-templates/web-mobile/audio-credits.html').write_text(credits,encoding='utf-8')
(OUT/'CREDITS.txt').write_text('Audio overhaul v21\n'+ '\n'.join(f'{v[0]} — {v[1]}\n{v[2]}' for v in LICENSES.values())+
    '\nLittle Robot Sound Factory: https://www.littlerobotsoundfactory.com/\nCC BY 3.0: https://creativecommons.org/licenses/by/3.0/\n'
    'Modifications: source cuts, tempo/pitch, filtering, material layering, envelopes, dynamics. No endorsement.\n',encoding='utf-8')
(OUT/'assets.json').write_text(json.dumps(dict(version=21,sampleRate=SR,files=manifest,
    sources=list(provenance.values()),synthesis=False,audioAudition=False),ensure_ascii=False,indent=2),encoding='utf-8')
assert all(f['clippedSamples']==0 and f['firstSample']==0 and f['lastSample']==0 for f in manifest)
print(json.dumps(dict(files=len(manifest),sources=len(provenance),bytes=sum(p.stat().st_size for p in DEST.glob('*.wav')))))
