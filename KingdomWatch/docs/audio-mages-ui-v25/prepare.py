"""Softer elemental recordings and a two-part wooden gate. Offline only."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import wave
from datetime import datetime
import numpy as np

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('v24',ROOT/'docs/audio-kingdom-v24/prepare.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
DEST=ROOT/'assets/resources/audio/v25'
SR=p.SR
MANIFEST=[]
CHANGED=['assets/scripts/core/AudioCatalog.ts','assets/scripts/core/GameAudio.ts',
    'assets/scripts/ui/UIAudio.ts','assets/scripts/ui/TouchFeedback.ts','assets/scripts/ui/BattleEntry.ts',
    'assets/resources/audio/README.txt','assets/resources/audio/v1/CREDITS.txt',
    'build-templates/web-mobile/audio-credits.html']

def write(name,data):
    (HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')

def snapshot():
    if (HERE/'before.json').exists():raise ValueError('Snapshot exists')
    for rel in CHANGED:
        out=HERE/'before'/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,out)
    files=list((ROOT/'assets/scripts').rglob('*.ts'))+list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json',{f.relative_to(ROOT).as_posix():p.sha(f) for f in files if f.is_file()})
    print('Saved source/audio snapshot')

def fetch():
    spec=importlib.util.spec_from_file_location('sonniss',ROOT/'docs/audio-representatives-r1/sonniss_fetch.py')
    fetcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(fetcher)
    index=json.loads((ROOT/'docs/audio-representatives-r1/index-2015-1.json').read_text(encoding='utf8'))
    name='Coll Anderson - House/EFX INT HOUSE DOOR Bedroom Wood O_C Close Medium 01.wav'
    entry=next(e for e in index['entries'] if e['name']==name)
    out=HERE/'sources'/name
    fetcher.extract(index,entry,out)
    record=dict(path=out.relative_to(ROOT).as_posix(),original=name,author='Coll Anderson',url=index['url'],
        license='Sonniss GameAudioGDC EULA v2.0',licenseURL='https://sonniss.com/gdc-bundle-license/',
        archiveCRC32=entry['crc'],sha256=p.sha(out))
    write('gate-source.json',record)
    print('Downloaded and CRC-checked wooden door recording',out.stat().st_size)

def filtered(layer,cut=2600):
    a,at,recipe=layer
    raw=subprocess.check_output([p.FF,'-v','error','-f','f32le','-ar',str(SR),'-ac','2','-i','-',
        '-af',f'lowpass=f={cut}:p=2,equalizer=f=2300:t=q:w=1.1:g=-4','-f','f32le','-'],input=a.astype('<f4').tobytes())
    a=np.frombuffer(raw,'<f4').reshape(-1,2).astype(np.float64)
    recipe=dict(recipe,additionalLowpassHz=cut,presenceDipHz=2300,presenceDipDB=-4)
    return a,at,recipe

def foley(key,seconds,gain=1,at=0,start=None,rate=1,low=2400,high=100,attack=.008,release=.045):
    return filtered(p.layer(key,seconds,gain,at,start,rate,high,low,release,attack),low)

def tone(inst,midi,seconds,gain=1,at=0,low=2600):
    return filtered(p.note(inst,midi,at,seconds,gain),low)

def spectral(a):
    a=np.asarray(a).reshape(-1)
    ft=abs(np.fft.rfft(a*np.hanning(len(a))))**2
    hz=np.fft.rfftfreq(len(a),1/SR)
    return dict(above3500Fraction=round(float(ft[hz>=3500].sum()/max(ft.sum(),1e-12)),7),
        spectralCentroidHz=round(float((ft*hz).sum()/max(ft.sum(),1e-12)),1))

def emit(name,cue,label,layers,rms=-26,peak=-9):
    n=max(round(at*SR)+len(a) for a,at,_ in layers)
    audio=np.zeros((n,2))
    for a,at,_ in layers:
        i=round(at*SR);audio[i:i+len(a)]+=a
    audio=audio.mean(axis=1,keepdims=True)
    audio=p.fade(audio,.005,.035)
    audio*=10**(rms/20)/max(p.energy(audio),1e-9)
    audio*=min(1,10**(peak/20)/max(float(np.max(abs(audio))),1e-9))
    pcm=np.round(audio*32767).astype('<i2')
    out=DEST/(name+'.wav')
    with wave.open(str(out),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    p.meta(out,True)
    record=dict(file=out.name,cue=cue,label=label,seconds=round(len(audio)/SR,4),bytes=out.stat().st_size,
        peakDBFS=round(float(20*np.log10(max(abs(audio[:,0])))),2),activeRMSDBFS=round(float(20*np.log10(p.energy(audio))),2),
        clippedSamples=int(np.count_nonzero(abs(pcm.astype(np.int32))>=32767)),sha256=p.sha(out),
        layers=[r for _,_,r in layers],spectrum=spectral(audio))
    if (ROOT/'assets/resources/audio/v24'/out.name).exists():
        raw=subprocess.check_output([p.FF,'-v','error','-i',str(ROOT/'assets/resources/audio/v24'/out.name),'-ac','1','-ar',str(SR),'-f','f32le','-'])
        old=np.frombuffer(raw,'<f4')
        record['previousSpectrum']=spectral(old)
        record['previousActiveRMSDBFS']=round(float(20*np.log10(p.energy(old))),2)
    MANIFEST.append(record)
    print(name,record['seconds'],record['activeRMSDBFS'],record['spectrum']['above3500Fraction'],flush=True)

def render():
    DEST.mkdir(parents=True,exist_ok=True);p.meta(DEST)
    gate=json.loads((HERE/'gate-source.json').read_text(encoding='utf8'));p.SOURCE['gate']=gate
    # Fire: a short warm breath with a low, soft flame body; no lighter crack/rock hit.
    # Volt: rounded drum/thunder body, one quiet filtered current edge; no crack stacks.
    # Frost: middle-register harp resonance and a soft breath; no glass, glock or ice shards.
    for i in range(1,4):
        emit(f'fire_{i}','fire','火焰普攻',[foley('huff',.24,.7,rate=.94+i*.025,low=1800),
            foley('flame'+str(i),.20,.25,start=.2,low=1900,attack=.012)],-27,-10)
        emit(f'thunder_{i}','thunder','雷电普攻',[foley('timpani',.20,.75,rate=1.1+i*.035,low=2000),
            foley('current',.10,.10,start=2.15+.12*i,low=1700,attack=.008,release=.03)],-27,-10)
        emit(f'frost_{i}','frost','冰霜普攻',[tone('harp',[76,78,79][i-1],.27,.65,low=2600),
            foley('swish',.15,.12,low=1800,high=450,attack=.02)],-28,-10.5)
    emit('fire_heavy','fireHeavy','火焰重击',[foley('huff',.32,.65,rate=.9,low=1800),foley('flame4',.25,.3,start=.25,low=2000)],-25.6,-9.3)
    emit('fire_skill','fireSkill','火焰技能',[foley('huff',.42,.65,rate=.92,low=1900),foley('flame4',.34,.32,at=.02,start=.24,low=2100)],-25,-8.8)
    emit('fire_ult','fireUlt','流星火雨',[foley('huff',.58,.7,rate=.83,low=2000),foley('flame7',.51,.4,at=.045,low=2100)],-23.5,-8)
    emit('thunder_heavy','thunderHeavy','雷电重击',[foley('thunder',.32,.65,low=1900),foley('timpani',.28,.3,low=2000)],-25.6,-9.3)
    emit('thunder_skill','thunderSkill','连锁闪电',[foley('thunder',.42,.6,low=2100),foley('current',.19,.12,at=.035,start=2.5,low=1600)],-25,-8.8)
    emit('thunder_ult','thunderUlt','雷暴大招',[foley('thunder',.68,.72,rate=.94,low=2100),foley('timpani',.43,.22,at=.025,rate=.86,low=1700)],-23.5,-8)
    emit('frost_heavy','frostHeavy','冰霜重击',[tone('harp',72,.38,.7,low=2600),foley('wood',.17,.12,start=.355,rate=.84,low=1600)],-26,-9.3)
    emit('frost_skill','frostSkill','冰霜领域',[tone('harp',74,.48,.65,low=2600),tone('harp',81,.36,.24,at=.055,low=2400)],-25.5,-9)
    emit('frost_ult','frostUlt','暴风雪大招',[tone('harp',69,.64,.6,low=2500),tone('harp',76,.56,.36,at=.045,low=2600),
        foley('swing',.48,.14,at=.04,rate=.9,low=1700,high=400,attack=.025)],-24,-8.3)
    # Slide begins with the animation. Collision is a separate cue at actual closure,
    # so reduced-motion and interrupted transitions cannot mis-time a baked-in slam.
    emit('gate_slide','gateSlide','木门滑合',[foley('wood',.18,.7,start=.32,rate=.85,low=2700,high=120),
        foley('swing',.18,.25,low=2200,high=300,attack=.008,release=.025)],-24,-7.5)
    emit('gate_close','gateClose','木门合拢落点',[foley('gate',.43,.9,rate=.91,low=3400,high=95,attack=.002,release=.08)],-23,-6.5)
    write('manifest.json',dict(version='v25',fileCount=len(MANIFEST),mageFiles=18,gateFiles=2,bytes=sum(r['bytes'] for r in MANIFEST),
        files=MANIFEST,auditioned=False,authoring='Licensed original recordings re-edited; no oscillator or paid generation'))
    write('used-sources.json',p.USED)

def stage():
    prior=Path(json.loads((ROOT/'docs/audio-kingdom-v24/deployment-stage.json').read_text(encoding='utf8'))['stage'])
    build=ROOT/'build/web-mobile';release=json.loads((build/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']:raise ValueError('Production required')
    target=ROOT/'build'/('publish-audio-mages-ui-v25-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(build,target,ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior/'previews',target/'previews')
    previous=[f for f in (prior/'previews').rglob('*') if f.is_file()]
    for f in previous:
        if p.sha(f)!=p.sha(target/'previews'/f.relative_to(prior/'previews')):raise ValueError('Preview changed')
    shutil.copytree(HERE/'preview',target/'previews/audio-mages-ui-v25')
    version=re.search(r'\?v=(\d+)',release['entry']).group(1)
    record=dict(stage=str(target),priorPublishedStage=str(prior),entryVersion=version,project='kingdom-watch',branch='main',
        game='https://kingdom-watch.pages.dev/?v=audio-mages-ui-v25-'+version,
        preview='https://kingdom-watch.pages.dev/previews/audio-mages-ui-v25/',priorPreviewFilesPreserved=len(previous),
        manualAcceptance='Pending user; no game/browser/audio playback performed')
    write('deployment-stage.json',record)
    for name in ['build-record.json','web-release.json']:shutil.copy2(build/name,HERE/name)
    print(json.dumps(record,ensure_ascii=False))

if __name__=='__main__':{'snapshot':snapshot,'fetch':fetch,'render':render,'stage':stage}[sys.argv[1]]()
