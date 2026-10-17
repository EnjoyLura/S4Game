"""Inspect saved source and production files only; never run game, browser or simulation."""
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
changed = ['assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/CampaignRoute.ts',
    'assets/scripts/ui/CampaignCheckpointArt.ts', 'assets/scripts/ui/CampaignChrome.ts',
    'assets/scripts/ui/MainUI.ts', 'assets/scripts/ui/SquadPanel.ts', 'assets/scripts/ui/BrowserBack.ts']

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
        p = out / 'before' / (Path(rel).name + '.txt')
        before = p.read_text(encoding='utf-8-sig').splitlines(True) if p.exists() else []
        after = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
        patches.extend(difflib.unified_diff(before, after, fromfile='before/' + rel, tofile=rel))
    (out / 'source-review.diff').write_text(''.join(patches), encoding='utf-8')
    retained = {row['path']: sha(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] not in changed}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (game / 'docs/stage-loot-layout-v2/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', prior, re.M)
    levels = (game / changed[0]).read_text(encoding='utf-8-sig')
    opening = levels.split('function openDrawer(', 1)[1].split('function closeDrawer(', 1)[0]
    closing = levels.split('function closeDrawer(', 1)[1].split('function renderSheet(', 1)[0]
    sheet = levels.split('function renderSheet(', 1)[1].split('function renderWorld(', 1)[0]
    returned = levels.split('const focus = flow.levelReturn;', 1)[1].split('while (st.d', 1)[0]
    main_ui = (game / changed[4]).read_text(encoding='utf-8-sig')
    squad = (game / changed[5]).read_text(encoding='utf-8-sig')
    back = (game / changed[6]).read_text(encoding='utf-8-sig')
    markers = ['campaignScrollingCanopy', 'campaignTitleFlag', 'campaignCurrentParchment',
        'campaignDockCastleWatermark', 'campaignCarvedArrow', 'campaignRewardChest:',
        'campaignLockSeal', 'campaignPreparationContent', 'campaignSquadGoldRim',
        '__kingdomWatchOverlayBack', 'BrowserBackLifetime', 'campaignLockedTerrainShade',
        'stageGuaranteedReward:', 'stageDropQualityTile:']
    review = {
        'mapContentIncludesHeaderInset': 'const mapContentH = mapInsetTop + mapHeight;' in levels
            and 'dockTop, mapContentH' in levels and '-mapInsetTop - mapHeight / 2' in levels
            and "pins = N('campaignLiveCheckpoints', map, 0, -mapInsetTop)" in levels,
        'mapClampingIncludesHeaderInset': 'Math.min(mapContentH - mapViewH, offset)' in levels,
        'tallerCurrentStageDock': 'const dockH = 150' in levels,
        'drawerDoesNotRecenterTerrain': 'focusMap(' not in opening and 'scrollMap(' not in opening
            and 'scrollMap(' not in closing,
        'drawerStopsTerrainInertia': 'mapScroll?.stopAutoScroll()' in opening,
        'drawerHasNoInnerScroll': 'pageScroll(' not in sheet and 'ScrollView' not in sheet
            and "N('campaignPreparationContent'" in sheet and 'available / bodyH' in sheet,
        'completeEquipmentPool': 'challenge.gearPool.forEach(' in sheet and 'gearPool.slice(' not in sheet,
        'battleReturnClosesDrawer': 'st.drawer = false;' in returned,
        'tabSwitchClosesDrawer': 'if (i !== 2) closeLevelPreparation();' in main_ui,
        'squadBackBound': 'bindBrowserBack(dim, close)' in squad,
        'nestedConfirmationBackBound': 'bindBrowserBack(modal, () => dismissUI(modal))' in squad,
        'browserBoundaryReusedAndCleaned': 'if (armed ||' in back and "addEventListener('popstate', pop)" in back
            and 'onDestroy(): void { this.release?.();' in back,
    }
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {rel: sha(game / rel) for rel in changed},
        'compiledMarkers': {m: m in code for m in markers}, 'sourceReview': review,
        'retainedSources': retained,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'changedModulesHaveDiagnostics': any(rel + '(' in diagnostics for rel in changed)},
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not all(retained.values()) or not same or result['typeReview']['changedModulesHaveDiagnostics'] \
        or not all(review.values()) or not all(result['compiledMarkers'].values()):
        raise RuntimeError('Source/build review requires attention.')
    print(json.dumps({'mainBundle': result['mainBundle'], 'typeReview': result['typeReview'], 'sourceReview': review}))
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
    note = (f"2026-10-17 章节地图与完整准备抽屉v2已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '地图顶部滚动内容计入悬浮栏安全空间，使第9/10关可移到完整触摸位置；无固定重复地图。当前关卡横条102→150，深色章节牌/金色箭头、石质底座、锁牌和星级局部明暗向效果图靠拢。'
        '准备抽屉取消内部滚动，按可用屏高排布完整宝箱/必得金币材料/概率装备/编队与固定开始按钮；短屏装备紧凑单排并适当缩放，所有池条目保留。原生木/蓝/红宝箱、暖纸/金色难度签/头像金环与按钮，不新增图片。'
        '战斗返回关卡页清除抽屉状态、恢复地图和当前关卡横条；切换其他主页面立即收起。编队完成局部刷新原准备；H5返回键通过单个可复用history边界先退下阵确认或编队，销毁移除注册。打开/关闭准备仍不移动地形。'
        '仅七个UI脚本改动，其他原脚本散列保持，无数值/奖励/存档变更，无额外Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅仅原有诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，实际画面与手机返回由用户人工确认。'
        '详见 [章节地图与完整准备抽屉](docs/campaign-ui-polish-v2/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = game / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}))
