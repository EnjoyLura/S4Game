"""Inspect local source/build files and publication receipts; never run the game."""
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
changed = ['assets/scripts/ui/TrainingLobby.ts', 'assets/scripts/ui/pages/HeroPage.ts',
           'assets/scripts/ui/pages/UpgradePage.ts']
added = ['assets/scripts/ui/TrainingChrome.ts']
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
source = lambda n: (root/n).read_text(encoding='utf-8-sig')
before = lambda n: (out/'before'/(Path(n).name+'.txt')).read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
between = lambda s,a,b: s.split(a,1)[1].split(b,1)[0]

def write(name, value):
    (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1] == 'inspect':
    baseline = read(out/'source-baseline.json')
    retained = {f['path']:sha(root/f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    current_paths = {p.relative_to(root).as_posix() for p in (root/'assets/scripts').rglob('*.ts')}
    unexpected = sorted(current_paths - {f['path'] for f in baseline} - set(added))
    training, hero, upgrade = map(source,changed)
    old_training, old_hero, old_upgrade = map(before,changed)
    review = {
        'existingSceneAndFootAnchorsRetained': between(training,'function environment','function roster') == between(old_training,'function environment','function roster'),
        'longPressGrowthAndResourceTransactionsRetained': between(training,'        const target: GrowthTarget','        fx.setHammer') == between(old_training,'        const target: GrowthTarget','        fx.setHammer'),
        'forgeTransactionRetained': between(hero,'      const result = growthAction(weapon','    }, { tone:') == between(old_hero,'      const result = growthAction(weapon','    }, { tone:'),
        'heroPageOutsideForgeRetained': between(hero,'const SLOTS:','/** The same forge data') == between(old_hero,'const SLOTS:','/** The same forge data') and hero.split('function drawBagCell',1)[1] == old_hero.split('function drawBagCell',1)[1],
        'attributeDialogReusesExistingCommonLayout': between(hero,'export function attrsModal','export function storyModal') == between(old_hero,'export function attrsModal','export function storyModal'),
        'skillAndBreakthroughTablesRetained': between(upgrade,'const SKILL_MS_ARCHER','/** 升级预览') == between(old_upgrade,'const SKILL_MS_ARCHER','/** 升级预览'),
        'skillDamageFormulaRetained': between(training,"        if (selected === 'skill')",'        const paperH = height - shelfH') == between(old_training,"        if (selected === 'skill')",'        const paperH = height - shelfH'),
        'scrollOffsetsRetained': between(training,"      const key = hid + ':'",'      if (st.tab < 2)') == between(old_training,"      const key = hid + ':'",'      if (st.tab < 2)'),
        'legacyForgeUsesCommonDialog': 'forgeModal({ ...ctx, refresh: rebuild }, hid, kind)' in upgrade,
        'noRarityCornerLabels': 'gearQualityTag' not in training,
    }
    for name in changed:
        diff = ''.join(difflib.unified_diff(before(name).splitlines(True),source(name).splitlines(True),fromfile='before/'+name,tofile=name))
        (out/(Path(name).stem+'-review.diff')).write_text(diff,encoding='utf-8')
    diagnostic = (out/'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root/'docs/locked-stage-confirm-v11/type-review.log').read_text(encoding='utf-8-sig')
    primary = lambda s: re.findall(r'^assets/.*error TS.*$',s,re.M)
    types = {'fullProjectPassed':False, 'primaryDiagnosticCount':len(primary(diagnostic)),
             'samePrimaryDiagnosticsAsV11':primary(diagnostic)==primary(prior),
             'modifiedFilesHaveDiagnostics':any(n+'(' in diagnostic for n in changed+added)}
    main = max((web/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    markers = ['trainingPanelTitle', 'trainingPortraitAttributeWhite', 'trainingWideAttributeWhite',
               'trainingMilestoneDialog', 'heroForgeMaterialsWhite', 'trainingComparisonWhite',
               'heroAttrsDialog', 'shopProductTitleBar']
    result = {'mainBundle':main.relative_to(web).as_posix(), 'mainSha256':sha(main),
              'sourceHashes':{n:sha(root/n) for n in changed+added}, 'sourceReview':review,
              'remainingScriptsUnchanged':all(retained.values()), 'retainedScripts':retained,
              'unexpectedNewScripts':unexpected, 'compiledMarkers':{m:m in bundle for m in markers},
              'typeReview':types, 'testsRun':False, 'simulationRun':False, 'gameRun':False,
              'browserRun':False, 'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(retained.values()) or unexpected or not all(result['compiledMarkers'].values()) or not types['samePrimaryDiagnosticsAsV11'] or types['modifiedFilesHaveDiagnostics']:
        raise RuntimeError('Local source/build inspection requires attention')
    print(json.dumps({k:v for k,v in result.items() if k not in ['sourceHashes','retainedScripts']},ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage, build, inspection = (read(out/n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',(out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle']) != inspection['mainSha256'] or not all(sha(root/n)==v for n,v in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)',Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'build':build,
        'creatorBuildMilliseconds':elapsed,'mainSha256':inspection['mainSha256'],
        'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun':False,'simulationRun':False,'gameRun':False,'browserRun':False,'onlineAcceptance':False})
    note = (f"2026-10-17 升级页整套美术v12已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '等级/武器/技能/装备四页按效果稿统一紧凑五圆头像、连体分类、浅纸深蓝标题、整组近白属性和对比列；'
        '突破卡为切角细框、下一阶段浅金和真实锁标，技能三选择卡、装备四选择卡完整品质方板，无品质角标。'
        '突破详情复用DetailDialog；属性总览沿用已有通用布局；武器培养/装备强化增加白色属性对比与材料分组、充足常规字色/不足红色及绿色原单层强化。'
        '旧equipModal入口转用同一forgeModal；动作底部至少约30留白。原立绘/石台脚底、长按升级、滑动偏移、成长/消耗/存档与局内解锁规则保持。'
        '仅TrainingLobby/HeroPage/UpgradePage三原脚本及新增TrainingChrome，其余原脚本散列保持，无新运行图片或Git提交。'
        f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型为原九项诊断，修改模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [升级页整套美术](docs/upgrade-art-live-v12/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name
        text=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at=text.index('\n')
            path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
