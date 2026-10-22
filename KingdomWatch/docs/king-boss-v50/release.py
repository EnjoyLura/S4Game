"""Static asset/source/type audit and release packaging. Does not execute the game."""
from pathlib import Path
from datetime import datetime
import difflib
import hashlib
import json
import math
import re
import shutil
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE / 'before.json'))
changed = sorted(n for n, h in before.items() if sha(ROOT / n) != h)
expected = sorted(['assets/scripts/battle/MobAnim.ts', 'assets/scripts/battle/Monster.ts',
    'assets/scripts/battle/WaveManager.ts', 'assets/scripts/config/FifthLevel.ts',
    'assets/scripts/config/LevelDifficulty.ts', 'assets/scripts/config/Mobs.ts',
    'assets/scripts/core/GameData.ts', 'assets/scripts/ui/BattleEntryWarmup.ts',
    'assets/scripts/ui/HUD.ts', 'assets/scripts/ui/pages/BasePage.ts', 'assets/scripts/ui/pages/LevelsPage.ts'])
assert changed == expected, changed
new = sorted(p.relative_to(ROOT).as_posix() for folder in ['assets/scripts', 'assets/resources', 'build-templates', 'tools']
    for p in (ROOT / folder).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before)
assert new == sorted('assets/resources/ux/goblin_king_walk_v1' + ext for ext in ['.png', '.png.meta', '.frames.json', '.frames.json.meta']), new
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
types = read(HERE / 'types-after.log')
assert norm(read(HERE / 'types-before.log')) == norm(types)
assert types.count('error TS') == 10

review = []
for name in changed:
    p = HERE / 'before' / name
    assert sha(p) == before[name], name
    review.extend(difflib.unified_diff(read(p).splitlines(True), read(ROOT / name).splitlines(True), fromfile='before/' + name, tofile='after/' + name))
(HERE / 'review.diff').write_text(''.join(review), encoding='utf-8')
art = json.loads(read(HERE / 'art-record.json'))
for name, h in art['sourceHashes'].items():
    assert sha(ROOT / name) == h, name
png = ROOT / 'assets/resources/ux/goblin_king_walk_v1.png'
sheet = Image.open(png).convert('RGBA')
assert sheet.size == (1536, 1440) and sha(png) == art['pngSha256']
manifest = json.loads(read(ROOT / 'assets/resources/ux/goblin_king_walk_v1.frames.json'))
assert list(manifest['frames']) == ['goblin_king_w' + str(i) for i in range(30)]
assert manifest['cycles']['goblin_king'] == 1.25
assert manifest['walkSpeeds']['goblin_king'] == 17.5
assert len(manifest['ground']['goblin_king']['feet']) == 30
for k, rect in enumerate(manifest['frames'].values()):
    x, y, w, h = rect
    assert rect == [k % 6 * 256, k // 6 * 288, 256, 288]
    original = Image.open(ROOT / 'docs/video-sequence-20261018/loop-30-frames' / f'goblin_king_w{k:03d}.png').convert('RGBA')
    expected_frame = Image.new('RGBA', (w, h))
    expected_frame.alpha_composite(original.resize((w, h), Image.Resampling.LANCZOS))
    assert sheet.crop((x, y, x+w, y+h)).tobytes() == expected_frame.tobytes()

source = read(ROOT / 'assets/scripts/config/Mobs.ts')
assert "hp: 4800, dmg: 80, atkInterval: 4, speed: 17.5, radius: 48" in source
assert "gold: 50, color: '#6D963F', boss: true" in source
assert "stage.chapter === 1 && (stage.stage === 5 || stage.stage === 10) && index === base.waves.length - 1" in source
assert "groups.unshift({ mob: 'goblin_king', count: 1, interval: 1, delay: 0 })" in source
fifth = read(ROOT / 'assets/scripts/config/FifthLevel.ts')
assert "actual: { hp: 7000, dmg: 30 }" in fifth and '[king(), workers(34, 480, .8, 2)' in fifth
assert "count: g.mob === 'goblin_king' ? g.count" in read(ROOT / 'assets/scripts/config/LevelDifficulty.ts')
assert 'MOBS[g.mob]?.boss ? g.count : Math.round(g.count * cntMul)' in read(ROOT / 'assets/scripts/battle/WaveManager.ts')

web = ROOT / 'build/web-mobile'
bundle = read(next((web / 'assets/main').glob('index.*.js')))
for marker in ['goblin_king_walk_v1', 'goblin_king', 'bossHp', 'walkSpeeds', '哥布林王压阵', '免疫冰封',
               'EARLY_FIRST_WIN_GOLD', '普攻伤害倍率', '大招伤害倍率']:
    assert marker in bundle, marker
config = json.loads(read(next((web / 'assets/resources').glob('config.*.json'))))
paths = [v[0] for v in config['paths'].values()]
assert 'ux/goblin_king_walk_v1' in paths and 'ux/goblin_king_walk_v1.frames' in paths
meta = json.loads(read(png.with_suffix('.png.meta')))
native = list((web / 'assets/resources/native').rglob(meta['uuid'] + '*.png'))
assert len(native) == 1 and sha(native[0]) == sha(png)
release = json.loads(read(web / 'web-release.json'))
prior_doc = ROOT / 'docs/codex-battle-art-v49'
previous = json.loads(read(prior_doc / 'web-release.json'))
assert release['production'] and release['engineRevision'] == previous['engineRevision']
engine = read(next((web / 'cocos-js').glob('_virtual_cc-*.js')))
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in engine
prior = Path(json.loads(read(prior_doc / 'deployment-stage.json'))['stage'])
target = ROOT / 'build' / ('publish-king-boss-v50-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior / 'previews', target / 'previews')
files = [p for p in (prior / 'previews').rglob('*') if p.is_file()]
for p in files:
    assert sha(p) == sha(target / 'previews' / p.relative_to(prior / 'previews'))

# Static arithmetic only, following the configuration and published ramp constants.
stats = []
for level in [5, 10]:
    for d in range(3):
        if level == 5 and d == 0:
            hp, dmg, wave = 7000, 30, 8
        else:
            wave = [10, 12, 15][d]
            stat = (1 + (level - 1) * .055) * [1, 1.6, 2.4][d]
            hp = math.floor(4800 * 2 * stat * (1 + .15 * (wave - 1)) + .5)
            dmg = math.floor(80 / 3 * stat * (1 + .08 * (wave - 1)) + .5)
        stats.append(dict(level='1-' + str(level), difficulty=d, wave=wave, count=1, hp=hp, lineDamage=dmg))
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), published=False, project='kingdom-watch', branch='main', entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=king-boss-v50-' + version,
    originalFilesChecked=len(before), changedExistingFiles=changed, addedFiles=new,
    priorPreviewFilesPreserved=len(files), preExistingTypeErrors=10, typeDiagnosticsUnchanged=True,
    allOriginalMediaUnchanged=True, kingFrames=30, loopSeconds=1.25,
    kingNativePath=native[0].relative_to(web).as_posix(), kingNativeSha256=sha(native[0]), bossStats=stats,
    scope='King walk loop and boss role at chapter-one 1-5/1-10, all three difficulties; normal 1-5 replaces its final elite at unchanged 7000HP/30 damage; others add one final-wave king. Boss count is not multiplied. Warnings, boss-only HP bar, codex and discovery portrait synchronized. No summons/enrage added.',
    manualAcceptance='Static source/assets/type/build/HTTP only. No tests, game, browser, combat simulation or audio playback; user performs acceptance.')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web / name, HERE / name)
shutil.copy2(prior_doc / 'publish.ps1', HERE / 'publish.ps1')
print('Staged:', target)
print(record['game'])
print('Preserved previews:', len(files), '| original media unchanged; 10 original type diagnostics unchanged.')
