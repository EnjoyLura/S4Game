"""Review source/types/build bytes and stage production files; no game execution."""
from pathlib import Path
from datetime import datetime
import difflib, hashlib, json, re, shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE / 'before.json'))
expected = sorted('assets/scripts/' + n for n in [
    'config/LevelDifficulty.ts', 'battle/BattleDirector.ts', 'ui/Panels.ts',
    'ui/SettlementPanelSkin.ts', 'ui/BattleRewardPanel.ts', 'ui/LevelLootPreview.ts'])
changed = sorted(n for n, h in before.items() if sha(ROOT / n) != h)
assert changed == expected, changed
current = {p.relative_to(ROOT).as_posix() for folder in ['assets/scripts', 'assets/resources', 'build-templates', 'tools']
           for p in (ROOT / folder).rglob('*') if p.is_file()}
assert current == set(before), 'No new game files expected'
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
assert norm(read(HERE / 'types-before.log')) == norm(read(HERE / 'types-after.log'))
assert read(HERE / 'types-after.log').count('error TS') == 10
diff = ''.join(''.join(difflib.unified_diff(read(HERE / 'before' / n).splitlines(True), read(ROOT / n).splitlines(True),
               fromfile='before/' + n, tofile='after/' + n)) for n in changed)
(HERE / 'review.diff').write_text(diff, encoding='utf-8')
bd = read(ROOT / 'assets/scripts/battle/BattleDirector.ts')
old_bd = read(HERE / 'before/assets/scripts/battle/BattleDirector.ts')
for start, end in [('  private gainXp(', '  private '), ('  private creditBattleGold(', '  /** One pending navigation')]:
    def section(s):
        at = s.index(start)
        return s[at:s.index(end, at + len(start))]
    assert section(bd) == section(old_bd), start
assert 'grantStageMaterials' not in bd
win = bd[bd.index('  private onAllCleared()'):bd.index('  /* ---------- GM')]
assert win.index("this.state = 'win'") < win.index('sv.diamonds += this.levelDef.baseDiamonds;') < win.index('this.creditBattleGold(reward);')
assert win.count('sv.diamonds += this.levelDef.baseDiamonds;') == 1
assert 'xp: Math.floor(this.xpEarned)' not in win
assert win[win.index('onDouble:'):].count('diamonds') == 0
assert 'this.creditBattleGold(reward * 2)' in win
assert 'const battleGold = Math.floor(this.goldEarned + this.levelDef.baseGold * (1 + stars * 0.1));' in win
config = read(ROOT / 'assets/scripts/config/LevelDifficulty.ts')
assert 'const materials: MaterialReward[] = [];' in config
assert 'baseDiamonds: DIFFICULTIES[d].diamonds' in config
assert [int(n) for n in re.findall(r'goldMul: [\d.]+, diamonds: (\d+)', config)] == [10, 15, 20]
skin = read(ROOT / 'assets/scripts/ui/SettlementPanelSkin.ts')
assert "'已获得奖励', gold, diamonds, loot, note" in skin
assert ' xp' not in skin
assert 'ui_icon_diamond' in read(ROOT / 'assets/scripts/ui/BattleRewardPanel.ts')
weights = ROOT / 'docs/card-offer-weights-v54'
weight_record = json.loads(read(weights / 'deployment-stage.json'))
assert weight_record['groupWeights'] == dict(stats=.1, combat=3, support=1)
assert sha(ROOT / 'assets/scripts/config/Cards.ts') == before['assets/scripts/config/Cards.ts']
web = ROOT / 'build/web-mobile'
release = json.loads(read(web / 'web-release.json'))
prior_doc = ROOT / 'docs/mora-cards-v53'
prior_release = json.loads(read(prior_doc / 'web-release.json'))
assert release['production'] and release['md5Cache']
assert release['entry'] != prior_release['entry']
assert release['engineRevision'] == prior_release['engineRevision']
engine = read(next((web / 'cocos-js').glob('_virtual_cc-*.js')))
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in engine
bundle = read(next((web / 'assets/main').glob('index.*.js')))
assert re.search(r'\{\s*stats:\s*(?:0)?\.1,\s*combat:\s*3,\s*support:\s*1\s*\}', bundle)
for marker in ['baseDiamonds', 'settlementDiamondNumber', '金币和钻石已到账', 'moraUltimateHitDamage',
               'moraFieldFreeze', 'voltStrikeCount', 'pyroMeteorCount', 'ui_card_mora_freeze_linger_v1', 'goblin_king_walk_v1']:
    assert marker in bundle, marker
prior = Path(json.loads(read(prior_doc / 'deployment-stage.json'))['stage'])
resource_files = [p for p in (prior / 'assets/resources').rglob('*') if p.is_file()]
for p in resource_files:
    assert sha(p) == sha(web / p.relative_to(prior)), p.relative_to(prior)
stage = ROOT / 'build' / ('publish-clear-currencies-v55-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, stage, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior / 'previews', stage / 'previews')
previews = [p for p in (prior / 'previews').rglob('*') if p.is_file()]
for p in previews:
    assert sha(p) == sha(stage / 'previews' / p.relative_to(prior / 'previews'))
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(originalFilesChecked=len(before), changedExistingFiles=changed, addedFiles=[],
    includedPriorChange='Card offer weights v54: stats .1 / combat 3 / support 1; no separate v54 deployment.',
    totalChangedScriptsSinceV53=7, preExistingTypeErrors=10, typeDiagnosticsUnchanged=True,
    allOriginalMediaUnchanged=True, productionResourceFilesUnchanged=len(resource_files),
    rewardRules=dict(gold='Original kill/star/first-win formula and ad doubling unchanged', diamondsByDifficulty=[10,15,20],
        repeatClearGrantsDiamonds=True, failureGrantsDiamonds=False, exitGrantsDiamonds=False, adDoublesDiamonds=False,
        clearMaterialsRemoved=True, runExperienceUnchanged=True, firstWinEquipmentAndHeroesUnchanged=True,
        starChestsUnchanged=True, oldInventoryUnchanged=True),
    stage=str(stage), published=False, project='kingdom-watch', branch='main', priorPreviewFilesPreserved=len(previews),
    entryVersion=version, game='https://kingdom-watch.pages.dev/?v=clear-currencies-v55-' + version,
    manualAcceptance='Static source/assets/type/build/HTTP only; no tests, game, browser, combat simulation or audio. User manual acceptance.')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web / name, HERE / name)
for name in ['publish.ps1', 'check-publication.py']:
    shutil.copy2(weights / name, HERE / name)
print('Static review: 6 reward scripts changed; 1900 original files reviewed; 10 prior type diagnostics unchanged.')
print('Included v54 weights; production resource bytes preserved:', len(resource_files), '| previews:', len(previews))
print('Staged:', stage)
print(record['game'])
