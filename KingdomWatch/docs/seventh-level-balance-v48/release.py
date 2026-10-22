"""Static build packaging only; no tests or game/browser execution."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
changed = sorted(n for n,h in before.items() if sha(ROOT/n) != h)
expected = sorted('assets/scripts/'+n for n in ['config/LevelDifficulty.ts','ui/pages/LevelsPage.ts','ui/TrainingLobby.ts'])
if changed != expected: raise ValueError('Unexpected original file changes: '+str(changed))
new = sorted(p.relative_to(ROOT).as_posix() for d in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/d).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before)
if new != ['assets/scripts/config/SeventhLevel.ts','assets/scripts/config/SeventhLevel.ts.meta']:
    raise ValueError('Unexpected additions: '+str(new))
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
after = read(HERE/'types-after.log')
if norm(read(HERE/'types-before.log')) != norm(after): raise ValueError('Type diagnostics changed')
web = ROOT/'build/web-mobile'
bundle = read(next((web/'assets/main').glob('index.*.js')))
for marker in ['SEVENTH_LEVEL_WAVES','SIXTH_LEVEL_WAVES','EARLY_FIRST_WIN_GOLD','earlyFirstWinGold','claimEarlyFirstWinGold','earlyGold',
    'FIFTH_LEVEL_WAVES','fifthRewards','fifth_rewards_v1_','wpn_green_crossbow','acc_moon',
    'newEnemyCommonPanel','newEnemyContent','third_journey_v1_book','doubleGoldPlayIcon',
    'campaignStartBattle','entryDone','secondJourney','burnStatusFlame','kw-render-diagnostics-v35','普攻伤害倍率','大招伤害倍率']:
    if marker not in bundle: raise ValueError('Missing compiled marker '+marker)
release = json.loads(read(web/'web-release.json'))
previous = json.loads(read(ROOT/'docs/sixth-level-balance-v47/web-release.json'))
if not release['production'] or release['engineRevision'] != previous['engineRevision']:
    raise ValueError('Production/engine mismatch')
engine = read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('DPR getter missing')
prior = Path(json.loads(read(ROOT/'docs/sixth-level-balance-v47/deployment-stage.json'))['stage'])
target = ROOT/'build'/('publish-seventh-level-balance-v48-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews', target/'previews')
files = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files:
    if sha(p) != sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Preview changed')
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), published=False, project='kingdom-watch', branch='main', entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=seventh-level-balance-v48-'+version,
    priorPublishedStage=str(prior), originalFilesChecked=len(before), changedExistingFiles=changed, addedFiles=new,
    priorPreviewFilesPreserved=len(files), typeDiagnosticsUnchanged=True, preExistingTypeErrors=after.count('error TS'),
    allOriginalMediaUnchanged=True, monsterEntryUnchanged=True, cultivationCostsUnchanged=True,
    normalSeventhLevel=dict(waves=10,workers=314,slingers=26,riders=6,elites=4,shamans=4,total=354,
        staticQueueEndSeconds=299.92,combatTargetMinutes=[5,6],measured=False,
        baseline='Archer/sniper/pyro Lv.6, weapons Lv.3; earned green bow/book/crossbow and moon accessory; soft recommendation without entry gate',
        design='Slightly above sixth level; more ranged enemies and one healer per selected second-half wave; sparse sixth wave; 4400-HP final elite',
        baseGold=160,materials={'mat_stone':6},freeHero=False,guaranteedEquipment=False,
        firstWinGold=False,teaching=False,freeCharge=False),
    arithmetic=json.loads(read(HERE/'wave-arithmetic.json')),
    upgradePreview='Normal attack and ultimate cultivation multipliers display 100% to 108% instead of +0% to +8%; right-side increment retained; presentation only',
    scope='Normal 1-7 wave/reward configuration, preparation text and training multiplier display. Earlier levels, other difficulties, economy, stars, saves, hero unlocks and tutorials retained.',
    manualAcceptance='No tests/game/browser/simulation/audio playback. Queue arithmetic is not measured combat duration or difficulty acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for n in ['build-record.json','web-release.json']: shutil.copy2(web/n, HERE/n)
for n in ['publish.ps1','check-publication.py']: shutil.copy2(ROOT/'docs/sixth-level-balance-v47'/n, HERE/n)
print('Staged', target)
print(record['game'])
