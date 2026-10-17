"""Offline chapter music preparation, provenance and release checks. No playback."""
from pathlib import Path
from datetime import datetime
import importlib.util
import json
import math
import re
import shutil
import subprocess
import sys
import numpy as np

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('audio_utils',ROOT/'docs/audio-kingdom-v24/prepare.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
DEST=ROOT/'assets/resources/audio/v29'
CHANGED=['assets/scripts/core/AudioCatalog.ts','assets/scripts/core/GameAudio.ts',
    'assets/scripts/core/SaveData.ts','assets/scripts/ui/MainUI.ts','assets/scripts/ui/pages/LevelsPage.ts',
    'assets/scripts/battle/BattleDirector.ts','assets/resources/audio/README.txt',
    'assets/resources/audio/v1/CREDITS.txt','build-templates/web-mobile/audio-credits.html']
SOURCES=[dict(key='forest',name='Dark Forest Theme',author='The Cynic Project / Alex Smith (cynicmusic)',
    page='https://opengameart.org/node/80219',url='https://opengameart.org/sites/default/files/GameMusic_ForestTheme_24_0.mp3'),
    dict(key='lair',name='Battle Theme B for RPG',author='The Cynic Project / Alex Smith (cynicmusic)',
    page='https://opengameart.org/content/battle-theme-b-for-rpg',url='https://opengameart.org/sites/default/files/battleThemeB.mp3')]

def write(name,value):
    (HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf8')

def decode(path):
    data=subprocess.check_output([p.FF,'-v','error','-i',str(path),'-ac','2','-ar',str(p.SR),'-f','f32le','-'])
    a=np.frombuffer(data,'<f4').reshape(-1,2)
    if not len(a) or not np.isfinite(a).all():raise ValueError('Invalid decoded music')
    return a

def snapshot():
    if (HERE/'before.json').exists():raise ValueError('Existing snapshot')
    for rel in CHANGED:
        out=HERE/'before'/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,out)
    files=list((ROOT/'assets/scripts').rglob('*.ts'))+list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json',{f.relative_to(ROOT).as_posix():p.sha(f) for f in files if f.is_file()})
    print('Saved v28 worktree audio/source baseline')

def fetch():
    out=HERE/'sources';out.mkdir(exist_ok=True)
    for source in SOURCES:
        file=out/(source['key']+'.mp3');page=out/(source['key']+'-author-page.html')
        for url,path in [(source['url'],file),(source['page'],page)]:
            subprocess.run(['curl.exe','--noproxy','*','-fLsS','--retry','2','--max-time','45',url,'-o',str(path)],check=True)
        text=page.read_text(encoding='utf8')
        if 'CC0' not in text or 'cynicmusic' not in text:raise ValueError('Source license/author not found')
        source.update(path=file.relative_to(ROOT).as_posix(),sha256=p.sha(file),license='CC0-1.0',
            licenseURL='https://creativecommons.org/publicdomain/zero/1.0/')
        print('Saved author distribution and CC0 page',source['name'],flush=True)
    write('sources.json',SOURCES)

def render():
    DEST.mkdir(parents=True,exist_ok=True);p.meta(DEST)
    rows=[]
    for source in json.loads((HERE/'sources.json').read_text(encoding='utf8')):
        a=decode(ROOT/source['path']).astype(np.float64)
        active=np.flatnonzero(np.max(abs(a),axis=1)>.002)
        begin=max(0,int(active[0])-round(.01*p.SR));end=min(len(a),int(active[-1])+round(.06*p.SR))
        a=a[begin:end]
        overlap=round(.7*p.SR);q=np.linspace(0,1,overlap)[:,None]
        join=a[-overlap:]*np.cos(q*np.pi/2)+a[:overlap]*np.sin(q*np.pi/2)
        a=np.concatenate([a[overlap:-overlap],join]).astype('<f4')
        out=DEST/('bgm_'+source['key']+'.mp3')
        subprocess.run([p.FF,'-v','error','-y','-f','f32le','-ac','2','-ar',str(p.SR),'-i','-',
            '-af','loudnorm=I=-18:TP=-2:LRA=10','-ar',str(p.SR),'-c:a','libmp3lame','-b:a','192k',str(out)],input=a.tobytes(),check=True)
        p.meta(out,True)
        meta=Path(str(out)+'.meta');data=json.loads(meta.read_text(encoding='utf8'));data['files']=['.json','.mp3'];meta.write_text(json.dumps(data,indent=2),encoding='utf8')
        b=decode(out)
        if float(np.max(abs(b)))>=.99:raise ValueError('Music encoding clipped')
        rows.append(dict(file=out.name,chapter=2 if source['key']=='forest' else 3,source=source,
            sourceStartSeconds=begin/p.SR,sourceEndSeconds=end/p.SR,loopOverlapSeconds=.7,
            seconds=len(b)/p.SR,bytes=out.stat().st_size,sha256=p.sha(out),
            peakDBFS=round(20*math.log10(float(np.max(abs(b)))),3),targetLUFS=-18))
        print('Prepared',out.name,round(len(b)/p.SR,2),'seconds',flush=True)
    write('manifest.json',dict(files=rows,version='v29',audioAuditioned=False,fullCompositions=True))

def review():
    before=json.loads((HERE/'before.json').read_text(encoding='utf8'))
    changed=[rel for rel,h in before.items() if p.sha(ROOT/rel)!=h]
    if set(changed)-set(CHANGED):raise ValueError('Unrelated change '+str(changed))
    diagnostics=[]
    for name in ['types-before.log','types-after.log']:
        text=(HERE/name).read_text(encoding='utf-8-sig')
        diagnostics.append(re.findall(r'^([^\r\n]+?)\(\d+,\d+\): error (TS\d+): (.+)$',text,re.M))
    if diagnostics[0]!=diagnostics[1]:raise ValueError('Type diagnostic regression')
    old=(HERE/'before/assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    new=(ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    for line in re.findall(r'^  \w+: \{ files: .+$',old,re.M):
        cue=re.match(r'  (\w+):',line)[1]
        current=re.search(r'^  '+cue+r': .+$',new,re.M)[0]
        if cue not in ['fireUlt','thunderUlt'] and current!=line:raise ValueError('Other SFX changed '+cue)
    # Entry hooks are audio-only; chapter persistence is the sole new save field.
    old=(HERE/'before/assets/scripts/battle/BattleDirector.ts').read_text(encoding='utf8')
    new=(ROOT/'assets/scripts/battle/BattleDirector.ts').read_text(encoding='utf8')
    new=new.replace("import { campaignChapter } from '../config/Campaign';\n",'').replace("GameAudio.enter('battle', campaignChapter(flow.levelId).number);","GameAudio.enter('battle');")
    if new!=old:raise ValueError('Battle logic changed')
    write('source-inspection.json',dict(changedOriginals=changed,unchangedOriginals=len(before)-len(changed),
        allPriorAudioAndMetadataUnchanged=True,allOtherSfxConfigurationsUnchanged=True,
        typeDiagnosticsBefore=len(diagnostics[0]),typeDiagnosticsAfter=len(diagnostics[1]),newTypeDiagnostics=0,
        noTestsGameBrowserOrAudioPlaybackPerformed=True))
    print('Source comparison and type diagnostics passed; old audio and other SFX preserved')

def built():
    web=ROOT/'build/web-mobile';res=web/'assets/resources'
    config=json.loads(next(res.glob('config.*.json')).read_text(encoding='utf8'))
    paths={v[0] for v in config['paths'].values()};native={p.sha(f):f for f in (res/'native').rglob('*.mp3')}
    rows=[]
    for row in json.loads((HERE/'manifest.json').read_text(encoding='utf8'))['files']:
        rel='audio/v29/'+Path(row['file']).stem
        meta=json.loads(Path(str(DEST/row['file'])+'.meta').read_text(encoding='utf8'))
        if rel not in paths or row['sha256'] not in native or meta['uuid'] not in native[row['sha256']].name:raise ValueError('Built music mismatch')
        rows.append(dict(resource=rel,native=native[row['sha256']].relative_to(web).as_posix(),sha256=row['sha256']))
    bundle=next((web/'assets/main').glob('index.*.js')).read_text(encoding='utf8')
    for marker in ['bgm_forest','bgm_lair','viewedChapter','selectedCampaignChapter','setChapter','musicTrack']:
        if marker not in bundle:raise ValueError('Missing compiled music hook '+marker)
    write('bundle-inspection.json',dict(newMusic=rows,nativePathUUIDHashMatch=True,noGameOrAudioPlaybackPerformed=True))
    print('Production music resources and compiled selection/transition hooks verified')

def stage():
    prior=Path(json.loads((ROOT/'docs/audio-ai-ultimates-v28/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
    web=ROOT/'build/web-mobile';release=json.loads((web/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']:raise ValueError('Production required')
    target=ROOT/'build'/('publish-chapter-music-v29-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(web,target,ignore=shutil.ignore_patterns('previews'));shutil.copytree(prior/'previews',target/'previews')
    files=[f for f in (prior/'previews').rglob('*') if f.is_file()]
    for f in files:
        if p.sha(f)!=p.sha(target/'previews'/f.relative_to(prior/'previews')):raise ValueError('Historical preview changed')
    version=re.search(r'\?v=(\d+)',release['entry']).group(1)
    write('deployment-stage.json',dict(stage=str(target),entryVersion=version,priorPublishedStage=str(prior),
        project='kingdom-watch',branch='main',published=False,game='https://kingdom-watch.pages.dev/?v=chapter-music-v29-'+version,
        priorPreviewFilesPreserved=len(files),manualAcceptance='User manual; no game/browser/audio playback performed'))
    for name in ['build-record.json','web-release.json']:shutil.copy2(web/name,HERE/name)
    print('Release staged',target)

if __name__=='__main__':
    {'snapshot':snapshot,'fetch':fetch,'render':render,'review':review,'built':built,'stage':stage}[sys.argv[1]]()
