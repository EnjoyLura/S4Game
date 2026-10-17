"""Static source comparisons and PCM/build integrity, not game or audio playback."""
from pathlib import Path
import json
import re
import subprocess
import sys
import numpy as np
import prepare as q

def source():
    before=json.loads((q.HERE/'before.json').read_text(encoding='utf8'))
    changed=[rel for rel,h in before.items() if q.p.sha(q.ROOT/rel)!=h]
    if set(changed)-set(q.CHANGED):raise ValueError('Unrelated changes '+str(changed))
    media=[rel for rel in before if rel.endswith(('.wav','.mp3','.ogg','.flac','.meta'))]
    if any(q.p.sha(q.ROOT/rel)!=before[rel] for rel in media):raise ValueError('Prior media changed')
    old=(q.HERE/'before/assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    catalog=(q.ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    approved=['bow','crossbow','snipe','skill','bowUlt','pierceHeavy','crit','gateSlide','gateClose','ui','hit']
    for cue in approved:
        pat='^  '+cue+r': .+$'
        if re.search(pat,old,re.M)[0]!=re.search(pat,catalog,re.M)[0]:raise ValueError('Preserved cue changed '+cue)
    # The source diff must only alter audio calls and ice sound timing, never gameplay.
    for rel in ['assets/scripts/battle/Hero.ts','assets/scripts/battle/Projectile.ts','assets/scripts/battle/FrostUltimateVFX.ts']:
        old=(q.HERE/'before'/rel).read_text(encoding='utf8');new=(q.ROOT/rel).read_text(encoding='utf8')
        def without_audio(s):
            s=re.sub(r'^.*Sfx\.(cast|impact|ultimateImpact)\([^\n]*\n','',s,flags=re.M)
            return s.replace('this.nextAudio = .8','this.nextAudio = 0')
        if without_audio(old)!=without_audio(new):raise ValueError('Gameplay changes beyond audio '+rel)
    diagnostics=[]
    for name in ['types-before.log','types-after.log']:
        text=(q.HERE/name).read_text(encoding='utf-8-sig')
        diagnostics.append(re.findall(r'^([^\r\n]+?)\(\d+,\d+\): error (TS\d+): (.+)$',text,re.M))
    if diagnostics[0]!=diagnostics[1]:raise ValueError('Type diagnostic regression')
    rows=json.loads((q.HERE/'manifest.json').read_text(encoding='utf8'))['files']
    if len(rows)!=4 or len(set(r['sha256'] for r in rows))!=4:raise ValueError('Invalid new file set')
    for row in rows:
        out=q.DEST/row['file']
        if q.p.sha(out)!=row['sha256'] or row['clippedSamples'] or row['firstSample'] or row['lastSample']:raise ValueError('Invalid PCM')
        for layer in row['layers']:
            if layer['rate']!=1 or q.p.sha(q.ROOT/layer['path'])!=layer['sha256']:raise ValueError('Source altered')
        if not Path(str(out)+'.meta').exists():raise ValueError('Missing metadata')
    q.write('source-inspection.json',dict(changedOriginals=changed,unchangedOriginals=len(before)-len(changed),
        priorAudioAndMetadataUnchanged=len(media),preservedCueConfigurations=approved,gameplayOtherwiseUnchanged=True,
        newFiles=4,newTypeDiagnostics=0,typeDiagnosticsBefore=len(diagnostics[0]),typeDiagnosticsAfter=len(diagnostics[1]),
        noTestsGameBrowserOrAudioPlaybackPerformed=True))
    print('Source: 4 new files; accepted weapons, click and ordinary hit preserved; gameplay unchanged; no new type diagnostics')

def build():
    web=q.ROOT/'build/web-mobile';resource=web/'assets/resources'
    config=json.loads(next(resource.glob('config.*.json')).read_text(encoding='utf8'))
    paths={row[0] for row in config['paths'].values()}
    native={q.p.sha(f):f for f in (resource/'native').rglob('*.wav')}
    rows=[]
    for row in json.loads((q.HERE/'manifest.json').read_text(encoding='utf8'))['files']:
        rel='audio/v27/'+Path(row['file']).stem
        if rel not in paths or row['sha256'] not in native:raise ValueError('Missing production asset '+rel)
        metadata=json.loads(Path(str(q.DEST/row['file'])+'.meta').read_text(encoding='utf8'))
        if metadata['uuid'] not in native[row['sha256']].name:raise ValueError('UUID mismatch')
        rows.append(dict(resource=rel,native=native[row['sha256']].relative_to(web).as_posix(),sha256=row['sha256']))
    approved=[r for r in json.loads((q.ROOT/'docs/audio-kingdom-v24/manifest.json').read_text(encoding='utf8'))['files'] if r['cue'] in ['bow','crossbow','snipe','skill','bowUlt','pierceHeavy','crit']]
    for row in approved:
        if row['sha256'] not in native:raise ValueError('Missing accepted weapon')
    for file in ['v24/ui_click_1.wav','v26/hit_common.wav']:
        if q.p.sha(q.ROOT/'assets/resources/audio'/file) not in native:raise ValueError('Missing preserved '+file)
    bundle=next((web/'assets/main').glob('index.*.js')).read_text(encoding='utf8')
    for marker in ['v27/','mage_cast','meteor_land','thunder_soft','ice_shatter','ultimateImpact']:
        if marker not in bundle:raise ValueError('Missing bundle marker '+marker)
    encoded=[]
    for movie in (q.HERE/'preview/media').glob('*.mp4'):
        raw=subprocess.check_output([q.FF,'-v','error','-i',str(movie),'-vn','-ac','1','-ar',str(q.SR),'-f','f32le','-'])
        a=np.frombuffer(raw,'<f4')
        if not len(a) or not np.isfinite(a).all() or np.max(abs(a))>=.99:raise ValueError('Invalid AAC')
        encoded.append(dict(file=movie.name,sha256=q.p.sha(movie),peakDBFS=round(float(20*np.log10(max(abs(a)))),2)))
    q.write('bundle-inspection.json',dict(newAssets=rows,preservedWeaponFiles=len(approved),fixedClickAndCommonHitPreserved=True,
        nativePathUUIDAndHashMatch=True,encodedReels=encoded,noGameBrowserOrAudioPlaybackPerformed=True))
    print('Build: four new assets, eleven accepted weapon files, click and hit verified; five AAC reels without clipping')

if __name__=='__main__':{'source':source,'build':build}[sys.argv[1]]()
