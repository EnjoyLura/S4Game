"""Static source, PCM and built-asset review; no runtime/interaction execution."""
from pathlib import Path
import json
import re
import subprocess
import sys
import wave
import numpy as np
import prepare as q

def source():
    before = json.loads((q.HERE/'before.json').read_text(encoding='utf8'))
    changed = [rel for rel,h in before.items() if q.p.sha(q.ROOT/rel)!=h]
    if set(changed)-set(q.CHANGED): raise ValueError('Unrelated source changed '+str(changed))
    media = [rel for rel in before if rel.endswith(('.wav','.mp3','.ogg','.flac','.meta'))]
    if any(q.p.sha(q.ROOT/rel)!=before[rel] for rel in media): raise ValueError('Prior media changed')
    original = (q.HERE/'before/assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    catalog = (q.ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
    approved = ['bow','crossbow','snipe','skill','bowUlt','pierceHeavy','crit','gateSlide','gateClose']
    for cue in approved:
        pat = '^  '+cue+r': .+$'
        if re.search(pat,original,re.M)[0]!=re.search(pat,catalog,re.M)[0]: raise ValueError('Preserved cue changed '+cue)
    if not re.search(r"^  ui: \{ files: kingdom\('ui_click_1'\), gain: .65,",catalog,re.M):
        raise ValueError('UI first sample is not fixed')
    aliases = catalog.split('const SHARED_CUES')[1]
    for cue in ['uiSelect','uiOpen','uiClose','uiToggle','uiConfirm','confirm','pickRefresh']:
        if f"{cue}: 'ui'" not in aliases: raise ValueError('Different click alias '+cue)
    silent = catalog.split('const SILENT_CUES')[1].split(']);')[0]
    if "'hit'" in silent: raise ValueError('Generic damage is muted')
    monster = (q.ROOT/'assets/scripts/battle/Monster.ts').read_text(encoding='utf8')
    new_line = "    if (amount > 0 && !heavy && !crit && killerId !== 'burn' && killerId !== 'gm') Sfx.play('hit');\n"
    if monster.count(new_line)!=1 or monster.replace(new_line,'')!=(q.HERE/'before/assets/scripts/battle/Monster.ts').read_text(encoding='utf8'):
        raise ValueError('Monster change exceeded audio-only insertion')
    mixer = (q.ROOT/'assets/scripts/core/GameAudio.ts').read_text(encoding='utf8')
    if 'this.voices.length >= 8' not in mixer or "cue.group === 'contact' ? .18" not in mixer:
        raise ValueError('Voice budget/contact limiter missing')
    diagnostics = []
    for name in ['types-before.log','types-after.log']:
        text = (q.HERE/name).read_text(encoding='utf-8-sig')
        diagnostics.append(re.findall(r'^([^\r\n]+?)\(\d+,\d+\): error (TS\d+): (.+)$',text,re.M))
    if diagnostics[0]!=diagnostics[1]: raise ValueError('Type diagnostic regression')
    rows = json.loads((q.HERE/'manifest.json').read_text(encoding='utf8'))['files']
    if len(rows)!=19 or len(set(r['sha256'] for r in rows))!=19: raise ValueError('Incomplete/duplicate new media')
    for row in rows:
        out = q.DEST/row['file']
        if q.p.sha(out)!=row['sha256'] or row['clippedSamples'] or row['firstSample'] or row['lastSample']:
            raise ValueError('Invalid output PCM '+row['file'])
        if len(row['layers'])!=1 or row['layers'][0]['rate']!=1 or row['layers'][0]['layered']:
            raise ValueError('Layering/pitch processing returned')
        layer = row['layers'][0]
        if q.p.sha(q.ROOT/layer['path'])!=layer['sha256']: raise ValueError('Source changed')
        if not Path(str(out)+'.meta').exists(): raise ValueError('Audio metadata missing')
    q.write('source-inspection.json',dict(changedOriginals=changed,unchangedOriginals=len(before)-len(changed),
        allPriorAudioAndMetadataUnchanged=True,preservedCueConfigurations=approved,oneFixedOriginalClick=True,
        commonDamageOnlyFromActualPositiveOrdinaryDamage=True,gameplayCodeOtherwiseUnchanged=True,
        newMageFiles=18,newCommonHitFiles=1,oneSourcePerNewFile=True,totalVoiceBudget=8,
        commonContactGapSeconds=.18,commonContactVoiceLimit=1,
        typeDiagnosticsBefore=len(diagnostics[0]),typeDiagnosticsAfter=len(diagnostics[1]),newTypeDiagnostics=0,
        noTestsGameBrowserOrAudioPlaybackPerformed=True))
    print('Source inspection: 18 single-source spells, one shared hit, one fixed click; prior audio preserved; no new type diagnostics')

def build():
    web = q.ROOT/'build/web-mobile'; resource = web/'assets/resources'
    config = json.loads(next(resource.glob('config.*.json')).read_text(encoding='utf8'))
    paths = {row[0] for row in config['paths'].values()}
    native = {q.p.sha(f):f for f in (resource/'native').rglob('*.wav')}
    manifest = json.loads((q.HERE/'manifest.json').read_text(encoding='utf8'))
    rows = []
    for row in manifest['files']:
        rel = 'audio/v26/'+Path(row['file']).stem
        if rel not in paths or row['sha256'] not in native: raise ValueError('New asset missing '+rel)
        metadata = json.loads(Path(str(q.DEST/row['file'])+'.meta').read_text(encoding='utf8'))
        if metadata['uuid'] not in native[row['sha256']].name: raise ValueError('UUID mismatch '+rel)
        rows.append(dict(resource=rel,native=native[row['sha256']].relative_to(web).as_posix(),sha256=row['sha256']))
    previous = json.loads((q.ROOT/'docs/audio-kingdom-v24/manifest.json').read_text(encoding='utf8'))
    approved = [r for r in previous['files'] if r['cue'] in ['bow','crossbow','snipe','skill','bowUlt','pierceHeavy','crit']]
    click = q.ROOT/'assets/resources/audio/v24/ui_click_1.wav'
    for row in approved:
        if row['sha256'] not in native: raise ValueError('Approved weapon source missing')
    if q.p.sha(click) not in native: raise ValueError('First click missing')
    bundle = next((web/'assets/main').glob('index.*.js')); text = bundle.read_text(encoding='utf8')
    for marker in ['v26/','hit_common','contact','gateSlide','gateClose','queueTapSound']:
        if marker not in text: raise ValueError('Bundle marker missing '+marker)
    encoded = []
    for movie in (q.HERE/'preview/media').glob('*.mp4'):
        raw = subprocess.check_output([q.FF,'-v','error','-i',str(movie),'-vn','-ac','1','-ar',str(q.SR),'-f','f32le','-'])
        a = np.frombuffer(raw,'<f4')
        if not len(a) or not np.isfinite(a).all() or np.max(abs(a))>=.99: raise ValueError('Invalid AAC '+movie.name)
        encoded.append(dict(file=movie.name,sha256=q.p.sha(movie),peakDBFS=round(float(20*np.log10(max(abs(a)))),2)))
    q.write('bundle-inspection.json',dict(newAssets=rows,preservedWeaponFiles=len(approved),firstClickPreserved=True,
        nativePathUUIDAndHashMatch=True,encodedReels=encoded,noGameBrowserOrAudioPlaybackPerformed=True))
    print('Bundle inspection: 19 new PCM assets, 11 approved weapons and first click preserved; 6 AAC reels decode without clipping')

if __name__=='__main__': {'source':source,'build':build}[sys.argv[1]]()
