"""Read local source, compiled files and a publish receipt. Never execute the game."""
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
changed = ['assets/scripts/ui/CampaignRoute.ts', 'assets/scripts/ui/UINotice.ts',
           'assets/scripts/ui/pages/BasePage.ts']
added = ['assets/scripts/ui/BaseChrome.ts']
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
source = lambda n: (root/n).read_text(encoding='utf-8-sig')
before = lambda n: (out/'before'/(Path(n).name+'.txt')).read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
between = lambda s,a,b: s.split(a,1)[1].split(b,1)[0]
compact = lambda s: re.sub(r'\s+', '', s)

def write(name, value):
    (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1] == 'inspect':
    baseline = read(out/'source-baseline.json')
    retained = {f['path']:sha(root/f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    current_paths = {p.relative_to(root).as_posix() for p in (root/'assets/scripts').rglob('*.ts')}
    unexpected = sorted(current_paths - {f['path'] for f in baseline} - set(added))
    route, notice, base = map(source,changed)
    old_route, old_notice, old_base = map(before,changed)
    review = {
        'onlyStageNameplateOffsetChanged': route == old_route.replace('campaignChapterPlate(item, 0, -86, 152, 32)', 'campaignChapterPlate(item, 0, -76, 152, 32)'),
        'continuousSceneAndBuildingAnchorsRetained': between(base,'  // Foundation centers','  let artY') == between(old_base,'  // Foundation centers','  let artY'),
        'sceneArtworkAndScrollTransformsRetained': between(base,'  let artY','  basePlaque(root') == between(old_base,'  let artY','  const title ='),
        'oneDimSessionAndRefreshHandoffRetained': between(base,'class BaseModalSession','export function buildBase').replace('      detailSkin(panel, w, h, title);\n','') == between(old_base,'class BaseModalSession','export function buildBase'),
        'keepUpgradeTransactionRetained': between(base,'      if (maxed) return;','    },') == between(old_base,'      if (maxed) return;','    },'),
        'codexRewardTransactionRetained': between(base,'      if (claimed) return;','    },') == between(old_base,'      if (claimed) return;','    },'),
        'monsterArtAndSilhouetteRetained': between(base,'function monsterArt','function codexModal') == between(old_base,'function monsterArt','function codexModal'),
        'keepAndCodexCommonDialogSkin': 'detailSkin(panel, w, h, title)' in base and base.count('detailOverview(')==2 and base.count('detailActionY(p)')==2,
        'codexDiscoveredGateRetained': compact("if (!got) { toast('战斗中遇见该怪物后解锁'); return; }") in compact(base),
        'codexBackToListRetained': compact('() => codexModal(ctx, session, -1), 1)') in compact(base),
        'noticePublicOptionsRetained': between(notice,'export type NoticeKind','function numberText').strip() == between(old_notice,'export type NoticeKind','const ACCENT').strip(),
        'toastOnlyTranslucentBackdropAndText': "CA('#101B24',.78)" in notice and 'gameToastText' in notice and not any(s in notice for s in ['comicPlate','heroPortrait','artSprite','noticeAccent','noticeLifetime','noticeGlints']),
        'toastBottomSlideAndFade': '-LO.half+LO.safeBottom+152+this.height/2' in notice and '-(LO.safeBottom+this.height+176)' in notice and 'this.duration+.32' in notice,
        'toastGrowthBaselineStillCoalesces': 'before: previous.level.before, after: requested.level.after' in notice and 'previous.stats?.find(p => p.name === s.name)?.before' in notice,
        'gameDataAndSaveRemainUnchanged': all(retained[p] for p in ['assets/scripts/core/GameData.ts','assets/scripts/core/SaveData.ts','assets/scripts/ui/ComicUI.ts','assets/scripts/ui/LobbyChrome.ts','assets/scripts/ui/DetailDialog.ts']),
    }
    for name in changed:
        diff = ''.join(difflib.unified_diff(before(name).splitlines(True),source(name).splitlines(True),fromfile='before/'+name,tofile=name))
        (out/(Path(name).stem+'-review.diff')).write_text(diff,encoding='utf-8')
    diagnostic = (out/'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root/'docs/upgrade-art-live-v12/type-review.log').read_text(encoding='utf-8-sig')
    primary = lambda s: re.findall(r'^assets/.*error TS.*$',s,re.M)
    types = {'fullProjectPassed':False, 'primaryDiagnosticCount':len(primary(diagnostic)),
             'samePrimaryDiagnosticsAsV12':primary(diagnostic)==primary(prior),
             'modifiedFilesHaveDiagnostics':any(n+'(' in diagnostic for n in changed+added)}
    main = max((web/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    markers = ['gameToastText','baseCampTitlePlate','baseKeepComparisonWhite','baseKeepCostWhite',
               'baseCodexTextWhite','baseDiscoveryProgress','baseCodexDialog','baseMonsterShowcase',
               'shopProductTitleBar','selectedCheckpointName']
    result = {'mainBundle':main.relative_to(web).as_posix(), 'mainSha256':sha(main),
              'sourceHashes':{n:sha(root/n) for n in changed+added}, 'sourceReview':review,
              'remainingScriptsUnchanged':all(retained.values()), 'retainedScripts':retained,
              'unexpectedNewScripts':unexpected, 'compiledMarkers':{m:m in bundle for m in markers},
              'typeReview':types, 'testsRun':False, 'simulationRun':False, 'gameRun':False,
              'browserRun':False, 'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(retained.values()) or unexpected or not all(result['compiledMarkers'].values()) or not types['samePrimaryDiagnosticsAsV12'] or types['modifiedFilesHaveDiagnostics']:
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
    note = (f"2026-10-17 基地整套美术与提示v13已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '关卡名牌上移10单位；Toast改78%深色半透明底+文字，底部280ms滑入、停留约1.8–2.3秒、320ms淡出，去图标/边条/进度/光屑，真实成长文本与连升合并保留。'
        '基地主页完成营地/建筑细金名牌、浅纸建设栏、浅白属性和分割；主城建设/图鉴列表/普通与BOSS详情复用商品详情通用纸面和深蓝标题，白色分组、真实属性对比/消耗及图鉴进度/剪影/锁/红点/勾标，底部原单层按钮留30。'
        '连续庭院与建筑锚点、滚动偏移、单遮罩返回、upKeep/图鉴发现/一次性20钻石奖励、数值/存档、资源栏/原导航保持。'
        '仅CampaignRoute/UINotice/BasePage三原脚本与新增BaseChrome，其余原脚本散列保持，无新运行图片或Git提交。'
        f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型仍为原九项诊断，本轮模块无诊断；不运行测试、模拟、游戏、浏览器、试听或线上验收，用户人工确认。'
        '详见 [基地整套美术与提示](docs/base-art-live-v13/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name
        contents=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in contents:
            at=contents.index('\n')
            path.write_text(contents[:at+1]+'\n'+note+'\n'+contents[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
