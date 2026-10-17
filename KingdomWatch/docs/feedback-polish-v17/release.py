"""Static source/bundle inspection and deployment receipts. Never imports game code."""
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
names = ['RewardPopup', 'RewardCollectFx', 'PositiveFeedback', 'UINotice',
         'CelebrationInk', 'TrainingGrowthFx', 'ConstructionPulse', 'SettlementMotion']
changed = ['assets/scripts/ui/' + n + '.ts' for n in names]
added = ['assets/scripts/ui/FeedbackSurface.ts']
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = lambda n: (root / n).read_text(encoding='utf-8-sig')

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def module_excerpt(bundle, name):
    marker = 'chunks:///_virtual/' + name + '.ts'
    at = bundle.index(marker)
    end = bundle.find('System.register(', at + len(marker))
    return bundle[at:end if end >= 0 else len(bundle)]

if sys.argv[1] == 'inspect':
    baseline = read(out / 'source-baseline.json')
    retained = {f['path']: sha(root / f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    actual = {p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.ts')}
    unexpected = sorted(actual - {f['path'] for f in baseline} - set(added))
    prior = read(root / 'docs/startup-component-fix-v16/deployment-stage.json')
    prior_main = max((Path(prior['stage']) / 'assets/main').glob('index*.js'), key=lambda p: p.stat().st_mtime)
    main = max((web / 'assets/main').glob('index*.js'), key=lambda p: p.stat().st_mtime)
    old_code = module_excerpt(prior_main.read_text(encoding='utf-8'), 'RewardCollectFx')
    new_code = module_excerpt(main.read_text(encoding='utf-8'), 'RewardCollectFx')
    (out / 'before/RewardCollectFx-compiled.txt').write_text(old_code, encoding='utf-8')
    (out / 'RewardCollectFx-compiled.txt').write_text(new_code, encoding='utf-8')
    positive = source(changed[2])
    notice = source(changed[3])
    popup = source(changed[0])
    helper = source(added[0])
    checks = {
        'priorCrashContainsConcatSet': bool(re.search(r'\[\]\.concat\(new Set', old_code)),
        'compiledArrayFromSetFix': bool(re.search(r'Array\.from\(new Set', new_code)),
        'compiledConcatSetAbsent': not re.search(r'\[\]\.concat\(new Set', new_code),
        'compiledIconTypeGuard': '"string"' in new_code and 'typeof' in new_code,
        'closeCallbackBeforeDecoration': popup.index('try { onClose?.(); }') < popup.index('collectRewardFx(GLOBAL_ROOT, rewards)'),
        'closeAndAcknowledgeAreIdempotent': 'if (closing) return;' in popup and 'if (acknowledged) return;' in popup,
        'optionalEffectSetupIsContained': "console.warn('[RewardCollectFx] decoration skipped'" in source(changed[1]),
        'sharedContinuousNoticeSurface': 'noticeSurface(this.display' in positive and 'noticeSurface(parent' in notice,
        'noStripGraphicsInGrowthOrNotice': not any('g.rect(' in s for s in [positive, notice]),
        'texturesHaveLinearFiltering': 'texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR)' in helper,
        'cachedTexturesNotRebuiltPerFrame': 'frames.get(kind)' in helper and 'frames.set(kind, result)' in helper,
        'noPolygonSunburst': not any('celebrationRays' in source(n) for n in changed),
        'rewardQuantityRemainsActual': 'Math.round(row.amount * progress)' not in popup,
        'rewardSoundRetained': 'uiSound(this.sound)' in popup,
        'reducedMotionRetained': all('reducedMotion' in source(n) for n in changed if 'CelebrationInk' not in n),
        'componentAuditClear': not read(out / 'component-audit.json')['conflicts'],
    }
    diagnostic = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    previous = (root / 'docs/startup-component-fix-v16/type-review.log').read_text(encoding='utf-8-sig')
    primary = lambda text: re.findall(r'^assets/.*error TS.*$', text, re.M)
    types = {'fullProjectPassed': False, 'primaryDiagnostics': len(primary(diagnostic)),
             'sameAsV16': primary(diagnostic) == primary(previous),
             'modifiedFilesHaveDiagnostics': any(n + '(' in diagnostic for n in changed + added)}
    registration = []
    bundle = main.read_text(encoding='utf-8')
    for match in re.finditer(r'\._RF\.push\(', bundle):
        end = bundle.find('._RF.pop()', match.end())
        part = bundle[match.start():end if end >= 0 else match.end() + 500]
        if any('"' + name + '"' in part[:220] for name in names + ['FeedbackSurface']):
            registration.append(part[:220])
    for name, path in zip(names, changed):
        before = (out / 'before' / (name + '.ts.txt')).read_text(encoding='utf-8-sig')
        (out / (name + '-review.diff')).write_text(''.join(difflib.unified_diff(
            before.splitlines(True), source(path).splitlines(True), fromfile='before/' + path, tofile=path)), encoding='utf-8')
    result = {'sourceAndBundleReview': checks, 'typeReview': types, 'retainedScripts': retained,
              'remainingScriptsUnchanged': all(retained.values()), 'unexpectedNewScripts': unexpected,
              'mainBundle': main.relative_to(web).as_posix(), 'mainSha256': sha(main),
              'sourceHashes': {n: sha(root / n) for n in changed + added}, 'registrationHeaders': registration,
              'gameRun': False, 'testsRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    print(json.dumps({'checks': checks, 'types': types, 'retained': len(retained)}, ensure_ascii=False))
    if not all(checks.values()) or not all(retained.values()) or unexpected or not types['sameAsV16'] or types['modifiedFilesHaveDiagnostics']:
        raise RuntimeError('Static inspection requires attention')
elif sys.argv[1] == 'record':
    stage, build, inspection = (read(out / n) for n in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] or not all(sha(root / n) == v for n, v in inspection['sourceHashes'].items()):
        raise RuntimeError('Deployment receipt or source hash mismatch')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'creatorBuildMilliseconds': elapsed,
                          'build': build, 'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
                          'gameRun': False, 'testsRun': False, 'browserRun': False, 'onlineAcceptance': False})
    note = (f"2026-10-17 反馈修整与领奖关闭修复v17已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
            '用户否定v15硬边放射光与条纹；两段外部录屏仅离线参考节奏，不复制美术。'
            '定位收下奖励卡死为Creator把Set展开编为[].concat(Set)，icon.includes接到Set；改Array.from并在本地生产包确认，关闭幂等、先释放领取锁，装饰异常清理。'
            '普通/成长通知改缓存连续alpha纹理与渐隐双线，成长三行142高；领奖用金色字标题/细线、柔光、错峰轻显与真实数量，保留音效。'
            '培养/主城/胜利同步移除多边形光束与条带，改局部柔光和少量闪点。'
            '八原UI模块和新增纯工具FeedbackSurface，其余107脚本散列保持，数值/交易/存档/已有音频保持，116脚本无多组件注册。'
            f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR及Wrangler main完成；原九项类型诊断保持，无新增。'
            '未运行测试、模拟、游戏、浏览器、试听或线上验收，关闭操作与观感待用户实机确认。详见 [反馈修整](docs/feedback-polish-v17/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = root / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建 {elapsed}ms；关闭交互与观感待用户实机确认。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
