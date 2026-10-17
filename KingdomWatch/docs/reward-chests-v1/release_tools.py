"""Read source/build files and preserve deployment receipts; never execute gameplay."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game / 'build/web-mobile'
sources = ['assets/scripts/core/GameData.ts', 'assets/scripts/ui/RewardPopup.ts',
    'assets/scripts/ui/RewardPopup.ts.meta', 'assets/scripts/ui/pages/LevelsPage.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def prepare():
    script = (game / 'docs/campaign-chapters-v1/publish.ps1').read_text(encoding='utf-8-sig')
    script = script.replace('docs/archer-art-quality-v2/deployment-stage.json', 'docs/campaign-chapters-v1/deployment-stage.json')
    script = script.replace('campaign-chapters-v1-', 'reward-chests-v1-')
    script = script.replace('three chapter scenes with ten stages each; chapter route layout, sequential progression, shared battlefield mapping and chapter-tier rewards',
        'claim all currently earned chests for the selected level and difficulty; credited reward receipt popup with finite card, count and local sparkle animation')
    (out / 'publish.ps1').write_text(script, encoding='utf-8')
    write('source-hashes.json', {rel: hashlib.sha256((game / rel).read_bytes()).hexdigest() for rel in sources})
    print(json.dumps({'publisher': str(out / 'publish.ps1'), 'sourceFiles': len(sources)}))

def inspect():
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda path: path.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    markers = ['rewardPopupPanel', 'rewardPopupItem:', 'rewardPopupConfirm', 'rewardPopupAccents',
        '获得奖励', '已一键领取 ', '奖励已到账', '一键领取', '当前关卡尚无可领取的宝箱',
        'chapterStageRoute', 'chapterSelect:', '守望堡垒', '深林腹地', '巢穴核心']
    old = read(game / 'docs/campaign-chapters-v1/source-hashes.json')
    retained = {rel: hashlib.sha256((game / rel).read_bytes()).hexdigest() == digest
        for rel, digest in old.items() if rel not in sources}
    diagnostic = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    record = {'mainBundle': main.relative_to(build).as_posix(), 'mainBundleBytes': main.stat().st_size,
        'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
        'compiledTextMarkers': {marker: marker in code for marker in markers},
        'retainedChapterSources': retained,
        'typeReview': {'fullProjectPassed': False,
            'diagnosticFiles': sorted(set(re.findall(r'^(assets/[^\(]+)\(', diagnostic, re.M))),
            'note': 'existing ButtonFeedback/type cascade and UINotice diagnostics; no diagnostics in this change'},
        'inspection': 'local source hashes and compiled text only; no tests, simulation, game, browser or online acceptance',
        'manualAcceptance': 'pending user'}
    write('bundle-inspection.json', record)
    if not all(record['compiledTextMarkers'].values()) or not all(retained.values()):
        raise RuntimeError('Local artifact review incomplete; publication stopped')
    print(json.dumps(record, ensure_ascii=False))

def record():
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    log = (out / 'publish.log').read_text(encoding='utf-8-sig')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
    if not urls:
        raise RuntimeError('Successful publication receipt required')
    milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    digest = hashlib.sha256((Path(stage['stage']) / inspection['mainBundle']).read_bytes()).hexdigest()
    if digest != inspection['mainBundleSha256']:
        raise RuntimeError('Published bundle differs from inspected artifact')
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1],
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': receipt,
        'creatorBuildMilliseconds': milliseconds, 'mainBundleSha256': digest,
        'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
            'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False,
            'onlineAcceptance': False, 'manualAcceptance': 'pending user'}})
    note = (f"2026-10-16 关卡宝箱奖励弹窗v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
        '点击任意可领星箱或一键领取，按当前关卡与当前难度持久星级一次领取全部已达成未领档；沿用逐档累计与最高已领记录，金币钻石及状态一次保存，返回实际到账回执。'
        '新获得奖励弹窗用漫画米纸与既有货币插画，合并同币种、单项居中，显示关卡难度与本次箱数；错峰卡片回弹、数字滚动、落位轻弹和局部金色碎光约1秒收净，既有奖励/确认音。'
        '先到账后演出，关闭不再发奖、不等待动画；防重复输入，后台冻结、减少动态静态、关闭销毁清理。局部刷新宝箱与顶部资源，保持章节/关卡/难度/页签/滚动位置，不跨关或跨难度、不进入页面自动发。'
        '无新美术、无奖励数值或存档重置，上一轮章节改动保留，未追加Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅保留原ButtonFeedback、MilestoneSwipe、Panels和UINotice诊断，新改模块无诊断。仅源码及本地构建产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，实际视觉交互由用户人工确认。'
        '详见 [关卡宝箱奖励弹窗](docs/reward-chests-v1/README.md)。')
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
