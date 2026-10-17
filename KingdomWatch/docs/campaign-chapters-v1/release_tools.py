"""Source/artifact bookkeeping only; does not execute game code or access the live site."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import difflib
import json
import re
import subprocess
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game / 'build/web-mobile'
sources = ['assets/scripts/config/Campaign.ts', 'assets/scripts/config/Campaign.ts.meta',
    'assets/scripts/config/Mobs.ts', 'assets/scripts/config/LevelDifficulty.ts',
    'assets/scripts/core/GameData.ts', 'assets/scripts/core/Flow.ts',
    'assets/scripts/battle/BattleDirector.ts', 'assets/scripts/ui/HUD.ts',
    'assets/scripts/ui/BattleEntryWarmup.ts', 'assets/scripts/ui/pages/LevelsPage.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def prepare():
    script = (game / 'docs/archer-art-quality-v2/publish.ps1').read_text(encoding='utf-8-sig')
    script = script.replace('docs/equipment-quality-v1/deployment-stage.json', 'docs/archer-art-quality-v2/deployment-stage.json')
    script = script.replace('archer-art-quality-v2-', 'campaign-chapters-v1-')
    script = script.replace('new front archer standing illustration and two simplified bows; neutral equipment panels with rarity only on circular wells and upper-left tags',
        'three chapter scenes with ten stages each; chapter route layout, sequential progression, shared battlefield mapping and chapter-tier rewards')
    (out / 'publish.ps1').write_text(script, encoding='utf-8')
    write('source-hashes.json', {rel: hashlib.sha256((game / rel).read_bytes()).hexdigest() for rel in sources})
    delta = subprocess.run(['git', '-c', 'core.quotepath=false', 'diff', 'd888caf', '--',
        *['KingdomWatch/' + rel for rel in sources]], cwd=game.parent, capture_output=True, check=True).stdout
    for rel in sources[:2]:
        delta += ''.join(difflib.unified_diff([], (game / rel).read_text(encoding='utf-8').splitlines(True),
            fromfile='/dev/null', tofile='KingdomWatch/' + rel)).encode('utf-8')
    (out / 'source-review.diff').write_bytes(delta)
    # Read the explicit chapter arrays as configuration text; never import or evaluate Campaign.ts.
    text = (game / sources[0]).read_text(encoding='utf-8')
    rows = []
    for c, names in enumerate(re.findall(r'stages: \[([^\]]*)\]', text)):
        for i, name in enumerate(re.findall(r"'([^']*)'", names)):
            rows.append({'id': f'{c+1}-{i+1}', 'name': name, 'chapter': c+1})
    write('stage-inventory.json', {'source': sources[0], 'method': 'parse explicit name arrays as text',
        'chapterStageCounts': [sum(row['chapter'] == c for row in rows) for c in [1, 2, 3]], 'stages': rows})
    print(json.dumps({'publisher': str(out / 'publish.ps1'), 'configurationNames': len(rows)}))

def inspect():
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    inventory = read(out / 'stage-inventory.json')
    markers = ['chapterSelect:', 'chapterStageRoute', 'chapterRoutePath', 'selectedStage',
        'scenes/scene_1_1', 'scenes/scene_1_2', 'scenes/scene_1_3']
    record = {'mainBundle': main.relative_to(build).as_posix(),
        'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(), 'mainBundleBytes': main.stat().st_size,
        'chapterStageCounts': inventory['chapterStageCounts'],
        'compiledStageNames': {row['id']: row['name'] in code for row in inventory['stages']},
        'compiledMarkers': {marker: marker in code for marker in markers},
        'existingSceneFiles': {key: (game / 'assets/resources/scenes' / key).exists() for key in
            ['scene_1_1.png', 'scene_1_2.jpg', 'scene_1_3.jpg', 'bg_levels_outpost_comic_v2.jpg',
             'bg_levels_forest_comic_v2.jpg', 'bg_levels_lair_comic_v2.jpg']},
        'inspection': 'read local configuration, compiled text and asset paths only; no game/test/browser/online acceptance',
        'manualAcceptance': 'pending user'}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    record['typeReview'] = {'fullProjectPassed': False, 'scope': 'assets/scripts with Cocos declarations and ES2020',
        'diagnosticFiles': sorted(set(re.findall(r'^(assets/[^\(]+)\(', diagnostics, re.M))),
        'note': 'existing ButtonFeedback lifecycle field/type cascade and UINotice overload diagnostics remain; no diagnostics in changed modules'}
    write('bundle-inspection.json', record)
    if inventory['chapterStageCounts'] != [10, 10, 10] or not all(record['compiledStageNames'].values()) or not all(record['compiledMarkers'].values()) or not all(record['existingSceneFiles'].values()):
        raise RuntimeError('Local build artifact is incomplete; publication stopped')
    print(json.dumps(record, ensure_ascii=False))

def record():
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    log = (out / 'publish.log').read_text(encoding='utf-8-sig')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
    if not urls:
        raise RuntimeError('Successful Wrangler receipt required')
    milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    digest = hashlib.sha256((Path(stage['stage']) / inspection['mainBundle']).read_bytes()).hexdigest()
    if digest != inspection['mainBundleSha256']:
        raise RuntimeError('Published stage differs from inspected bundle')
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'checkpoint': 'd888caf',
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': receipt,
        'creatorBuildMilliseconds': milliseconds, 'mainBundleSha256': digest,
        'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
            'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False,
            'onlineAcceptance': False, 'manualAcceptance': 'pending user'}})
    note = (f"2026-10-16 章节闯关v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
        '先按用户要求Git检查点d888caf；本轮章节改动未另行提交。前哨/深林/兽穴三章各十关，章入口与普通通关数、十节点双排折线路线、真实星级/锁定/金色选中/章末标记，短屏上半区滚动，奖励与行动固定。'
        '星级宝箱优先、掉落与编队保持；战斗退出还原当前章节关卡及难度。普通前关一星推进，1-10→2-1→2-10→3-1，三档独立10/12/15波与奖励。'
        '三章复用现有各自场景和怪物，章内属性/数量/增援递进，五号中段精英与十号终波加强；装备池改章级索引避免越界，材料与金币递进。'
        'HUD/入口预热/关卡配置/主线顺序共用Campaign映射，旧星级及已领奖励按原编号保留，无重复发奖、无重置；养成与主城保持。'
        f"Cocos退出码{receipt['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅有原ButtonFeedback、MilestoneSwipe、Panels和UINotice诊断，新改模块无诊断。仅源码和本地产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，布局与平衡由用户人工确认。'
        '详见 [章节闯关](docs/campaign-chapters-v1/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = game / name
        text = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            path.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    path = out / 'README.md'
    if stage['game'] not in path.read_text(encoding='utf-8'):
        with path.open('a', encoding='utf-8') as stream:
            stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {milliseconds}ms；仅静态审阅及构建发布，实际效果由用户人工确认。\n")
    print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))

{'prepare': prepare, 'inspect': inspect, 'record': record}[sys.argv[1]]()
