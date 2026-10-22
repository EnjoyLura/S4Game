"""Package a production build and record static source/media identities. Does not execute game code."""
from pathlib import Path
from datetime import datetime
import difflib, hashlib, json, re, shutil, zipfile

DOC = Path(__file__).resolve().parent
ROOT = DOC.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(DOC/'before-assets.json'))
current = {p.relative_to(ROOT).as_posix():sha(p) for p in (ROOT/'assets').rglob('*') if p.is_file()}
missing = sorted(set(before)-set(current))
if missing: raise RuntimeError('Original files missing: '+str(missing))
changed = sorted(n for n,h in before.items() if current[n]!=h)
added = sorted(set(current)-set(before))
if any(n.startswith('assets/resources/') for n in changed): raise RuntimeError('Original artwork/audio changed')
if current['assets/scripts/battle/Hero.ts']!=before['assets/scripts/battle/Hero.ts']: raise RuntimeError('Hero mechanics changed')
def diagnostics(text):
    return sorted(re.sub(r'\(\d+,\d+\)','(LINE,COL)',line) for line in text.splitlines() if re.match(r'^assets/.*error TS',line))
baseline = diagnostics(read(ROOT/'docs/endless-world-map-v63/types-after.log'))
actual = diagnostics(read(DOC/'type-diagnostics.txt'))
if actual!=baseline: raise RuntimeError('New TypeScript diagnostics: '+str(actual))
art = json.loads(read(DOC/'imported-art.json'))
if len(art)!=42 or sum(len(a.get('frames',{})) for a in art)!=90: raise RuntimeError('Incomplete artwork')
for a in art:
    if sha(ROOT/'assets/resources'/a['file'])!=a['sha256']: raise RuntimeError('Generated PNG was altered: '+a['file'])
web = ROOT/'build/web-mobile'
release = json.loads(read(web/'web-release.json'))
prior = Path(json.loads(read(ROOT/'docs/endless-world-map-v63/deployment-stage.json'))['stage'])
if not release['production'] or not release['md5Cache']: raise RuntimeError('Not a production build')
if release['engineRevision']!='2cb74a1e8caa095a': raise RuntimeError('Unexpected engine change')
bundle = next((web/'assets/main').glob('index.*.js'))
code = read(bundle)
for value in ['裂隙王座','mountain_drill','forest_spider','mobs_rift_v66','enemyTelegraph','spawnOffspring','endlessWorldMapPage','bg_endless_world_v66']:
    if value not in code: raise RuntimeError('Missing compiled feature: '+value)
if '.prototype.ultShowDuration' in code: raise RuntimeError('Lightning getter regression')
config = read(next((web/'assets/resources').glob('config.*.json')))
for a in art:
    if a['file'][:-4] not in config: raise RuntimeError('Unregistered resource: '+a['file'])
native = {p.relative_to(web).as_posix():sha(p) for p in (web/'assets/resources/native').rglob('*') if p.is_file()}
old_native = {p.relative_to(prior).as_posix():sha(p) for p in (prior/'assets/resources/native').rglob('*') if p.is_file()}
for n,h in old_native.items():
    if native.get(n)!=h: raise RuntimeError('Prior native media missing or changed: '+n)
new_native = sorted(set(native)-set(old_native))
if len(new_native)!=42: raise RuntimeError('Unexpected native image count: '+str(len(new_native)))
if not {a['sha256'] for a in art}<={native[n] for n in new_native}: raise RuntimeError('Native PNG identity mismatch')
stage = ROOT/'build'/('publish-campaign-v66-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
preview_files = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in preview_files:
    if sha(p)!=sha(stage/'previews'/p.relative_to(prior/'previews')): raise RuntimeError('Preview changed')
diff = []
with zipfile.ZipFile(DOC/'before-scripts.zip') as archive:
    for name in archive.namelist():
        relative = name if name.startswith('assets/') else 'assets/scripts/'+name
        if relative in changed:
            diff.extend(difflib.unified_diff(archive.read(name).decode('utf-8-sig').replace('\r\n','\n').splitlines(True),read(ROOT/relative).splitlines(True),fromfile=relative+' (before)',tofile=relative))
(DOC/'review.diff').write_text(''.join(diff),encoding='utf-8')
version = re.search(r'\?v=(\d+)',release['entry'])[1]
record = dict(originalFilesChecked=len(before),changedExistingFiles=changed,addedGameFiles=added,
              preExistingTypeErrors=len(actual),typeDiagnosticsUnchanged=True,chapters=16,stages=160,newEnemies=75,codexEntries=81,
              originalNativeMediaPreserved=len(old_native),newNativeMedia=new_native,originalPngBytesPreserved=True,
              priorPreviewFilesPreserved=len(preview_files),stage=str(stage),published=False,project='kingdom-watch',branch='main',entryVersion=version,
              game='https://kingdom-watch.pages.dev/?v=campaign-v66-'+version,
              manualAcceptance='No game/browser/gameplay tests/simulation/audio executed; source/type/build/media/HTTP identity inspection only. User manual acceptance.',
              limitations=['Initial balance only','New enemies use static artwork, no newly generated animation videos','Existing licensed BGM tracks are reused by biome'])
(DOC/'deployment-stage.json').write_text(json.dumps(record,indent=2,ensure_ascii=False),encoding='utf-8')
for name in ['build-record.json','web-release.json']: shutil.copy2(web/name,DOC/name)
shutil.copy2(ROOT/'docs/endless-world-map-v63/publish.ps1',DOC/'publish.ps1')
print(json.dumps({k:record[k] for k in ['stage','game','chapters','stages','newEnemies','preExistingTypeErrors']},ensure_ascii=False))
print('Original media:',len(old_native),'New images:',len(new_native),'Preserved previews:',len(preview_files))
print('Changed original files:',len(changed),'Added files:',len(added))
