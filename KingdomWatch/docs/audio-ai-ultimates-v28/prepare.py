"""Integrate the user's three exact AI-video excerpts; offline operations only."""
from pathlib import Path
from datetime import datetime
import importlib.util
import json
import math
import re
import shutil
import subprocess
import sys
import wave
import numpy as np

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('audio_utils',ROOT/'docs/audio-kingdom-v24/prepare.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
DEST=ROOT/'assets/resources/audio/v28'
CHANGED=['assets/scripts/core/AudioCatalog.ts','assets/resources/audio/README.txt',
         'assets/resources/audio/v1/CREDITS.txt','build-templates/web-mobile/audio-credits.html']
CASES=[('fireUlt','meteor_ult','01_meteor_0-2.3s.wav','meteor_land',.88,0,2.3),
       ('thunderUlt','thunder_ult','02_thunder_2.3-4.3s.wav','thunder_soft',.72,2.3,4.3),
       ('frostUlt','ice_ult','03_ice_4.3-6s.wav','ice_shatter',.82,4.3,6)]

def write(name,value):
    (HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf8')

def decoded(file):
    raw=subprocess.check_output([p.FF,'-v','error','-i',str(file),'-ac','2','-ar',str(p.SR),'-f','f32le','-'])
    return np.frombuffer(raw,'<f4').reshape(-1,2).astype(np.float64)

def snapshot():
    if (HERE/'before.json').exists():raise ValueError('Snapshot already exists')
    for rel in CHANGED:
        out=HERE/'before'/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,out)
    files=list((ROOT/'assets/scripts').rglob('*.ts'))+list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json',{f.relative_to(ROOT).as_posix():p.sha(f) for f in files if f.is_file()})
    print('Current v27 source and audio snapshot saved')

def prepare():
    DEST.mkdir(parents=True,exist_ok=True);p.meta(DEST)
    cuts=json.loads((ROOT/'docs/audio-ai-video-r1/revision-boundaries-2.3-4.3-6.json').read_text(encoding='utf8'))
    catalog=(ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    if "const generated =" not in catalog:
        catalog="const generated = (...files: string[]): readonly string[] => files.map(file => 'v28/' + file);\n"+catalog
    rows=[]
    for cue,name,source_name,previous_name,previous_gain,start,end in CASES:
        src=ROOT/'docs/audio-ai-video-r1/audio'/source_name
        cut=next(r for r in cuts['files'] if Path(r['output']).name==source_name)
        if p.sha(src)!=cut['sha256']:raise ValueError('Selected user clip changed')
        out=DEST/(name+'.wav');shutil.copy2(src,out);p.meta(out,True)
        a=decoded(out);old=decoded(ROOT/'assets/resources/audio/v27'/(previous_name+'.wav'))
        # Keep source bytes, stereo, exact cuts and timbre. Match game playback level only.
        gain=round(min(previous_gain, previous_gain*p.energy(old)/max(p.energy(a),1e-12)),3)
        gap=round((end-start)+.05,2)
        line=f"  {cue}: {{ files: generated('{name}'), gain: {gain}, gap: {gap}, group: 'cast', priority: 3 }},"
        catalog,count=re.subn(r'^  '+cue+r': .+$',line,catalog,flags=re.M)
        if count!=1:raise ValueError('Missing ultimate cue '+cue)
        with wave.open(str(out),'rb') as w:
            params=dict(channels=w.getnchannels(),sampleRate=w.getframerate(),bits=w.getsampwidth()*8,frames=w.getnframes())
        rows.append(dict(file=out.name,cue=cue,source=src.relative_to(ROOT).as_posix(),
            sha256=p.sha(out),sourceStart=start,sourceEnd=end,seconds=len(a)/p.SR,bytes=out.stat().st_size,
            playbackGain=gain,gapSeconds=gap,activeRMSDBFS=round(20*math.log10(p.energy(a)),3),
            peakDBFS=round(20*math.log10(float(np.max(abs(a)))),3),
            previousEffectiveRMSDBFS=round(20*math.log10(p.energy(old)*previous_gain),3),
            effectiveRMSDBFS=round(20*math.log10(p.energy(a)*gain),3),
            sourceBytesUnchanged=True,**params))
        print(cue,'seconds',end-start,'gain',gain,'gap',gap,flush=True)
    (ROOT/'assets/scripts/core/AudioCatalog.ts').write_text(catalog,encoding='utf8')
    write('manifest.json',dict(version='v28',files=rows,cutBoundariesSeconds=[0,2.3,4.3,6],
        sourceVideo='docs/audio-ai-video-r1/source/generated-elements-8s.mp4',
        userProvidedAIGeneratedSource=True,sourceAudioBytesUnchanged=True,audioAuditioned=False,
        processing='Exact user-selected WAVs copied byte for byte. Playback gain only; no EQ, pitch, denoise, mono conversion, fades or layers.'))

def review():
    before=json.loads((HERE/'before.json').read_text(encoding='utf8'))
    changed=[rel for rel,h in before.items() if p.sha(ROOT/rel)!=h]
    if set(changed)-set(CHANGED):raise ValueError('Unrelated source changed '+str(changed))
    old=(HERE/'before/assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    new=(ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    def preserved(text):
        text=re.sub(r'^const generated = .*\n','',text,flags=re.M)
        return re.sub(r'^  (fireUlt|thunderUlt|frostUlt): .*\n','',text,flags=re.M)
    if preserved(old)!=preserved(new):raise ValueError('Other cue configuration changed')
    diagnostics=[]
    for name in ['types-before.log','types-after.log']:
        text=(HERE/name).read_text(encoding='utf-8-sig')
        diagnostics.append(re.findall(r'^([^\r\n]+?)\(\d+,\d+\): error (TS\d+): (.+)$',text,re.M))
    if diagnostics[0]!=diagnostics[1]:raise ValueError('New type diagnostic')
    rows=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))['files']
    for row in rows:
        if p.sha(DEST/row['file'])!=row['sha256'] or p.sha(ROOT/row['source'])!=row['sha256']:raise ValueError('Clip bytes changed')
    write('source-inspection.json',dict(changedOriginals=changed,unchangedOriginals=len(before)-len(changed),
        allPriorAudioAndMetadataUnchanged=True,allOtherRuntimeScriptsUnchanged=True,
        onlyThreeUltimateCueConfigurationsChanged=True,exactUserClipsCopied=True,
        typeDiagnosticsBefore=len(diagnostics[0]),typeDiagnosticsAfter=len(diagnostics[1]),newTypeDiagnostics=0,
        gameBrowserTestsAndAudioPlaybackPerformed=False))
    print('Static review passed: exact user clips; only three ultimate configurations; no new type diagnostics')

def built():
    web=ROOT/'build/web-mobile';res=web/'assets/resources'
    config=json.loads(next(res.glob('config.*.json')).read_text(encoding='utf8'))
    paths={v[0] for v in config['paths'].values()}
    native={p.sha(f):f for f in (res/'native').rglob('*.wav')}
    rows=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))['files']
    result=[]
    for row in rows:
        path='audio/v28/'+Path(row['file']).stem
        meta=json.loads(Path(str(DEST/row['file'])+'.meta').read_text(encoding='utf8'))
        if path not in paths or row['sha256'] not in native or meta['uuid'] not in native[row['sha256']].name:raise ValueError('Production asset mismatch')
        result.append(dict(resource=path,native=native[row['sha256']].relative_to(web).as_posix(),sha256=row['sha256']))
    bundle=next((web/'assets/main').glob('index.*.js')).read_text(encoding='utf8')
    for marker in ['v28/','meteor_ult','thunder_ult','ice_ult','ultimateImpact']:
        if marker not in bundle:raise ValueError('Missing compiled marker '+marker)
    for rel in ['v27/mage_cast.wav','v24/ui_click_1.wav','v26/hit_common.wav']:
        if p.sha(ROOT/'assets/resources/audio'/rel) not in native:raise ValueError('Preserved audio missing')
    write('bundle-inspection.json',dict(newAssets=result,sourceBytesPreserved=True,nativePathUUIDHashMatch=True,
        commonCastClickAndHitPreserved=True,noGameOrAudioPlaybackPerformed=True))
    print('Production paths, UUIDs and exact source hashes verified')

def stage():
    prior=Path(json.loads((ROOT/'docs/audio-mage-shared-v27/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
    web=ROOT/'build/web-mobile';release=json.loads((web/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']:raise ValueError('Production build required')
    target=ROOT/'build'/('publish-audio-ai-ultimates-v28-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(web,target,ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior/'previews',target/'previews')
    previous=[f for f in (prior/'previews').rglob('*') if f.is_file()]
    for f in previous:
        if p.sha(f)!=p.sha(target/'previews'/f.relative_to(prior/'previews')):raise ValueError('Historical preview changed')
    version=re.search(r'\?v=(\d+)',release['entry']).group(1)
    write('deployment-stage.json',dict(stage=str(target),priorPublishedStage=str(prior),entryVersion=version,
        project='kingdom-watch',branch='main',published=False,
        game='https://kingdom-watch.pages.dev/?v=audio-ai-ultimates-v28-'+version,
        priorPreviewFilesPreserved=len(previous),manualAcceptance='User manual audition; no game/browser/audio playback performed'))
    for name in ['build-record.json','web-release.json']:shutil.copy2(web/name,HERE/name)
    print('Release staged',target)

if __name__=='__main__':
    {'snapshot':snapshot,'prepare':prepare,'review':review,'built':built,'stage':stage}[sys.argv[1]]()
