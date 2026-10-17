"""v24: deterministic recorded-foley editing and original sampled orchestration.

No synthesized oscillator cues, audio playback, game execution, or AI training.
All commercial-use source rights remain with their recording authors.
"""
from pathlib import Path
from functools import lru_cache
from datetime import datetime
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import uuid
import wave
import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEST = ROOT/'assets/resources/audio/v24'
PREV = ROOT/'docs/audio-representatives-r1'
SR = 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = json.loads((HERE/'sources.json').read_text(encoding='utf8'))
MANIFEST = []
USED = {}
CHANGED = ['assets/scripts/core/AudioCatalog.ts', 'assets/resources/audio/README.txt',
           'assets/resources/audio/v1/CREDITS.txt', 'build-templates/web-mobile/audio-credits.html']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, data):
    (HERE/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')

def snapshot():
    if (HERE/'before.json').exists():
        raise RuntimeError('Snapshot already exists')
    for rel in CHANGED:
        out = HERE/'before'/rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT/rel, out)
    paths = list((ROOT/'assets/scripts').rglob('*.ts')) + list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json', {p.relative_to(ROOT).as_posix():sha(p) for p in paths if p.is_file()})
    print('Pre-change source/audio snapshot saved')

def add(key, rel, author, license, url):
    SOURCE[key] = dict(path=rel, author=author, license=license, url=url)

OLD = 'docs/audio-overhaul-v21/sources/'
add('bow', OLD+'medieval/English Longbow Shoot.wav', 'Ben Jaszczak & Brian Nelson / Still North Media', 'CC0-1.0', 'https://opengameart.org/content/medieval-sound-effects-weapon-textures')
add('crossbow', OLD+'medieval/Crossbow Shoot.wav', 'Ben Jaszczak & Brian Nelson / Still North Media', 'CC0-1.0', 'https://opengameart.org/content/medieval-sound-effects-weapon-textures')
for n in [1,2,3,4,7]:
    add('flame'+str(n), OLD+f'rubberduck-rpg/spell_fire_{n:02}.ogg', 'rubberduck', 'CC0-1.0', 'https://opengameart.org/node/86018')
for key, file in [('book','bookOpen'),('page','bookFlip2'),('page2','bookFlip3')]:
    add(key, OLD+f'kenney-rpg/Audio/{file}.ogg','Kenney','CC0-1.0','https://kenney.nl/assets/rpg-audio')
INSTRUMENTS = {
    'marimba': [(72,'Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav'),(79,'Percussion/Marimba/Marimba_hit_Outrigger_G4_loud_01.wav')],
    'glock': [(84,'Percussion/Glock/glock_medium_C5.wav'),(91,'Percussion/Glock/glock_medium_G5.wav')],
    'harp': [(69,'Strings/Harp/KSHarp_A4_mf.wav'),(72,'Strings/Harp/KSHarp_C5_mf.wav'),(76,'Strings/Harp/KSHarp_E5_mf.wav')],
    'trumpet': [(60,'Brass/Trumpet/stac/Sum_SHTrumpet_stac_C3_v3_rr1.wav'),(67,'Brass/Trumpet/stac/Sum_SHTrumpet_stac_G3_v3_rr1.wav'),(74,'Brass/Trumpet/stac/Sum_SHTrumpet_stac_D4_v3_rr1.wav')],
    'trumpet-long': [(67,'Brass/Trumpet/sus/Sum_SHTrumpet_sus_G3_v3_rr1.wav')],
    'horn': [(60,'Brass/F Horn/sus/MOHorn_sus_C3_v2_1.wav')],
    'bassoon': [(60,'Woodwinds/Bassoon/stac/PSBassoon_C3_v1_rr1.wav'),(55,'Woodwinds/Bassoon/stac/PSBassoon_G2_v1_rr1.wav')],
}
for inst, entries in INSTRUMENTS.items():
    for midi, rel in entries:
        add(rel, 'docs/audio-representatives-r1/sources/VSCO2CE/'+rel,
            'Versilian Studios / Sam Gossner and contributors','CC0-1.0','https://github.com/sgossner/VSCO-2-CE')
for key, rel in [('timpani','Percussion/Timpani/Timpani2_Hit_v3_rr1_Sum.wav'),('snare','Percussion/Snare2-HitSN_v3_rr1_Sum.wav'),('cymbal','Percussion/cymbal-crashshort_v1.wav')]:
    add(key, 'docs/audio-representatives-r1/sources/VSCO2CE/'+rel,'Versilian Studios / Sam Gossner and contributors','CC0-1.0','https://github.com/sgossner/VSCO-2-CE')

@lru_cache(maxsize=96)
def decode(key, high=70, low=11500):
    record = SOURCE[key]
    path = ROOT/record['path']
    USED[key] = dict(record, sha256=sha(path))
    raw = subprocess.check_output([FF,'-v','error','-i',str(path),'-af',f'highpass=f={high}:p=2,lowpass=f={low}:p=2',
        '-f','f32le','-ar',str(SR),'-ac','2','-'])
    a = np.frombuffer(raw,'<f4').reshape(-1,2).astype(np.float64)
    if not len(a) or not np.isfinite(a).all():
        raise ValueError('Invalid source '+key)
    return a

def energy(a):
    p = np.array([np.mean(a[i:i+441]**2) for i in range(0,len(a),441)])
    return float(np.sqrt(np.mean(p[p>max(float(p.max())*.015,1e-14)])))

def fade(a, attack=.001, release=.04):
    a = a.copy()
    ni, no = min(round(attack*SR),len(a)//3), min(round(release*SR),len(a)//2)
    if ni: a[:ni] *= np.sin(np.linspace(0,np.pi/2,ni))[:,None]**2
    if no: a[-no:] *= np.cos(np.linspace(0,np.pi/2,no))[:,None]**2
    return a

def layer(key, seconds, gain=1, at=0, start=None, rate=1, high=80, low=10000, release=.045, attack=.001, pan=0):
    a = decode(key,high,low)
    # Choose a physical onset, not the source file's leading room/silence.
    if start is None:
        window = 220
        e = np.array([np.mean(a[i:i+window]**2) for i in range(0,len(a),window)])
        candidates = np.flatnonzero(e > max(e.max()*.075,1e-12))
        start = max(0,(int(candidates[0])*window/SR)-.005) if len(candidates) else 0
    i = round(start*SR)
    a = a[i:i+round((seconds*rate+.01)*SR)].copy()
    if not len(a): raise ValueError('Empty cut '+key)
    if rate != 1:
        x = np.arange(0,len(a)-1,rate)
        a = np.column_stack([np.interp(x,np.arange(len(a)),a[:,c]) for c in (0,1)])
    a = a[:round(seconds*SR)]
    a = fade(a,attack,release)
    a *= .075/max(energy(a),1e-8)
    a[:,0] *= min(1,1-pan)
    a[:,1] *= min(1,1+pan)
    return a*gain,at,dict(source=key,sourceStart=round(start,6),duration=seconds,rate=rate,gain=gain,
        at=at,highpass=high,lowpass=low,attack=attack,release=release,pan=pan)

def note(inst, midi, at, duration, gain, pan=0):
    base, rel = min(INSTRUMENTS[inst], key=lambda entry:abs(entry[0]-midi))
    data, pos, recipe = layer(rel,duration,gain,at,rate=2**((midi-base)/12),high=65,low=14000,
        release=min(.14,duration*.3),attack=.002,pan=pan)
    recipe.update(instrument=inst, midi=midi, root=base)
    return data,pos,recipe

def notes(inst, events, pan=0):
    return [note(inst,*e,pan=pan) for e in events]

def meta(path,audio=False):
    p = Path(str(path)+'.meta')
    if p.exists(): return
    p.write_text(json.dumps(dict(ver='1.0.0' if audio else '1.2.0',importer='audio-clip' if audio else 'directory',
        imported=True,uuid=str(uuid.uuid4()),files=['.json','.wav'] if audio else [],subMetas={},
        userData={'downloadMode':0} if audio else {}),indent=2),encoding='utf8')

def emit(name,label,cue,layers,rms=-21,peak=-5.5,stereo=False):
    n = max(round(at*SR)+len(a) for a,at,_ in layers)
    a = np.zeros((n,2))
    for b,at,_ in layers:
        i=round(at*SR)
        a[i:i+len(b)] += b
    if not stereo: a = a.mean(axis=1,keepdims=True)
    a *= 10**(rms/20)/max(energy(a),1e-8)
    ceiling = 10**(peak/20)
    # At most 4 dB of short look-ahead peak control for sparse foley spikes.
    # Keep transients; never boost the game's master bus or hard-clip a waveform.
    a *= min(1,ceiling*10**(4/20)/max(float(np.max(abs(a))),1e-9))
    reduction = max(0,20*np.log10(max(float(np.max(abs(a))),1e-9)/ceiling))
    if reduction > .01:
        raw = subprocess.check_output([FF,'-v','error','-f','f32le','-ar',str(SR),'-ac',str(a.shape[1]),'-i','-',
            '-af',f'alimiter=limit={ceiling}:attack=1:release=35:level=false:latency=true',
            '-f','f32le','-'],input=a.astype('<f4').tobytes())
        a=np.frombuffer(raw,'<f4').reshape(-1,a.shape[1]).astype(np.float64)
    a = fade(a,.0006,.018)
    active = np.flatnonzero(np.max(abs(a),axis=1)>1e-5)
    if not len(active): raise ValueError('Silent render '+name)
    # Preserve onset; remove only surplus trailing silence with a small zero tail.
    a = a[:min(len(a),active[-1]+round(.02*SR))]
    a = fade(a,.0003,.008)
    pcm = np.round(a*32767).astype('<i2')
    path = DEST/(name+'.wav')
    with wave.open(str(path),'wb') as out:
        out.setnchannels(a.shape[1]);out.setsampwidth(2);out.setframerate(SR);out.writeframes(pcm.tobytes())
    meta(path,True)
    truepeak_raw = subprocess.check_output([FF,'-v','error','-i',str(path),'-ar',str(SR*4),'-f','f32le','-'])
    truepeak = float(np.max(abs(np.frombuffer(truepeak_raw,'<f4'))))
    record=dict(file=path.name,label=label,cue=cue,seconds=round(len(a)/SR,4),channels=a.shape[1],
        bytes=path.stat().st_size,maxOfflinePeakReductionDB=round(reduction,3),peakDBFS=round(20*np.log10(float(np.max(abs(a)))),2),
        oversampledPeakDBFS=round(20*np.log10(max(truepeak,1e-9)),2),activeRMSDBFS=round(20*np.log10(energy(a)),2),
        clippedSamples=int(np.count_nonzero(abs(pcm.astype(np.int32))>=32767)),
        firstSample=pcm[0].tolist(),lastSample=pcm[-1].tolist(),sha256=sha(path),layers=[r for _,_,r in layers])
    if record['clippedSamples'] or truepeak >= .95: raise ValueError('Render exceeded headroom')
    MANIFEST.append(record)
    print(name,record['seconds'],record['activeRMSDBFS'],flush=True)

def render():
    DEST.mkdir(parents=True,exist_ok=True);meta(DEST)
    # Three physical takes per weapon; no target hit baked into a projectile launch.
    for i,start in enumerate([.105,.443,.77],1):
        emit(f'bow_{i}','弓箭普攻','bow',[layer('bow',.235,.95,start=start,high=140,low=12500),
            layer('swish',.16,.18,at=.008,rate=1.04+.018*i,high=800,low=8000)],-22,-6.2)
    for i,start in enumerate([.32,.834,1.41],1):
        emit(f'crossbow_{i}','重弩普攻','crossbow',[layer('crossbow',.32,1,start=start,rate=.98,high=100,low=11500),
            layer('wood',.16,.19,start=.03*(i-1),low=3400),layer('swing',.22,.16,at=.009,high=600,low=7500)],-21.5,-5.8)
    for i in range(1,4):
        emit(f'fire_{i}','火焰普攻','fire',[layer('flame'+str(i),.32,.85,low=8200),
            layer('lighter',.12,.26,rate=.95+.03*i,high=400,low=6500),layer('huff',.22,.16,low=1900)],-22,-6)
        emit(f'thunder_{i}','雷电普攻','thunder',[layer('electric',.19,.9,start=[2.49,2.62,2.83][i-1],high=240,low=6600),
            layer('hit'+str(i),.16,.18,high=170,low=2200)],-22.5,-6.4)
        emit(f'frost_{i}','冰霜普攻','frost',[layer(['ice','icecrack','iceblock'][i-1],.30,.8,start=1.48 if i==2 else None,rate=1.04,high=340,low=8500),
            layer('swish',.21,.27,high=1200,low=6800),note('glock',88+i,0,.28,.045)],-22.5,-6.4)
    emit('pierce_heavy','贯穿重击','pierceHeavy',[layer('hit1',.3,.9),layer('wood',.23,.28,at=.01,low=5200)],-21,-5.4)
    emit('fire_heavy','火焰重击','fireHeavy',[layer('flame4',.52,.9,rate=.9,low=7000),layer('hit2',.23,.42,low=3800)],-21,-5.5)
    emit('thunder_heavy','雷电重击','thunderHeavy',[layer('electric',.28,.65,high=250,low=6300),layer('thunder',.43,.6,low=4200),layer('hit1',.2,.23,low=1900)],-21,-5.4)
    emit('frost_heavy','冰霜重击','frostHeavy',[layer('iceblock',.49,.8,rate=.88,high=170,low=8200),layer('icecrack',.28,.33,at=.04,high=650,low=6900)],-21,-5.5)
    emit('crit','暴击','crit',[layer('hit3',.27,1,rate=1.06),layer('swish',.18,.22,high=1100,low=8500)],-20.8,-5.5)
    for i in range(1,4):
        emit(f'heavy_{i}','精英与首领倒地','deathHeavy',[layer('hit'+str(i),.32,.6,rate=.83,low=3000),
            layer('rockdrop',.45,.7,rate=.9+i*.02,low=6500),layer('debris',.24,.22,at=.11,high=450,low=5500)],-22,-6.2)
    emit('wall','防线受击','wall',[layer('rock',.37,.8,low=4800),layer('wood',.26,.55,low=4200)],-20.8,-5.5)
    emit('snipe','重弩蓄力射击','snipe',[layer('crossbow',.44,1,start=.834,rate=.88),layer('swing',.42,.37,high=350),layer('hit2',.22,.18,low=2100)],-20,-4.8)
    emit('skill','箭矢技能','skill',[layer('bow',.28,.8,start=.443),layer('swing',.44,.6,rate=1.05),
        layer('swish',.25,.26,at=.065,high=950)],-21,-5.3)
    emit('bow_ult','箭雨大招','bowUlt',[layer('bow',.36,.9,start=.105,rate=.92),layer('swing',.65,.65,rate=.87),
        layer('swish',.27,.28,at=.08),layer('swish',.29,.18,at=.17,rate=.95)],-19.8,-4.8)
    emit('fire_skill','火焰技能','fireSkill',[layer('lighter',.13,.34,high=220),layer('flame4',.69,.9,rate=.94,at=.015,low=7400),
        layer('huff',.43,.25,low=2500)],-20.5,-5)
    emit('thunder_skill','连锁闪电','thunderSkill',[layer('electric',.26,.7,low=6300),layer('current',.47,.4,at=.03,high=220,low=4800),
        layer('electric',.16,.3,at=.11,rate=1.1,low=6000),layer('thunder',.42,.32,low=3000)],-20.6,-5)
    emit('frost_skill','冰霜领域','frostSkill',[layer('swish',.32,.3,high=800),layer('iceblock',.61,.8,at=.07,rate=.88,low=8300),
        layer('icecrack',.38,.25,at=.16,high=600,low=7500),note('glock',84,.14,.52,.07)],-20.5,-5)
    emit('fire_ult','流星火雨','fireUlt',[layer('flame7',1.05,.95,rate=.82,low=6700),layer('huff',.53,.3,low=1800),
        layer('rock',.39,.25,at=.12,low=2500),layer('flame4',.6,.22,at=.26,rate=1.04,high=450,low=7000)],-19.5,-4.5)
    emit('thunder_ult','雷暴大招','thunderUlt',[layer('thunder',1.2,.9,low=7000),layer('electric',.36,.4,low=6500),
        layer('current',.62,.3,at=.08,rate=.9,low=5300),layer('electric',.18,.18,at=.26,low=6000)],-19.5,-4.5)
    emit('frost_ult','暴风雪大招','frostUlt',[layer('iceblock',.86,.8,rate=.76,low=7500),layer('swing',.83,.38,rate=.86,low=5600),
        layer('icecrack',.44,.3,at=.17,high=450,low=7500),layer('ice',.4,.22,at=.37,low=7000),
        note('glock',84,.11,.84,.07),note('glock',91,.18,.72,.035)],-19.5,-4.6)
    # The same small acoustic motif (D-A-D / F#) connects choices and rewards.
    emit('pick_open','卡牌展开','pickOpen',[layer('book',.22,.7),layer('page',.16,.45,at=.06),layer('page2',.18,.35,at=.12)],-24,-8)
    emit('pick_choose','卡牌选定','pickChoose',[layer('page2',.14,.28)]+notes('marimba',[(81,0,.18,.65),(86,.095,.4,.8)])+[note('harp',78,.095,.42,.18)],-22,-6.5,True)
    emit('growth','普通升级与主城成长','growth',notes('marimba',[(74,0,.2,.65),(81,.085,.22,.7),(86,.185,.45,.85)])+
        [note('harp',78,.185,.5,.26),note('horn',62,.185,.43,.16)],-21.5,-5.8,True)
    emit('reward','领奖、购买与招募','reward',[layer('coins',.27,.25,high=450,low=9000)]+
        notes('harp',[(74,0,.4,.55),(78,.065,.42,.6),(81,.13,.48,.7),(86,.21,.64,.72)],-.08)+
        [note('glock',86,.21,.66,.2,.12),note('marimba',74,.21,.4,.28)],-21.2,-5.6,True)
    emit('breakthrough','阶段突破','breakthrough',notes('trumpet',[(69,0,.17,.5),(74,.13,.19,.6),(78,.29,.2,.7),(81,.47,.52,.75)],-.07)+
        [note('horn',62,.47,.58,.36),note('harp',86,.48,.62,.34,.1),layer('timpani',.55,.19,at=.47,low=3500)],-20.3,-5,True)
    emit('loot_pickup','战利品拾取','lootPickup',[layer('coins',.2,.6,high=650,low=7600),note('marimba',86,0,.22,.34)],-25,-8.5)
    emit('surge','精英与首领警报','surge',[note('horn',55,0,.29,.75),note('horn',62,.19,.52,.82),
        layer('timpani',.43,.32,at=.19,low=3000)],-21.4,-6,True)
    emit('victory','战斗胜利','victory',notes('trumpet',[(69,0,.16,.6),(69,.15,.14,.56),(74,.3,.2,.72),(78,.5,.2,.77),(81,.7,.23,.8)],-.08)+
        [note('trumpet-long',74,.94,.94,.62,-.08),note('trumpet-long',78,.94,.88,.35,.08),
         note('horn',62,.94,1.02,.36),note('horn',57,.94,.96,.24),note('harp',86,.94,1.04,.24,.16),
         layer('snare',.13,.16,at=.27,high=170,low=6800),layer('timpani',.85,.23,at=.94,low=4000),layer('cymbal',.84,.13,at=.94,high=900,low=8200)],-20,-4.8,True)
    emit('defeat','战斗失败','defeat',notes('bassoon',[(62,0,.24,.65),(60,.21,.22,.62),(57,.43,.25,.62),(50,.69,.52,.62)],-.04)+
        [note('harp',65,.69,.58,.18,.1),note('horn',50,.69,.5,.14)],-23,-6.8,True)
    for i in range(1,3):
        emit(f'ui_click_{i}','通用轻点击','ui',[layer('wood',.085,.8,start=.091 if i==1 else .355,rate=1.08+i*.03,high=450,low=5000),
            layer('page' if i==1 else 'page2',.065,.12,high=850,low=6500)],-26,-9)
    write('manifest.json',dict(version='v24',files=MANIFEST,sourceCount=len(USED),fileCount=len(MANIFEST),
        cueCount=len(set(r['cue'] for r in MANIFEST)),bytes=sum(r['bytes'] for r in MANIFEST),
        auditioned=False,description='Original arrangements with licensed recording layers; listening acceptance pending'))
    write('used-sources.json',USED)

def inspect():
    before=json.loads((HERE/'before.json').read_text(encoding='utf8'))
    changed=[rel for rel,h in before.items() if sha(ROOT/rel)!=h]
    unexpected=set(changed)-set(CHANGED)
    if unexpected: raise ValueError('Unrelated originals changed '+str(unexpected))
    old=(HERE/'before'/CHANGED[0]).read_text(encoding='utf8')
    catalog=(ROOT/CHANGED[0]).read_text(encoding='utf8')
    if old.split('const SILENT_CUES')[1]!=catalog.split('const SILENT_CUES')[1]:
        raise ValueError('Sound reduction policy changed')
    silent=re.findall(r"'([a-zA-Z]+)'",catalog.split('const SILENT_CUES')[1].split(']);')[0])
    alias=dict(re.findall(r"(\w+): '([a-zA-Z]+)'",catalog.split('const SHARED_CUES')[1].split('};')[0]))
    keys=re.findall(r'^  (\w+): \{ files:',catalog,re.M)
    canonical=set(keys)-set(silent)-set(alias)
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
    if canonical!=set(r['cue'] for r in manifest['files']): raise ValueError('Incomplete cue coverage')
    if len({r['sha256'] for r in manifest['files']})!=len(manifest['files']): raise ValueError('Duplicate samples')
    for r in manifest['files']:
        p=DEST/r['file']
        if sha(p)!=r['sha256']: raise ValueError('Asset changed')
        if not Path(str(p)+'.meta').exists(): raise ValueError('Missing Cocos metadata')
    write('source-inspection.json',dict(changedOriginals=changed,unchangedOriginalFiles=len(before)-len(changed),
        canonicalCues=sorted(canonical),newFiles=manifest['fileCount'],silentCues=silent,aliases=alias,
        allPriorWavesUnchanged=True,allNewWavesDistinct=True,noClippedSamples=True,gameOrAudioPlayed=False))
    print('Static inspection: 31/31 cues, 44 unique files; prior audio and unrelated scripts preserved')

def stage():
    prior=Path(json.loads((ROOT/'docs/audio-reduction-v23/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
    build=ROOT/'build/web-mobile'
    release=json.loads((build/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']: raise ValueError('Production build required')
    target=ROOT/'build'/('publish-audio-kingdom-v24-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(build,target,ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior/'previews',target/'previews')
    previews=[p for p in (prior/'previews').rglob('*') if p.is_file()]
    for p in previews:
        if sha(p)!=sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Old preview changed')
    shutil.copytree(HERE/'preview',target/'previews/audio-kingdom-v24')
    version=re.search(r'\?v=(\d+)',release['entry']).group(1)
    record=dict(stage=str(target),priorPublishedStage=str(prior),entryVersion=version,project='kingdom-watch',branch='main',
        game='https://kingdom-watch.pages.dev/?v=audio-kingdom-v24-'+version,
        preview='https://kingdom-watch.pages.dev/previews/audio-kingdom-v24/',priorPreviewFilesPreserved=len(previews),
        scope='All 31 active cues replaced with 44 new recordings/arrangements; v23 density policy unchanged',
        manualAcceptance='Pending user listening; no game/browser/audio playback performed')
    write('deployment-stage.json',record)
    for name in ['build-record.json','web-release.json']: shutil.copy2(build/name,HERE/name)
    print(json.dumps(record,ensure_ascii=False))

if __name__=='__main__':
    {'snapshot':snapshot,'render':render,'inspect':inspect,'stage':stage}[sys.argv[1]]()
