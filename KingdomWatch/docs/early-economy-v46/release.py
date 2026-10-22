"""Static source/build packaging only; no tests or game/browser execution."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil, difflib
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
changed = sorted(n for n,h in before.items() if sha(ROOT/n) != h)
expected = sorted('assets/scripts/'+n for n in ['battle/BattleDirector.ts','core/SaveData.ts','ui/LevelLootPreview.ts','ui/Panels.ts'])
if changed != expected: raise ValueError('Unexpected original file changes: '+str(changed))
new = sorted(p.relative_to(ROOT).as_posix() for d in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/d).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before)
expected_new = sorted('assets/scripts/'+n for n in ['config/EarlyEconomy.ts','config/EarlyEconomy.ts.meta',
    'core/EarlyEconomy.ts','core/EarlyEconomy.ts.meta'])
if new != expected_new: raise ValueError('Unexpected additions: '+str(new))
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
after = read(HERE/'types-after.log')
if norm(read(HERE/'types-before.log')) != norm(after): raise ValueError('Type diagnostics changed')
parts = []
for n in changed:
    parts.extend(difflib.unified_diff(read(HERE/'before'/n).splitlines(True), read(ROOT/n).splitlines(True),
        fromfile='before/'+n, tofile='after/'+n))
(HERE/'review.diff').write_text(''.join(parts), encoding='utf8')
web = ROOT/'build/web-mobile'
bundle = read(next((web/'assets/main').glob('index.*.js')))
for marker in ['EARLY_FIRST_WIN_GOLD','earlyFirstWinGold','claimEarlyFirstWinGold','earlyGold','firstWinGold',
    'FIFTH_LEVEL_WAVES','fifthRewards','fifth_rewards_v1_','wpn_green_crossbow','acc_moon',
    'newEnemyCommonPanel','newEnemyContent','third_journey_v1_book','doubleGoldPlayIcon',
    'campaignStartBattle','entryDone','secondJourney','burnStatusFlame','kw-render-diagnostics-v35']:
    if marker not in bundle: raise ValueError('Missing compiled marker '+marker)
release = json.loads(read(web/'web-release.json'))
previous = json.loads(read(ROOT/'docs/fifth-level-balance-v45/web-release.json'))
if not release['production'] or release['engineRevision'] != previous['engineRevision']:
    raise ValueError('Production/engine mismatch')
engine = read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('DPR getter missing')
prior = Path(json.loads(read(ROOT/'docs/fifth-level-balance-v45/deployment-stage.json'))['stage'])
target = ROOT/'build'/('publish-early-economy-v46-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews', target/'previews')
files = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files:
    if sha(p) != sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Preview changed')
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), published=False, project='kingdom-watch', branch='main', entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=early-economy-v46-'+version,
    priorPublishedStage=str(prior), originalFilesChecked=len(before), changedExistingFiles=changed, addedFiles=new,
    priorPreviewFilesPreserved=len(files), typeDiagnosticsUnchanged=True, preExistingTypeErrors=after.count('error TS'),
    allOriginalMediaUnchanged=True, allMonsterWavesUnchanged=True, cultivationCostsUnchanged=True,
    firstWinGold={'1-1':200,'1-2':400,'1-3':800,'1-4':2000},
    budget=json.loads(read(HERE/'budget.json')),
    advertising='Existing full victory gold x2, including gold actually granted as the first-win bonus in that battle; optional acceleration for discretionary cultivation.',
    receipts='First-win receipt, credited gold, stars and gifts committed together. No new claim button; duplicate wins excluded.',
    oldSaves='Previously cleared stages ineligible, no retroactive money; uncleared stages remain eligible; existing inventory/growth retained.',
    scope='Normal 1-1 through 1-4 one-time gold bonus, previews, settlement note and receipt migration only. Repeat rewards, costs, waves, first-win gear/heroes and ad semantics retained.',
    manualAcceptance='No tests/game/browser/simulation/audio playback. Static budget arithmetic is not gameplay acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for n in ['build-record.json','web-release.json']: shutil.copy2(web/n, HERE/n)
for n in ['publish.ps1','check-publication.py']: shutil.copy2(ROOT/'docs/fifth-level-balance-v45'/n, HERE/n)
print('Staged', target)
print(record['game'])
