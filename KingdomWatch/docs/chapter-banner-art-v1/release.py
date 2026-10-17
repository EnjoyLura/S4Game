"""Static source, local image and build artifact review only; no game or browser execution."""
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
changed = ['assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/CampaignChrome.ts']

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
    prior = (game / 'docs/campaign-route-compact-v3/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', prior, re.M)
    levels, chrome = [(game / rel).read_text(encoding='utf-8-sig') for rel in changed]
    original_levels = (out / 'before/LevelsPage.ts.txt').read_text(encoding='utf-8-sig')
    dock = levels.split('function renderDock():',1)[1].split('function openDrawer(',1)[0]
    before_dock = original_levels.split('function renderDock():',1)[1].split('function openDrawer(',1)[0]
    sheet = levels.split('function renderSheet():',1)[1].split('function renderWorld():',1)[0]
    before_sheet = original_levels.split('function renderSheet():',1)[1].split('function renderWorld():',1)[0]
    art = read(out / 'art-provenance.json')
    asset = game / art['asset']
    meta = read(asset.with_suffix('.png.meta'))
    sprite = meta['subMetas']['f9941']['userData']
    native = [p.relative_to(build).as_posix() for p in (build / 'assets/resources/native').rglob('*.png')
        if p.stat().st_size == art['bytes'] and sha(p) == art['assetSha256']]
    configs = list((build / 'assets/resources').glob('config.*.json'))
    resource_present = any('ux/campaign_chrome_v1/chapter_banner_v1' in p.read_text(encoding='utf-8') for p in configs)
    review = {
        'mapTitleAndScrollIconRemoved': '远征地图' not in levels and 'comic_nav_map_v1' not in levels,
        'paintedChapterBackplateIntegrated': 'campaignChapterBanner(header, 0, WY(chapterTop, 100), 694, 100)' in levels
            and "'campaign_chrome_v1/chapter_banner_v1'" in chrome,
        'nativeTextAndProgressRetained': 'CHAPTER_NUMERALS[currentChapter()]' in levels and "stars + '/30'" in levels
            and "'已通关 ' + cleared + '/10'" in levels,
        'nativeInteractiveArrowsRetained': 'campaignChapterArrow(arrow, dir, available)' in levels,
        'originalPngUnchanged': sha(asset) == art['sourceSha256'] == art['assetSha256'],
        'cropOnlyInImporter': [sprite[k] for k in ['trimX','trimY','width','height']] == art['spriteRect']
            and [sprite['rawWidth'],sprite['rawHeight']] == art['sourceSize']
            and 'trim = true' in chrome,
        'fallbackHiddenAfterLoad': 'belowIdx: 0' in chrome,
        'bottomActionsUnchanged': dock == before_dock,
        'drawerUnchanged': sheet == before_sheet,
        'routeAndRemainingSourcesUnchanged': all(retained.values()),
        'resourceRegistered': resource_present,
        'originalPngPackaged': bool(native),
    }
    markers = ['campaign_chrome_v1/chapter_banner_v1', 'campaignTopInputGuard', 'campaignMapSquad',
        'campaignPrepare', 'campaignPreparationDrawer', 'campaignCheckpointForest', '__kingdomWatchOverlayBack']
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {rel: sha(game / rel) for rel in changed}, 'sourceReview': review,
        'nativeAssetPaths': native, 'asset': art, 'compiledMarkers': {m:m in code for m in markers},
        'retainedSources': retained, 'typeReview': {'fullProjectPassed':False, 'samePriorPrimaryDiagnostics':same,
            'primaryDiagnosticCount':len(re.findall(r'^assets/.*error TS.*$', diagnostics, re.M)),
            'changedModulesHaveDiagnostics':any(rel+'(' in diagnostics for rel in changed)},
        'testsRun':False, 'simulationRun':False, 'gameRun':False, 'browserRun':False, 'onlineAcceptance':False}
    write('bundle-inspection.json', result)
    if not all(review.values()) or not all(result['compiledMarkers'].values()) or not same \
        or result['typeReview']['changedModulesHaveDiagnostics']:
        raise RuntimeError('Source/artifact review requires attention.')
    print(json.dumps({'mainBundle':result['mainBundle'], 'sourceReview':review, 'typeReview':result['typeReview']}, ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage, receipt, inspection = (read(out / n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] \
        or not all(sha(game / rel) == h for rel,h in inspection['sourceHashes'].items()) \
        or not all(sha(Path(stage['stage']) / rel) == inspection['asset']['assetSha256'] for rel in inspection['nativeAssetPaths']):
        raise RuntimeError('Deployment receipt or artifact mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status':'published', 'deployment':urls[-1], 'build':receipt,
        'mainSha256':inspection['mainSha256'], 'creatorBuildMilliseconds':elapsed,
        'date':datetime.now(timezone(timedelta(hours=8))).isoformat(), 'asset':inspection['asset'],
        'testsRun':False, 'simulationRun':False, 'gameRun':False, 'browserRun':False, 'onlineAcceptance':False})
    note = (f"2026-10-17 章节标题美术背板v1已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '按用户最新要求删除左上卷轴图标和远征地图文字，保留连续路线地图。参照用户效果图由内置imagegen制作透明深蓝金边、两端收尖牌匾，章节主条替换为实际PNG；标题、真实通关/星级和左右箭头由代码显示与交互。'
        '完整2098×749 RGBA原图无像素修改，以导入矩形隔离透明留白，章节栏694×100保持源牌匾比例；图片载入后隐藏程序兜底。共用节点名称牌、章节坐标、底部按钮与编队、准备抽屉及其返回行为保持。'
        '仅LevelsPage/CampaignChrome两UI脚本改动，其他原脚本散列保持，无数值/奖励/存档变化，无额外Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅仅原十项主诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，实际效果由用户人工确认。'
        '详见 [章节标题美术背板](docs/chapter-banner-art-v1/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path = game / name
        text = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as file:
        file.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]}, ensure_ascii=False))
