"""Static source/build packaging only; no tests or game/browser execution."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil, difflib
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
changed = sorted(n.replace('\\','/') for n,h in before.items() if sha(ROOT/n) != h)
expected = sorted('assets/scripts/'+n for n in ['battle/BattleDirector.ts', 'config/LevelDifficulty.ts',
    'core/SaveData.ts', 'ui/LevelLootPreview.ts', 'ui/pages/LevelsPage.ts'])
if changed != expected: raise ValueError('Unexpected original file changes: '+str(changed))
new = sorted(p.relative_to(ROOT).as_posix() for d in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/d).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in {n.replace('\\','/') for n in before})
expected_new = sorted('assets/scripts/'+n for n in ['config/FifthLevel.ts','config/FifthLevel.ts.meta',
    'core/FifthLevelRewards.ts','core/FifthLevelRewards.ts.meta'])
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
for marker in ['FIFTH_LEVEL_WAVES','fifthRewards','fifth_rewards_v1_','wpn_green_crossbow','acc_moon',
    'newEnemyCommonPanel','newEnemyContent','third_journey_v1_book','doubleGoldPlayIcon',
    'campaignStartBattle','entryDone','secondJourney','burnStatusFlame','kw-render-diagnostics-v35']:
    if marker not in bundle: raise ValueError('Missing compiled marker '+marker)
release = json.loads(read(web/'web-release.json'))
previous = json.loads(read(ROOT/'docs/fourth-level-balance-v44/web-release.json'))
if not release['production'] or release['engineRevision'] != previous['engineRevision']:
    raise ValueError('Production/engine mismatch')
engine = read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('DPR getter missing')
prior = Path(json.loads(read(ROOT/'docs/fourth-level-balance-v44/deployment-stage.json'))['stage'])
target = ROOT/'build'/('publish-fifth-level-balance-v45-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews', target/'previews')
files = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files:
    if sha(p) != sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Preview changed')
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), published=False, project='kingdom-watch', branch='main', entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=fifth-level-balance-v45-'+version,
    priorPublishedStage=str(prior), originalFilesChecked=len(before), changedExistingFiles=changed, addedFiles=new,
    priorPreviewFilesPreserved=len(files), typeDiagnosticsUnchanged=True, preExistingTypeErrors=after.count('error TS'),
    allOriginalMediaUnchanged=True, monsterEntryUnchanged=True,
    normalFifthLevel=dict(waves=8, workers=258, slingers=12, riders=8, elites=3, shamans=2, total=283,
        finalElite=dict(hp=7000, damage=30), staticQueueEndSeconds=238.03, combatTargetMinutes=[4,5], measured=False,
        baseline='Archer/sniper/pyro Lv.5, weapons Lv.3; soft recommendation without entry gate or auto-upgrade',
        baseGold=120, materials={'mat_stone':4}, teaching=False, freeCharge=False),
    firstWin=dict(equipment=['wpn_green_crossbow','acc_moon'], countEach=1, instanceLevel=1,
        duplicateProtection='Receipt and both inventory instances saved with victory stars',
        oldClearedAccounts='No retroactive gifts', autoEquip=False, campEquipTutorial=False, freeHero=False),
    economyFollowUp='Lv.5 heroes / Lv.3 weapons cost more than first four base clear rewards; no hard gate or silent compensation.',
    scope='Normal 1-5 waves, soft recommendation, repeatable materials/gold and first-win equipment bundle only.',
    manualAcceptance='No tests/game/browser/simulation/audio playback. Actual balance and duration require user play.')
(HERE/'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for n in ['build-record.json','web-release.json']: shutil.copy2(web/n, HERE/n)
for n in ['publish.ps1','check-publication.py']: shutil.copy2(ROOT/'docs/fourth-level-balance-v44'/n, HERE/n)
print('Staged', target)
print(record['game'])
