"""Offline source/build review and publication receipts; never imports or runs game code."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
root = out.parents[1]
web = root / 'build/web-mobile'
names = ['ConstructionPulse', 'FeedbackSurface', 'PositiveFeedback', 'TrainingGrowthFx', 'TrainingLobby']
changed = ['assets/scripts/ui/' + n + '.ts' for n in names]
added = ['assets/scripts/ui/TrainingResultPulse.ts', 'assets/scripts/ui/TrainingResultPulse.ts.meta']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def module_excerpt(bundle, name):
    at = bundle.index('chunks:///_virtual/' + name + '.ts')
    end = bundle.find('System.register(', at + 1)
    return bundle[at:end if end >= 0 else len(bundle)]

if sys.argv[1] == 'inspect':
    baseline = read(out / 'source-baseline.json')
    retained = {f['path']: sha(root / f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    actual = {p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.ts')}
    unexpected = sorted(actual - {f['path'] for f in baseline} - set(added))
    main = max((web / 'assets/main').glob('index*.js'), key=lambda p: p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    compiled = {}
    for name in names + ['TrainingResultPulse']:
        compiled[name] = module_excerpt(bundle, name)
        (out / (name + '-compiled.txt')).write_text(compiled[name], encoding='utf-8')
    for name, path in zip(names, changed):
        before = (out / 'before' / (name + '.ts.txt')).read_text(encoding='utf-8-sig')
        source = (root / path).read_text(encoding='utf-8-sig')
        (out / (name + '-review.diff')).write_text(''.join(difflib.unified_diff(
            before.splitlines(True), source.splitlines(True), fromfile='before/' + path, tofile=path)), encoding='utf-8')
    source = lambda n: (root / ('assets/scripts/ui/' + n + '.ts')).read_text(encoding='utf-8-sig')
    positive, training, local, comparison = (source(n) for n in ['PositiveFeedback', 'TrainingLobby', 'TrainingGrowthFx', 'TrainingResultPulse'])
    diagnostic = lambda p: re.findall(r'^assets/.*error TS.*$', p.read_text(encoding='utf-8-sig'), re.M)
    types = diagnostic(out / 'type-review.log')
    previous = diagnostic(root / 'docs/toast-middle-rise-v18/type-review.log')
    new_uuid = read(root / added[1])['uuid']
    same_uuid = [p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.meta') if read(p).get('uuid') == new_uuid]
    checks = {
        'actualStatBeforeAfterDeltaColumns': 'value(stat.before, stat)' in positive and 'stat.after - stat.before' in positive and 'value(row.value, stat)' in positive,
        'mainUsesChangedPowerOrRealStat': 'r.power.after !== r.power.before' in positive and 'r.stats[0]' in positive,
        'continuousGrowthKeepsDisplayedValues': 'shown.set(row.key, row.value)' in positive and 'this.countingFast = merged' in positive,
        'firstBaseAndMilestoneRetained': 'previous!.level.before' in positive and 'next.milestone || previous!.milestone' in positive,
        'denseCenterKeepsFeatheredDoubleRules': 'growthSurface(display' in positive and "'#101F2B', .985" in source('FeedbackSurface') and "type Surface = 'feather' | 'growth'" in source('FeedbackSurface'),
        'centerToUpperLaneRetained': 'LO.half * .36' in positive and 'out(this.appearanceAge / .36)' in positive,
        'earnedComparisonUsesActualSnapshots': 'const beforeStats = data.statsAt(hid,h.lv,h.weaponLv)' in training and 'rows: comparison(beforeStats,current)' in training,
        'resultRestoresNextPreview': "this.stamp.string = '本次提升'" in comparison and 'restore?.()' in comparison,
        'noDuplicateFloatingPower': 'this.gainText' not in local and 'trainingUpgradeBurst' in local,
        'heroIllustrationNotScaledForImpact': 'this.figure.setScale(this.figureScale.x' not in local,
        'numberLandingCueRetained': "uiSound('starFinish')" in positive,
        'reducedMotionAndHideLifecycle': all('reducedMotion()' in s for s in [positive, local, comparison]) and 'Game.EVENT_HIDE' in comparison,
        'noInputBlockingAdded': 'BlockInputEvents' not in positive + comparison,
        'componentAuditClear': not read(out / 'component-audit.json')['conflicts'],
        'uuidUnique': same_uuid == [added[1]],
        'typeDiagnosticsUnchanged': types == previous,
        'changedFilesHaveNoDiagnostics': not any(any(n + '.ts(' in d for n in names + ['TrainingResultPulse']) for d in types),
        'compiledNewComponentPresent': 'TrainingResultPulse' in compiled['TrainingResultPulse'] and 'TrainingResultPulse' in compiled['TrainingLobby'],
        'compiledCrashedConcatSetNotReintroduced': '[].concat(new Set' not in compiled['PositiveFeedback'],
    }
    write('bundle-inspection.json', {'checks': checks, 'sourceHashes': {p: sha(root / p) for p in changed + added},
          'retainedScripts': retained, 'remainingScriptsUnchanged': all(retained.values()), 'unexpectedScripts': unexpected,
          'mainBundle': main.relative_to(web).as_posix(), 'mainSha256': sha(main), 'typeDiagnosticCount': len(types),
          'newComponentUuidFiles': same_uuid, 'gameRun': False, 'testsRun': False, 'browserRun': False,
          'audioAudition': False, 'onlineAcceptance': False})
    print(json.dumps({'checks': checks, 'retained': len(retained), 'typeDiagnostics': len(types)}, ensure_ascii=False))
    if not all(checks.values()) or not all(retained.values()) or unexpected:
        raise RuntimeError('Static inspection requires attention')
elif sys.argv[1] == 'record':
    stage, build, review = (read(out / name) for name in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / review['mainBundle']) != review['mainSha256']:
        raise RuntimeError('Publication receipt or bundle mismatch')
    if not all(sha(root / p) == h for p, h in review['sourceHashes'].items()):
        raise RuntimeError('Source changed after inspected build')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
          'creatorBuildMilliseconds': elapsed, 'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
          'gameRun': False, 'testsRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False})
    note = (f"2026-10-17 升级可读性与正反馈v19已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '成长提示改中央98.5%深色底/两端渐隐与双线，标题/对象与等级/主要数值/逐项属性分层；48号新值、39号增量，显示真实原值→新值与完整增量，主城主行改耐久、护盾突破单列。'
        '中部显现后停到原中上位置，数字错峰滚动、落点轻弹与原采样确认音，长按保留初始值、连续追赶目标且不重播入场，松手后落定；阶段突破保留。'
        '英雄/武器原属性面板临时展示本次实际前后值并高亮2.6秒，再恢复下一次预览；去腿部重复战力飘字，角色脚底/身体不缩放，局部暖光与战力牌轻弹，主城局部光/微光点增强。'
        '五原UI脚本和新增独立TrainingResultPulse组件，其他111原脚本散列保持，117脚本无多组件注册；GrowthFeedback捕获/升级事务/消耗/存档/普通Toast/已有音频文件保持。'
        f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR及Wrangler main完成；原九项类型诊断保持，无新增。'
        '参考录屏仅离线抽帧看节奏；未运行测试、模拟、游戏、浏览器、试听或线上验收，实际观感待用户确认。详见[升级反馈](docs/growth-feedback-v19/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = root / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建{elapsed}ms；实机观感待人工确认。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
