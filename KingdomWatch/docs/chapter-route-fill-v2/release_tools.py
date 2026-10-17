"""Review source and built artifacts; never launch game or browser."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
prior = game / 'docs/chapter-route-live-v1'
build = game / 'build/web-mobile'
changed = ['assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/CampaignRoute.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare():
    publisher = (prior / 'publish.ps1').read_text(encoding='utf-8-sig')
    publisher = publisher.replace('docs/audio-levels-v1/deployment-stage.json',
        'docs/chapter-route-live-v1/deployment-stage.json')
    publisher = publisher.replace('chapter-route-live-v1-', 'chapter-route-fill-v2-')
    publisher = publisher.replace(
        'three chapter terrain maps; scrollable live checkpoints and stage preparation drawer; existing progression and reward transactions retained',
        'remove full header dimmer and terrain padding; fill chapter background and join stage dock to navigation')
    (out / 'publish.ps1').write_text(publisher, encoding='utf-8')
    write('source-hashes.json', {rel: digest(game / rel) for rel in changed})
    patches = []
    for rel in changed:
        old = (out / 'before' / (Path(rel).name + '.txt')).read_text(encoding='utf-8-sig').splitlines(True)
        now = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
        patches.extend(difflib.unified_diff(old, now, fromfile='before/' + rel, tofile=rel))
    (out / 'source-review.diff').write_text(''.join(patches), encoding='utf-8')
    print('Source snapshot and publisher prepared.')

def inspect():
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    markers = ['campaignTerrainBackdrop', 'campaignRouteLobby', 'campaignLiveCheckpoints',
        'campaignTopChrome', 'campaignChapterHeader', 'campaignCurrentStage',
        'campaignPreparationDrawer', 'campaignStartBattle', 'campaignStarChest:', 'campaignDropIcon:']
    retained = {row['path']: digest(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] not in changed}
    current = {rel: digest(game / rel) == value for rel, value in read(out / 'source-hashes.json').items()}
    native_hashes = {digest(path): path.relative_to(build).as_posix()
        for path in (build / 'assets/resources/native').rglob('*.png') if path.stat().st_size > 3000000}
    art = {row['chapter']: {'sourceUnchanged': digest(game / row['path']) == row['sha256'],
        'nativePath': native_hashes.get(row['sha256'])} for row in read(prior / 'art.json')}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    old = (prior / 'type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', old, re.M)
    changed_diagnostics = any(rel + '(' in diagnostics for rel in changed)
    record = {'mainBundle': main.relative_to(build).as_posix(), 'mainBundleSha256': digest(main),
        'compiledMarkers': {m: m in code for m in markers},
        'solidTerrainBackingAbsent': 'campaignTerrainBacking' not in code,
        'retainedSources': retained, 'currentSources': current, 'terrainAssets': art,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'changedModulesHaveDiagnostics': changed_diagnostics},
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', record)
    if not all(record['compiledMarkers'].values()) or not record['solidTerrainBackingAbsent'] \
        or not all(retained.values()) or not all(current.values()) \
        or not all(row['sourceUnchanged'] and row['nativePath'] for row in art.values()) \
        or not same or changed_diagnostics:
        raise RuntimeError('Source or local artifact review requires attention.')
    print(json.dumps({k: record[k] for k in ['mainBundle', 'mainBundleSha256', 'typeReview']}))

def record():
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls:
        raise RuntimeError('Successful Wrangler receipt required.')
    milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)',
        Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    if digest(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainBundleSha256']:
        raise RuntimeError('Staged bundle differs from reviewed artifact.')
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1],
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': receipt,
        'creatorBuildMilliseconds': milliseconds, 'mainBundleSha256': inspection['mainBundleSha256'],
        'validation': {'sourceReview': True, 'localArtifactInspection': True, 'cocosBuild': True,
            'DPRPatch': True, 'testsRun': False, 'simulationRun': False, 'gameRun': False,
            'browserRun': False, 'onlineAcceptance': False, 'manualAcceptance': 'pending user'}})
    note = (f"2026-10-16 章节地图铺满修复v2已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '移除顶部整块暗色遮罩，保留资源栏/章节条自身底板；取消地图上下150/70空白，'
        '滚动视口置于章节条下方、上下边界以地图内容约束，长屏等比放大并同步节点与聚焦。'
        '复用当前章地图铺满背景，当前关卡操作栏接到底部导航，取消20单位绿底缝隙。'
        '只修改LevelsPage/CampaignRoute显示与坐标，其他脚本及三张原地图散列保持，无数值/存档变化，未追加Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅仅原有诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，实际视觉由用户人工确认。'
        '详见 [章节地图铺满修复](docs/chapter-route-fill-v2/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = game / name
        content = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at = content.index('\n')
            path.write_text(content[:at+1] + '\n' + note + '\n' + content[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as stream:
        stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {milliseconds}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))

{'prepare': prepare, 'inspect': inspect, 'record': record}[sys.argv[1]]()
