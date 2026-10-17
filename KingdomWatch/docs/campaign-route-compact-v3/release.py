"""Source and artifact inspection only. Does not execute game, tests, browser or simulation."""
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
changed = ['assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/CampaignRoute.ts', 'assets/scripts/ui/CampaignChrome.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if sys.argv[1] == 'inspect':
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    diff = []
    for rel in changed:
        before = (out / 'before' / (Path(rel).name + '.txt')).read_text(encoding='utf-8-sig').splitlines(True)
        after = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
        diff.extend(difflib.unified_diff(before, after, fromfile='before/' + rel, tofile=rel))
    (out / 'source-review.diff').write_text(''.join(diff), encoding='utf-8')
    retained = {row['path']: sha(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] not in changed}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (game / 'docs/campaign-ui-polish-v2/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', prior, re.M)
    levels = (game / changed[0]).read_text(encoding='utf-8-sig')
    route = (game / changed[1]).read_text(encoding='utf-8-sig')
    dock = levels.split('function renderDock():', 1)[1].split('function openDrawer(', 1)[0]
    sheet = levels.split('function renderSheet():', 1)[1].split('function renderWorld():', 1)[0]
    opening = levels.split('function openDrawer(', 1)[1].split('function closeDrawer(', 1)[0]
    closing = levels.split('function closeDrawer(', 1)[1].split('function renderSheet(', 1)[0]
    review = {
        'dock102High': 'const dockH = 102' in levels,
        'noDockPaper': 'campaignDockPaper' not in levels and '当前关卡' not in dock,
        'prepareButtonItselfCentered': 'comicButton(dock, 0, actionY, 354, 82' in dock,
        'squadRightOfPreparation': 'comicButton(dock, 272, actionY, 136, 82' in dock,
        'terrainContinuesBehindActions': "pageScroll(content, 'campaignTerrain', mapTop, bottom, mapContentH" in levels,
        'noTitleBackplate': 'campaignTitleFlag' not in levels and "'远征地图'" in levels,
        'smallerChapterPanel': 'WY(chapterTop, 80), 694, 80' in levels,
        'compactUpperRoute': '[.81, .315], [.56, .25]' in route and '[.42, .385], [.61, .355]' in route,
        'fixedPreparationSizes': 'body.setScale' not in sheet and 'available / bodyH' not in sheet
            and "pageScroll(panel, 'campaignPreparation'" in sheet,
        'noSquadInsideDrawer': 'heroPortrait(' not in sheet and '出战阵容' not in sheet and 'campaignSquad' not in sheet,
        'illustratedRewardChests': 'comic_chest_open_v1' in sheet and 'comic_chest_closed_v1' in sheet,
        'completeEquipmentPoolAndMaterialIcons': 'challenge.gearPool.forEach(' in sheet and 'stageGuaranteedRewards(body,' in sheet,
        'drawerNeverRecentersMap': 'focusMap(' not in opening and 'scrollMap(' not in opening and 'scrollMap(' not in closing,
        'battleReturnClosesDrawer': 'st.drawer = false;' in levels.split('const focus = flow.levelReturn;', 1)[1].split('while (st.d',1)[0],
    }
    markers = ['campaignMapSquad', 'campaignPrepare', 'campaignPreparationDrawer', 'campaignPreparation',
        'campaignChapterHeader', 'campaignCheckpointForest', 'campaignLockedTerrainShade',
        'stageGuaranteedReward:', 'stageDropQualityTile:', '__kingdomWatchOverlayBack']
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {rel: sha(game / rel) for rel in changed},
        'sourceReview': review, 'compiledMarkers': {m: m in code for m in markers}, 'retainedSources': retained,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'changedModulesHaveDiagnostics': any(rel + '(' in diagnostics for rel in changed)},
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not all(review.values()) or not all(retained.values()) or not all(result['compiledMarkers'].values()) \
        or not same or result['typeReview']['changedModulesHaveDiagnostics']:
        raise RuntimeError('Source/artifact review requires attention.')
    print(json.dumps({'mainBundle': result['mainBundle'], 'typeReview': result['typeReview'], 'sourceReview': review}))
elif sys.argv[1] == 'record':
    stage, receipt, inspection = (read(out / n) for n in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
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
    note = (f"2026-10-17 地图悬浮操作与准备抽屉回调v3已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '用户否定加高底栏与按屏高整页缩放后，操作区恢复102高并删除整条纸面/水印/关卡文字条；地图铺到导航，出战准备自身居中，编队独立放其右。5–10关沿道路更密集，9/10下移，第十关12%→25%。'
        '保留路线地图，按用户澄清仅删除远征地图标题底牌；章节牌90→80高、单深蓝轮廓配细边光，去掉宽大明暗切面。'
        '抽屉恢复原828高度上限、固定字号/间距和原插画宝箱，删除按屏高缩放和拉大留白；六列显示完整装备，短屏/多行沿用原滚动区，固定开始按钮。阵容标题/四头像/编队入口全部移出抽屉，金币材料图标与装备详情、一键领奖保持。'
        '战斗返回和主页面切换自动关闭、编队手机返回、开关抽屉不移动地形均保留。仅LevelsPage/CampaignRoute/CampaignChrome三UI脚本改动，其余原脚本散列保持，无数值/奖励/存档变化，无额外Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅只有原诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，效果由用户人工确认。'
        '详见 [地图悬浮操作与准备抽屉回调](docs/campaign-route-compact-v3/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = game / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}))
