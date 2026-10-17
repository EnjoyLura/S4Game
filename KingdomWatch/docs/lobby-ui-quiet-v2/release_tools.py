"""Read source/build artifacts and retain publish receipts; never execute the game."""
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
sources = ['assets/scripts/ui/pages/ShopPage.ts', 'assets/scripts/ui/pages/HeroPage.ts',
    'assets/scripts/ui/pages/BasePage.ts', 'assets/scripts/ui/pages/LevelsPage.ts',
    'assets/scripts/ui/HeroComic.ts', 'assets/scripts/ui/TrainingLobby.ts',
    'assets/scripts/ui/ResourceBar.ts', 'assets/scripts/ui/MainUI.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare():
    prior = game / 'docs/lobby-ui-quiet-v1'
    publisher = (prior / 'publish.ps1').read_text(encoding='utf-8-sig')
    publisher = publisher.replace('docs/reward-chests-v1/deployment-stage.json', 'docs/lobby-ui-quiet-v1/deployment-stage.json')
    publisher = publisher.replace('lobby-ui-quiet-v1-', 'lobby-ui-quiet-v2-')
    publisher = publisher.replace('quiet upgrade lobby and level reward shelf; circular hero and skill selections, tonal milestone cards and borderless reward statuses',
        'quiet shop, hero, base and chapter navigation; shared round hero selector, neutral item surfaces, wallet and bottom navigation')
    (out / 'publish.ps1').write_text(publisher, encoding='utf-8')
    write('source-hashes.json', {rel: digest(game / rel) for rel in sources})
    guard = read(prior / 'retained-source-hashes.json')
    guard.update(read(prior / 'source-hashes.json'))
    write('retained-source-hashes.json', {rel: value for rel, value in guard.items() if rel not in sources})
    diff = []
    for rel in sources:
        before = (out / 'before' / (Path(rel).name + '.txt')).read_text(encoding='utf-8-sig').splitlines(True)
        after = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
        diff.extend(difflib.unified_diff(before, after, fromfile='before/' + rel, tofile=rel))
    (out / 'source-review.diff').write_text(''.join(diff), encoding='utf-8')
    print(json.dumps({'publisher': str(out / 'publish.ps1'), 'sourceFiles': len(sources)}))

def inspect():
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    markers = ['comicSurface', 'heroRosterSelection', 'heroRosterNameTag', 'trainingSkillSelection',
        'milestoneNext', 'shopItemCount', 'heroItemBadge', 'baseStat:', 'chapterTabs',
        'levelNodeFace', 'levelSelectionHalo', 'rewardTabs', 'rewardClaimHint',
        'rewardPopupPanel', 'rewardPopupConfirm', 'chapterStageRoute', '巢穴核心']
    retired = ['trainingDivider', 'rewardDivider', 'shelfRule', 'storeCounterEdge']
    retained = {rel: digest(game / rel) == value for rel, value in read(out / 'retained-source-hashes.json').items()}
    current = {rel: digest(game / rel) == value for rel, value in read(out / 'source-hashes.json').items()}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior_diagnostics = (game / 'docs/lobby-ui-quiet-v1/type-review.log').read_text(encoding='utf-8-sig')
    record = {'mainBundle': main.relative_to(build).as_posix(), 'mainBundleBytes': main.stat().st_size,
        'mainBundleSha256': digest(main), 'compiledTextMarkers': {m: m in code for m in markers},
        'retiredDecorationAbsent': {m: m not in code for m in retired},
        'retainedChapterRewardAndSharedStyleSources': retained, 'currentSourceHashesMatch': current,
        'typeReview': {'fullProjectPassed': False, 'matchesPreviousDiagnostics': diagnostics == prior_diagnostics,
            'diagnosticFiles': sorted(set(re.findall(r'^(assets/[^\(]+)\(', diagnostics, re.M))),
            'changedModulesHaveDiagnostics': any(rel + '(' in diagnostics for rel in sources)},
        'inspection': 'source diff, local hashes and compiled text only; no tests, simulation, game, browser or online acceptance',
        'manualAcceptance': 'pending user'}
    write('bundle-inspection.json', record)
    if not all(record['compiledTextMarkers'].values()) or not all(record['retiredDecorationAbsent'].values()) \
        or not all(retained.values()) or not all(current.values()) or record['typeReview']['changedModulesHaveDiagnostics']:
        raise RuntimeError('Local artifact inspection incomplete; publication stopped')
    print(json.dumps(record, ensure_ascii=True))

def record():
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    log = (out / 'publish.log').read_text(encoding='utf-8-sig')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
    if not urls:
        raise RuntimeError('Successful publication receipt required')
    milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    published_digest = digest(Path(stage['stage']) / inspection['mainBundle'])
    if published_digest != inspection['mainBundleSha256']:
        raise RuntimeError('Published bundle differs from inspected artifact')
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1],
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': receipt,
        'creatorBuildMilliseconds': milliseconds, 'mainBundleSha256': published_digest,
        'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
            'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False,
            'onlineAcceptance': False, 'manualAcceptance': 'pending user'}})
    note = (f"2026-10-16 其余主页面视觉收敛v2已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
        '延续升级页方向：商店货架/商品卡去框、已拥有等改文字；英雄和升级共用圆头像金环名字签，装备栏/五槽/背包用中性淡底，品质色只在圆底和角标；'
        '基地建筑名牌去轮廓，建设栏去高光分隔并用淡底耐久/护盾信息块；关卡章节/难度用整条深色导航，节点去重复圈弧，当前关卡说明去框。'
        '五页共用资源栏和加号去细高光轮廓，底部导航取消横线/选中细高光；主要购买、战斗、升级按钮保留单轮廓。'
        '横向滑动、偏移记忆、武器栏左右等分、装备垂直对齐、背包过滤及点击、建筑锚点滚动、单遮罩弹窗、实际数值和奖励事务保持。'
        '无新运行素材、无数值/存档变更，章节/奖励/ComicUI散列保持，未追加Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅只有既有ButtonFeedback等诊断，改动模块无诊断；仅源码与本地产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，实际视觉交互由用户人工确认。'
        '详见 [其余主页面视觉收敛](docs/lobby-ui-quiet-v2/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = game / name
        text = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            path.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    path = out / 'README.md'
    if stage['game'] not in path.read_text(encoding='utf-8'):
        with path.open('a', encoding='utf-8') as stream:
            stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {milliseconds}ms，实际效果由用户人工确认。\n")
    print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))

{'prepare': prepare, 'inspect': inspect, 'record': record}[sys.argv[1]]()
