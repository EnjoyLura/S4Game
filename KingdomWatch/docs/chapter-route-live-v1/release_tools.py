"""Source and local build artifact inspection; never launches the game."""
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
changed = ['assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/CampaignRoute.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare():
    publisher = (game / 'docs/audio-levels-v1/publish.ps1').read_text(encoding='utf-8-sig')
    publisher = publisher.replace("docs/lobby-ui-quiet-v2/deployment-stage.json", "docs/audio-levels-v1/deployment-stage.json")
    publisher = publisher.replace('audio-levels-v1-', 'chapter-route-live-v1-')
    publisher = publisher.replace('BGM and SFX buses +3.01 dB; existing audio, attribution and mix dynamics retained',
        'three chapter terrain maps; scrollable live checkpoints and stage preparation drawer; existing progression and reward transactions retained')
    (out / 'publish.ps1').write_text(publisher, encoding='utf-8')
    write('source-hashes.json', {rel: digest(game / rel) for rel in changed})
    old = (out / 'before/LevelsPage.ts.txt').read_text(encoding='utf-8-sig').splitlines(True)
    now = (game / changed[0]).read_text(encoding='utf-8-sig').splitlines(True)
    (out / 'source-review.diff').write_text(''.join(difflib.unified_diff(old, now,
        fromfile='before/' + changed[0], tofile=changed[0])), encoding='utf-8')
    print('Source snapshot and publisher prepared.')

def inspect():
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    markers = ['campaignRouteLobby', 'campaignTerrain', 'campaignLiveCheckpoints', 'CampaignRouteMotion',
        'campaignChapterHeader', 'campaignCurrentStage', 'campaignPreparationDrawer', 'campaignStartBattle',
        'campaignStarChest:', 'campaignDropIcon:', 'campaignSquadPortrait:', 'rewardPopupConfirm',
        'bg_campaign_', '巢穴核心']
    retired = ['chapterStageRoute', 'levelUpperScene', 'rewardShelf', 'rewardTabs']
    retained = {row['path']: digest(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] not in changed}
    current = {rel: digest(game / rel) == value for rel, value in read(out / 'source-hashes.json').items()}
    art = read(out / 'art.json')
    native_hashes = {}
    for path in (build / 'assets/resources/native').rglob('*.png'):
        if path.stat().st_size > 3000000:
            native_hashes[digest(path)] = path.relative_to(build).as_posix()
    shipped = {row['chapter']: {'sourceUnchanged': digest(game / row['path']) == row['sha256'],
        'nativePath': native_hashes.get(row['sha256'])} for row in art}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig').strip()
    prior = (game / 'docs/audio-levels-v1/type-review.log').read_text(encoding='utf-8-sig').strip()
    record = {'mainBundle': main.relative_to(build).as_posix(), 'mainBundleBytes': main.stat().st_size,
        'mainBundleSha256': digest(main), 'compiledMarkers': {m: m in code for m in markers},
        'retiredLayoutAbsent': {m: m not in code for m in retired}, 'retainedSources': retained,
        'currentSources': current, 'terrainAssets': shipped,
        'typeReview': {'fullProjectPassed': False, 'samePriorDiagnostics': diagnostics == prior,
            'samePriorPrimaryDiagnostics': re.findall(r'^assets/.*error TS.*$', diagnostics, re.M)
                == re.findall(r'^assets/.*error TS.*$', prior, re.M),
            'changedModulesHaveDiagnostics': any(rel + '(' in diagnostics for rel in changed),
            'files': sorted(set(re.findall(r'^(assets/[^\(]+)\(', diagnostics, re.M)))},
        'scope': 'source, image metadata, local compiled bundle and native artifact hashes only',
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', record)
    if not all(record['compiledMarkers'].values()) or not all(record['retiredLayoutAbsent'].values()) \
        or not all(retained.values()) or not all(current.values()) \
        or not all(row['sourceUnchanged'] and row['nativePath'] for row in shipped.values()) \
        or record['typeReview']['changedModulesHaveDiagnostics']:
        raise RuntimeError('Local artifact inspection incomplete; publication stopped.')
    print(json.dumps({k: record[k] for k in ['mainBundle', 'mainBundleSha256', 'terrainAssets', 'typeReview']}))

def record():
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    log = (out / 'publish.log').read_text(encoding='utf-8-sig')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
    if not urls:
        raise RuntimeError('Successful Wrangler receipt required.')
    milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)',
        Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    if digest(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainBundleSha256']:
        raise RuntimeError('Staged bundle differs from inspected artifact.')
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1],
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': receipt,
        'creatorBuildMilliseconds': milliseconds, 'mainBundleSha256': inspection['mainBundleSha256'],
        'validation': {'sourceReview': True, 'localArtifactInspection': True, 'cocosBuild': True, 'DPRPatch': True,
            'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False,
            'onlineAcceptance': False, 'manualAcceptance': 'pending user'}})
    note = (f"2026-10-16 章节路线地图v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
        '按效果稿重构关卡页：前哨/深林/兽穴三张内置imagegen原创连续地图，每章十个实时旗帜节点；'
        '地图上下惯性拖动、拖动取消点选、章节和位置记忆，已通关蓝旗/当前金旗/未解锁灰旗，实际星级及可领宝箱红点。'
        '点击节点或出战准备展开底部纸面，选中地标留在面板上方；普通/精英/地狱10/12/15波、宝箱优先、掉落图标详情、四人编队及固定开始战斗；'
        '短屏纸面滚动，关闭恢复地图位置，战斗退出定位原关卡难度，编队/领取/难度只局部更新。'
        '沿用关卡解锁、星级、已领奖励与实际到账事务，GameData/Campaign/LevelDifficulty/战斗/音频及其他原脚本散列保持，无存档重置、无数值变更，未追加Git提交。'
        '三张完整PNG原图无像素编辑、资源来源及提示词留档；仅加载当前章底图。'
        f"Cocos退出码{receipt['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅只有原诊断，改动模块无诊断；仅源码与本地产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，实际效果由用户人工确认。'
        '详见 [章节路线地图](docs/chapter-route-live-v1/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = game / name
        content = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at = content.index('\n')
            path.write_text(content[:at+1] + '\n' + note + '\n' + content[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as stream:
        stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {milliseconds}ms，实际视觉交互由用户人工确认。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))

{'prepare': prepare, 'inspect': inspect, 'record': record}[sys.argv[1]]()
