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
sources = ['assets/scripts/ui/ComicUI.ts', 'assets/scripts/ui/TrainingLobby.ts',
    'assets/scripts/ui/pages/LevelsPage.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare():
    prior = game / 'docs/reward-chests-v1'
    publisher = (prior / 'publish.ps1').read_text(encoding='utf-8-sig')
    publisher = publisher.replace('docs/campaign-chapters-v1/deployment-stage.json', 'docs/reward-chests-v1/deployment-stage.json')
    publisher = publisher.replace('reward-chests-v1-', 'lobby-ui-quiet-v1-')
    publisher = publisher.replace('claim all currently earned chests for the selected level and difficulty; credited reward receipt popup with finite card, count and local sparkle animation',
        'quiet upgrade lobby and level reward shelf; circular hero and skill selections, tonal milestone cards and borderless reward statuses')
    (out / 'publish.ps1').write_text(publisher, encoding='utf-8')
    write('source-hashes.json', {rel: digest(game / rel) for rel in sources})
    guard = read(game / 'docs/campaign-chapters-v1/source-hashes.json')
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
    markers = ['comicSurface', 'trainingHeroSelection', 'trainingHeroNameTag', 'trainingSkillSelection',
        'trainingSkillNameTag', 'milestoneNext', 'rewardTabs', 'rewardClaimHint',
        'rewardPopupPanel', 'rewardPopupConfirm', 'chapterStageRoute', '巢穴核心']
    retired = ['trainingDivider', 'rewardDivider']
    retained = {rel: digest(game / rel) == value for rel, value in read(out / 'retained-source-hashes.json').items()}
    current = {rel: digest(game / rel) == value for rel, value in read(out / 'source-hashes.json').items()}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior_diagnostics = (game / 'docs/reward-chests-v1/type-review.log').read_text(encoding='utf-8-sig')
    record = {'mainBundle': main.relative_to(build).as_posix(), 'mainBundleBytes': main.stat().st_size,
        'mainBundleSha256': digest(main), 'compiledTextMarkers': {m: m in code for m in markers},
        'retiredDecorationAbsent': {m: m not in code for m in retired},
        'retainedChapterAndRewardSources': retained, 'currentSourceHashesMatch': current,
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
    note = (f"2026-10-16 升级与奖励区视觉收敛v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
        '按用户认可方向图减少框线：升级页圆头像配金环及名字签、单条深色分类、136大技能图配局部选中态，属性/突破/装备区去外框与分隔线；'
        '场景上属性保留无描边纸面，阶段卡改柔金/淡底。关卡奖励全宽米纸，页签弱化，未达成/已领取用文字，可领取有小金签，宝箱整区一键领与实际到账弹窗保持。'
        'ComicUI静面与quiet按钮均显式使用，其他默认组件保持；升级主按钮单轮廓、长按连升及战力动效、英雄栏与突破滑动/位置记忆、短屏内容滚动与固定操作保留。'
        '无新运行素材、无数值/存档变更，章节与奖励事务源文件散列保持，未追加Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅只有既有ButtonFeedback等诊断，改动模块无诊断；仅源码与本地产物审阅，不运行测试、模拟、游戏、浏览器或线上验收，实际视觉交互由用户人工确认。'
        '详见 [升级与奖励区视觉收敛](docs/lobby-ui-quiet-v1/README.md)。')
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
