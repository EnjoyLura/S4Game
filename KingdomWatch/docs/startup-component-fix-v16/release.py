"""Read source, Cocos registration text and publication receipts; never execute game modules."""
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
changed = ['assets/scripts/ui/PositiveFeedback.ts', 'assets/scripts/ui/pages/BasePage.ts']
added = ['assets/scripts/ui/ConstructionPulse.ts']
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
source = lambda n: (root/n).read_text(encoding='utf-8-sig')
before = lambda n: (out/'before'/(Path(n).name+'.txt')).read_text(encoding='utf-8-sig')
def write(name, value):
    (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1] == 'inspect':
    baseline = read(out/'source-baseline.json')
    retained = {f['path']:sha(root/f['path'])==f['sha256'] for f in baseline if f['path'] not in changed}
    actual = {p.relative_to(root).as_posix() for p in (root/'assets/scripts').rglob('*.ts')}
    unexpected = sorted(actual - {f['path'] for f in baseline} - set(added))
    positive, base, construction = source(changed[0]),source(changed[1]),source(added[0])
    boundary = "@ccclass('ConstructionPulse')"
    old_positive = before(changed[0])
    # The entire moved component and its factory are byte-for-byte identical after newline normalization.
    old_moved = old_positive.split(boundary,1)[1]
    new_moved = construction.split(boundary,1)[1]
    old_remaining = old_positive.split(boundary,1)[0].replace('Component, director, Director, game','Component, game').replace('UIOpacity, Vec3','UIOpacity').strip()
    review = {
        'movedComponentAndFactoryUnchanged': old_moved == new_moved,
        'positiveBehaviorUnchanged': old_remaining == positive.strip(),
        'baseOnlyChangesImport': before(changed[1]).replace("from '../PositiveFeedback';","from '../ConstructionPulse';") == base,
        'separateAssetUUIDs': read(root/'assets/scripts/ui/PositiveFeedback.ts.meta')['uuid'] != read(root/'assets/scripts/ui/ConstructionPulse.ts.meta')['uuid'],
        'allProjectComponentScriptsConflictFree': not read(out/'component-audit.json')['conflicts'],
        'priorTwoComponentsIdentified': len(read(out/'component-audit.json')['beforeConflict']['components'])==2,
    }
    diagnostic = (out/'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root/'docs/positive-feedback-v15/type-review.log').read_text(encoding='utf-8-sig')
    primary = lambda text:re.findall(r'^assets/.*error TS.*$',text,re.M)
    types = {'fullProjectPassed':False,'primaryDiagnostics':len(primary(diagnostic)),
        'sameDiagnosticsAsV15':primary(diagnostic)==primary(prior),
        'modifiedFilesHaveDiagnostics':any(n+'(' in diagnostic for n in changed+added)}
    main = max((web/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    frames = []
    # RF boundaries are emitted per script asset; no engine/game code is evaluated here.
    for match in re.finditer(r'\._RF\.push\(',bundle):
        end = bundle.find('._RF.pop()',match.end())
        text = bundle[match.start():end if end>=0 else match.end()+500]
        if 'PositiveFeedback' in text[:250] or 'ConstructionPulse' in text[:250]:
            frames.append({'header':text[:240],'containsPositiveRegistration':bool(re.search(r'ccclass\)?\(.[P]ositiveFeedback',text)),
                'constructionNameInHeader':'ConstructionPulse' in text[:250], 'positiveNameInHeader':'PositiveFeedback' in text[:250]})
    rf_review = {'positiveScriptFramePresent':any(f['positiveNameInHeader'] for f in frames),
        'constructionScriptFramePresent':any(f['constructionNameInHeader'] for f in frames),
        'separateScriptHeaders':not any(f['constructionNameInHeader'] and f['positiveNameInHeader'] for f in frames)}
    for n in changed:
        (out/(Path(n).stem+'-review.diff')).write_text(''.join(difflib.unified_diff(before(n).splitlines(True),source(n).splitlines(True),fromfile='before/'+n,tofile=n)),encoding='utf-8')
    result = {'sourceReview':review,'typeReview':types,'remainingScriptsUnchanged':all(retained.values()),
        'retainedScripts':retained,'unexpectedNewScripts':unexpected,'registrationFrames':frames,'registrationReview':rf_review,
        'mainBundle':main.relative_to(web).as_posix(),'mainSha256':sha(main),'sourceHashes':{n:sha(root/n) for n in changed+added},
        'testsRun':False,'gameRun':False,'browserRun':False,'audioAudition':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(retained.values()) or unexpected or not types['sameDiagnosticsAsV15'] or types['modifiedFilesHaveDiagnostics'] or not all(rf_review.values()):
        raise RuntimeError('Static inspection requires attention')
    print(json.dumps({'sourceReview':review,'typeReview':types,'registrationReview':rf_review,'retainedScripts':len(retained)},ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage, build, inspection = (read(out/n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',(out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle'])!=inspection['mainSha256'] or not all(sha(root/n)==v for n,v in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)',Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'creatorBuildMilliseconds':elapsed,'build':build,
        'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),'gameRun':False,'testsRun':False,'browserRun':False,'onlineAcceptance':False})
    note = (f"2026-10-17 启动组件注册修复v16已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '用户实机报告v15启动Error3615与_sealed空值，定位为PositiveFeedback.ts同时注册两个Component；Cocos每脚本最多一个组件，第二个注册返回null导致后续异常。'
        'ConstructionPulse组件及工厂原样拆至独立脚本和UUID，基地仅更新导入。115份脚本静态AST无同类冲突，生产包两独立RF注册区间，112份其他原脚本散列保持。'
        'v15正向反馈/八条音效和数值/事务/存档/布局保持；此前构建不代表启动实机认可。'
        f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '原九项类型诊断保持，本轮无新增；不运行测试、模拟、游戏、浏览器或试听，实机由用户确认。详见 [启动修复](docs/startup-component-fix-v16/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name; contents=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in contents:
            at=contents.index('\n'); path.write_text(contents[:at+1]+'\n'+note+'\n'+contents[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建 {elapsed}ms；待用户实机确认。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
