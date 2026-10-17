"""Static checks for approved audio preservation, cue coverage and shipped files."""
from pathlib import Path
import json
import re
import sys
import subprocess
import numpy as np
import prepare as q

ROOT=q.ROOT
HERE=q.HERE

def source():
    before=json.loads((HERE/'before.json').read_text(encoding='utf8'))
    changed=[rel for rel,h in before.items() if q.p.sha(ROOT/rel)!=h]
    if set(changed)-set(q.CHANGED):raise ValueError('Unrelated files changed '+str(changed))
    audio=[rel for rel in before if rel.endswith(('.wav','.mp3','.ogg','.flac','.meta'))]
    if any(q.p.sha(ROOT/rel)!=before[rel] for rel in audio):raise ValueError('Prior media changed')
    original=(HERE/'before/assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    current=(ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    approved=['bow','crossbow','snipe','skill','bowUlt','pierceHeavy','crit','ui']
    for cue in approved:
        pat=r'^  '+cue+r': .+$'
        if re.search(pat,original,re.M)[0]!=re.search(pat,current,re.M)[0]:raise ValueError('Approved cue changed '+cue)
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
    mage=[r for r in manifest['files'] if not r['cue'].startswith('gate')]
    if len(mage)!=18:raise ValueError('Mage family incomplete')
    if len(set(r['sha256'] for r in manifest['files']))!=20:raise ValueError('Duplicate render')
    for row in manifest['files']:
        if q.p.sha(q.DEST/row['file'])!=row['sha256']:raise ValueError('Source hash mismatch')
        if row['clippedSamples']:raise ValueError('Clipped audio')
        if not Path(str(q.DEST/row['file'])+'.meta').exists():raise ValueError('Missing metadata')
        if row in mage:
            if row['spectrum']['above3500Fraction']>=row['previousSpectrum']['above3500Fraction']:raise ValueError('High-band energy not reduced')
            if row['activeRMSDBFS']>=row['previousActiveRMSDBFS']:raise ValueError('Mage level not reduced')
    diagnostics=[]
    for name in ['types-before.log','types-after.log']:
        txt=(HERE/name).read_text(encoding='utf-8-sig')
        diagnostics.append(re.findall(r'^(assets/[^\(]+)\(\d+,\d+\): error (TS\d+): (.+)$',txt,re.M))
    if diagnostics[1]!=diagnostics[0]:raise ValueError('Type diagnostic regression')
    if re.search(r'uiSelect.*uiOpen.*uiClose',current.split('const SILENT_CUES')[1].split(']);')[0]):raise ValueError('Selections remain muted')
    for name in ['uiSelect','uiOpen','uiClose']:
        if f"{name}: 'ui'" not in current:raise ValueError('Missing UI alias')
    report=dict(changedOriginals=changed,unchangedOriginalFiles=len(before)-len(changed),approvedCuesUnchanged=approved,
        allPriorAudioAndMetadataUnchanged=True,mageFiles=18,gateFiles=2,allMageHighBandAndLevelsReduced=True,
        typeDiagnosticsBefore=len(diagnostics[0]),typeDiagnosticsAfter=len(diagnostics[1]),newTypeDiagnostics=0,
        noTestsGameBrowserOrAudioPlaybackPerformed=True)
    q.write('source-inspection.json',report)
    print(json.dumps(report,ensure_ascii=False))

def build():
    web=ROOT/'build/web-mobile';resources=web/'assets/resources'
    config=json.loads(next(resources.glob('config.*.json')).read_text(encoding='utf8'))
    paths={v[0] for v in config['paths'].values()}
    native={q.p.sha(f):f for f in (resources/'native').rglob('*.wav')}
    manifest=json.loads((HERE/'manifest.json').read_text(encoding='utf8'))
    rows=[]
    for r in manifest['files']:
        rel='audio/v25/'+Path(r['file']).stem
        if rel not in paths or r['sha256'] not in native:raise ValueError('New resource missing '+rel)
        meta=json.loads(Path(str(q.DEST/r['file'])+'.meta').read_text(encoding='utf8'))
        if meta['uuid'] not in native[r['sha256']].name:raise ValueError('UUID mismatch '+rel)
        rows.append(dict(resource=rel,native=native[r['sha256']].relative_to(web).as_posix(),sha256=r['sha256']))
    old=json.loads((ROOT/'docs/audio-kingdom-v24/manifest.json').read_text(encoding='utf8'))
    preserved=[r for r in old['files'] if r['cue'] in ['bow','crossbow','snipe','skill','bowUlt','pierceHeavy','crit','ui']]
    for r in preserved:
        if r['sha256'] not in native:raise ValueError('Approved production recording missing')
    bundle=next((web/'assets/main').glob('index.*.js'));text=bundle.read_text(encoding='utf8')
    for marker in ['gateSlide','gateClose','v25/','queueTapSound']:
        if marker not in text:raise ValueError('Compiled marker missing '+marker)
    encoded=[]
    for file in (HERE/'preview/media').glob('*.mp4'):
        raw=subprocess.check_output([q.p.FF,'-v','error','-i',str(file),'-vn','-ac','1','-ar',str(q.SR),'-f','f32le','-'])
        a=np.frombuffer(raw,'<f4')
        if not len(a) or not np.isfinite(a).all() or np.max(abs(a))>=.99:raise ValueError('Bad preview audio')
        encoded.append(dict(file=file.name,sha256=q.p.sha(file),peakDBFS=round(float(20*np.log10(np.max(abs(a)))),2)))
    q.write('bundle-inspection.json',dict(rows=rows,approvedProductionFilesPreserved=len(preserved),
        nativeHashUUIDAndPathMatch=True,bundle=bundle.relative_to(ROOT).as_posix(),encodedMedia=encoded,
        noTestsGameBrowserOrAudioPlaybackPerformed=True))
    print('Production files: 20 new /',len(preserved),'approved preserved; preview decode checked')

if __name__=='__main__':{'source':source,'build':build}[sys.argv[1]]()
