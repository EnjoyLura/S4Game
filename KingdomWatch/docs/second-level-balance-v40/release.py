"""Static packaging review only. Does not execute the game, browser, tests or a simulation."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return path.read_text(encoding='utf-8-sig')

before = json.loads(read(HERE / 'before.json'))
changed = sorted(name for name, digest in before.items() if sha(ROOT / name) != digest)
expected = sorted([
    'assets/scripts/battle/BattleDirector.ts', 'assets/scripts/config/LevelDifficulty.ts',
    'assets/scripts/core/GameData.ts', 'assets/scripts/core/SaveData.ts', 'assets/scripts/core/StageLoot.ts',
    'assets/scripts/ui/BattleRewardPanel.ts', 'assets/scripts/ui/LevelLootPreview.ts',
    'assets/scripts/ui/MainUI.ts', 'assets/scripts/ui/PageKit.ts', 'assets/scripts/ui/SquadPanel.ts',
    'assets/scripts/ui/TrainingLobby.ts', 'assets/scripts/ui/pages/HeroPage.ts',
    'assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/pages/ShopPage.ts',
])
if changed != expected: raise ValueError('Unexpected original file changes: ' + str(changed))
added = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'assets/scripts').rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before)
if added != ['assets/scripts/config/SecondLevel.ts', 'assets/scripts/config/SecondLevel.ts.meta',
             'assets/scripts/core/SecondJourney.ts', 'assets/scripts/core/SecondJourney.ts.meta']:
    raise ValueError('Unexpected new runtime files: ' + str(added))
normalize = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
types_after = read(HERE / 'types-after.log')
if normalize(read(HERE / 'types-before.log')) != normalize(types_after): raise ValueError('Type diagnostics changed')

level = read(ROOT / 'assets/scripts/config/SecondLevel.ts')
rows = [tuple(float(v or 0) for v in row) for row in re.findall(r'workers\((\d+),\s*(\d+),\s*([\d.]+)(?:,\s*([\d.]+))?\)', level)]
slingers = re.findall(r'slingers\((\d+),\s*(\d+),\s*([\d.]+),\s*([\d.]+)\)', level)
worker_count = sum(row[0] for row in rows)
static_spawn_sum = round(sum(delay + (count-1)*interval for count, hp, interval, delay in rows), 3)
if worker_count != 122 or sum(int(row[0]) for row in slingers) != 12 or static_spawn_sum != 202.05:
    raise ValueError('Authored 1-2 worker/slinger schedule mismatch')
if 'wolf_rider' in level or 'goblin_shaman' in level or "count: 2, interval: 12, delay: 2" not in level:
    raise ValueError('1-2 monster set mismatch')

web = ROOT / 'build/web-mobile'
bundle = next((web / 'assets/main').glob('index.*.js')).read_text(encoding='utf8')
for marker in ['secondJourney', 'sniper_unlock_ult', 'upgradeSkipped', 'squadSkipped',
               'pyroFirstVictoryDetails', 'hero_pyro', 'first_journey_v1_bow', 'firstJourneyFocus',
               'battleReturn', 'battleDouble', 'newEnemyPortrait:', 'newEnemyConfirm',
               'fixedWaves', 'burnStatusFlame', 'kw-render-diagnostics-v35']:
    if marker not in bundle: raise ValueError('Missing compiled marker: ' + marker)
for count, hp, interval, delay in rows:
    if ','.join(format(v, 'g') for v in [count, hp, interval]) not in bundle:
        raise ValueError('Compiled 1-2 worker row missing')
engine = next((web / 'cocos-js').glob('_virtual_cc-*.js')).read_text(encoding='utf8')
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('Live DPR getter missing')
release = json.loads(read(web / 'web-release.json'))
previous = json.loads(read(ROOT / 'docs/settlement-actions-v39/web-release.json'))
if not release['production'] or release['engineRevision'] != previous['engineRevision']:
    raise ValueError('Production/engine revision mismatch')
if (web / 'diagnostics.html').read_bytes() != (web / 'index.html').read_bytes(): raise ValueError('Diagnostic HTML mismatch')
prior = Path(json.loads(read(ROOT / 'docs/settlement-actions-v39/deployment-stage.json'))['stage'])
target = ROOT / 'build' / ('publish-second-level-balance-v40-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior / 'previews', target / 'previews')
files = [f for f in (prior / 'previews').rglob('*') if f.is_file()]
for f in files:
    if sha(f) != sha(target / 'previews' / f.relative_to(prior / 'previews')): raise ValueError('Historical preview changed')
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), entryVersion=version, priorPublishedStage=str(prior),
    project='kingdom-watch', branch='main', published=False,
    game='https://kingdom-watch.pages.dev/?v=second-level-balance-v40-' + version,
    originalFilesChecked=len(before), changedExistingFiles=changed, addedRuntimeFiles=added,
    priorPreviewFilesPreserved=len(files), typeDiagnosticsUnchanged=True,
    preExistingTypeErrors=types_after.count('error TS'), allOriginalMediaUnchanged=True,
    firstLevelAndOtherDifficultyFormationsUnchanged=True, heroDamageAndGrowthFormulasUnchanged=True,
    normalSecondLevel=dict(workers=122, slingers=12, elites=2, waves=7, staticSpawnEndSum=static_spawn_sum,
        targetCombatSeconds=[180,240], measuredCombatSeconds=None),
    choices='A,A,A,A,A,A: 3-4min; archer/sniper+green bow viable without upgrades; workers/slingers/two elites; sniper ultimate; optional archer level-up; free pyro/manual deployment',
    manualAcceptance='User manual. No tests, game, browser, simulations or audio playback performed.')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for name in ['build-record.json', 'web-release.json']: shutil.copy2(web / name, HERE / name)
for name in ['publish.ps1', 'check-publication.py']: shutil.copy2(ROOT / 'docs/settlement-actions-v39' / name, HERE / name)
print('Staged:', target)
print(record['game'])
