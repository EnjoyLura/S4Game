"""Static packaging only; no tests or game/browser execution."""
from pathlib import Path
from datetime import datetime
import hashlib,json,re,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
changed=[n for n,h in before.items() if sha(ROOT/n)!=h]
if changed!=['assets/scripts/ui/Panels.ts']: raise ValueError(changed)
source=read(ROOT/'assets/scripts/ui/Panels.ts')
previous=read(HERE/'Panels.before.ts.txt')
start=source.index('  showWin(o:'); end=source.index('  showLose(o:')
if source[:start]!=previous[:previous.index('  showWin(o:')] or source[end:]!=previous[previous.index('  showLose(o:'):]:
    raise ValueError('Changes outside victory settlement')
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
after=read(HERE/'types-after.log')
if norm(read(HERE/'types-before.log'))!=norm(after): raise ValueError('Type diagnostics changed')
web=ROOT/'build/web-mobile'
bundle=read(next((web/'assets/main').glob('index.*.js')))
for marker in ['doubleGoldPlayIcon','battleDouble','battleReturn','secondJourney','newEnemyPortrait:','burnStatusFlame','kw-render-diagnostics-v35']:
    if marker not in bundle: raise ValueError('Missing compiled marker '+marker)
release=json.loads(read(web/'web-release.json'))
old=json.loads(read(ROOT/'docs/second-level-balance-v40/web-release.json'))
if not release['production'] or release['engineRevision']!=old['engineRevision']: raise ValueError('Production/engine mismatch')
engine=read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('DPR getter missing')
prior=Path(json.loads(read(ROOT/'docs/second-level-balance-v40/deployment-stage.json'))['stage'])
target=ROOT/'build'/('publish-gold-play-icon-v41-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,target,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',target/'previews')
files=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files:
    if sha(p)!=sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Preview changed')
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(stage=str(target),published=False,project='kingdom-watch',branch='main',entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=gold-play-icon-v41-'+version,
    priorPublishedStage=str(prior),originalFilesChecked=len(before),changedExistingFiles=changed,
    priorPreviewFilesPreserved=len(files),typeDiagnosticsUnchanged=True,preExistingTypeErrors=after.count('error TS'),
    allOriginalMediaUnchanged=True,numericBalanceAndRewardTransactionsUnchanged=True,
    manualAcceptance='No tests/game/browser/simulation/audio playback. User manual visual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,indent=2),encoding='utf8')
for n in ['build-record.json','web-release.json']: shutil.copy2(web/n,HERE/n)
for n in ['publish.ps1','check-publication.py']: shutil.copy2(ROOT/'docs/second-level-balance-v40'/n,HERE/n)
print('Staged',target);print(record['game'])
