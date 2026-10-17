"""Read source and built files only; no game, browser, tests or simulation."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game / 'build/web-mobile'
changed = ['assets/scripts/ui/LevelLootPreview.ts', 'assets/scripts/ui/pages/LevelsPage.ts',
    'assets/scripts/ui/GearQuality.ts', 'assets/scripts/ui/pages/HeroPage.ts',
    'assets/scripts/ui/pages/ShopPage.ts', 'assets/scripts/ui/TrainingLobby.ts',
    'assets/scripts/ui/PageKit.ts', 'assets/scripts/ui/pages/UpgradePage.ts']

def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

if sys.argv[1] == 'inspect':
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    patches = []
    for rel in changed:
        before = (out / 'before' / (Path(rel).name + '.txt')).read_text(encoding='utf-8-sig').splitlines(True)
        after = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
        patches.extend(difflib.unified_diff(before, after, fromfile='before/' + rel, tofile=rel))
    (out / 'source-review.diff').write_text(''.join(patches), encoding='utf-8')
    retained = {row['path']: sha(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] not in changed}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (game / 'docs/chapter-checkpoints-v1/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', prior, re.M)
    levels = (game / changed[1]).read_text(encoding='utf-8-sig')
    opening = levels.split('function openDrawer(', 1)[1].split('function closeDrawer(', 1)[0]
    closing = levels.split('function closeDrawer(', 1)[1].split('function renderSheet(', 1)[0]
    markers = ['stageGuaranteedReward:', 'stageDropQualityTile:', 'stageDropQualityAccent',
        'lootPoolItem:', 'campaignPreparationDrawer', 'campaignLockedTerrainShade',
        'campaignCheckpointOutpost', 'campaignCheckpointForest', 'campaignCheckpointLair']
    source_review = {
        'drawerOpeningDoesNotRecenterTerrain': 'focusMap(' not in opening and 'scrollMap(' not in opening,
        'drawerOpeningStopsTerrainInertia': 'mapScroll?.stopAutoScroll()' in opening,
        'drawerClosingDoesNotMoveTerrain': 'scrollMap(' not in closing,
        'completePreparationEquipmentPool': 'challenge.gearPool.forEach(' in levels and 'gearPool.slice(' not in levels,
        'guaranteedRewardsIndependentOfEquipment': 'stageGuaranteedRewards(body,' in levels,
    }
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {rel: sha(game / rel) for rel in changed},
        'compiledMarkers': {m: m in code for m in markers}, 'sourceReview': source_review,
        'retainedSources': retained,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'changedModulesHaveDiagnostics': any(rel + '(' in diagnostics for rel in changed)},
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not all(retained.values()) or not same or result['typeReview']['changedModulesHaveDiagnostics'] \
        or not all(source_review.values()) or not all(result['compiledMarkers'].values()):
        raise RuntimeError('Source/build review requires attention.')
    print(json.dumps({'mainBundle': result['mainBundle'], 'typeReview': result['typeReview'], 'sourceReview': source_review}))
elif sys.argv[1] == 'record':
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] \
        or not all(sha(game / rel) == h for rel, h in inspection['sourceHashes'].items()):
        raise RuntimeError('Deployment receipt or artifact mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': receipt,
        'mainSha256': inspection['mainSha256'], 'creatorBuildMilliseconds': elapsed,
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False})
    note = (f"2026-10-16 掉落布局与展示简化v2已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '三档难度统一显示基础金币及配置中的强化石等材料图标/数量，通关必得与击杀概率装备分组；装备小底板按品质着色、局部色条和品质签，外围纸面保持中性。'
        '准备面板完整装备池六列换行，按行数分配内容高度，保留星箱优先、编队及固定开始按钮；详情目录同样先收益后装备，两列目录可滚动，图标皆可点详情并共用原遮罩返回。'
        '品质角标只显示品质名，商店/穿戴/详情/升级/掉落不再显示装备阶数，Lv等级保留；原tier、属性、价格、奖励和存档保持。'
        '准备弹窗开关取消地图重定位，打开停止残余惯性并记住偏移，返回准备时先还原地图位置。'
        '仅八个UI脚本改动，其他原脚本散列保持，无新素材、无额外Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅仅原有诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，实际画面由用户人工确认。'
        '详见 [掉落布局与展示简化](docs/stage-loot-layout-v2/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = game / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}))
