"""Read source and built artifacts only; never execute game, UI, simulation or tests."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import difflib,hashlib,json,re,sys

out=Path(__file__).resolve().parent
root=out.parents[1]
build=root/'build/web-mobile'
changed=['assets/scripts/ui/CampaignChrome.ts','assets/scripts/ui/CampaignCheckpointArt.ts',
         'assets/scripts/ui/pages/LevelsPage.ts','assets/scripts/ui/LevelLootPreview.ts']
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
between=lambda s,a,b:s.split(a,1)[1].split(b,1)[0]
source=lambda n:(root/n).read_text(encoding='utf-8-sig')
before=lambda n:(out/'before'/(Path(n).name+'.txt')).read_text(encoding='utf-8-sig')

def write(name,data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1]=='inspect':
    main=max((build/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle=main.read_text(encoding='utf-8')
    diff=[]
    for name in changed:
        diff.extend(difflib.unified_diff(before(name).splitlines(True),source(name).splitlines(True),fromfile='before/'+name,tofile=name))
    (out/'source-review.diff').write_text(''.join(diff),encoding='utf-8')
    retained={p['path']:sha(root/p['path'])==p['sha256'] for p in read(out/'source-baseline.json') if p['path'] not in changed}
    old,levels=before(changed[2]),source(changed[2])
    chrome,oldchrome=source(changed[0]),before(changed[0])
    checkpoint,oldcheckpoint=source(changed[1]),before(changed[1])
    loot,oldloot=source(changed[3]),before(changed[3])
    action=between(chrome,'export function paintCampaignMapAction','export function campaignPreparationPanel')
    drawer=between(chrome,'export function campaignPreparationPanel','export function campaignChestBackdrop')
    review={
        'mapPinsDockAndDrawerNavigationUnchanged':between(old,'  function levelOpen','  function renderSheet')==between(levels,'  function levelOpen','  function renderSheet'),
        'worldAndChapterLockUnchanged':old.split('  function renderWorld()',1)[1]==levels.split('  function renderWorld()',1)[1],
        'claimTransactionUnchanged':between(old,'          if (claiming)','        }, { dragThreshold: 7 });')==between(levels,'          if (claiming)','        }, { dragThreshold: 7 });'),
        'battleEntryUnchanged':between(old,'        if (!open || closing','      const battleFace')==between(levels,'        if (!open || closing','      const battleFace'),
        'equipmentScrollAndCompletePoolUnchanged':between(old,'      const equipmentH','      if (challenge.gearPool.length)')==between(levels,'      const equipmentH','      if (challenge.gearPool.length)'),
        'pedestalAndStateOrnamentsUnchanged':between(oldcheckpoint,'function pedestal','function outpost')==between(checkpoint,'function pedestal','function outpost') and oldcheckpoint.split('export function paintCampaignCheckpoint',1)[1]==checkpoint.split('export function paintCampaignCheckpoint',1)[1],
        'difficultyAndChestArtUnchanged':oldchrome.split('export function campaignPreparationArt',1)[1]==chrome.split('export function campaignPreparationArt',1)[1],
        'lootDetailsUnchanged':oldloot.split('export function stageDropIcon',1)[1]==loot.split('export function stageDropIcon',1)[1],
        'buttonsUseContinuousFace':'smoothCutFace(g,w-11,h-11' in action and 'face(g, [[' not in action,
        'neutralSingleDrawerEdge':"C('#EAE5D8')" in drawer and drawer.count('g.roundRect(')==1 and '#F0D9AC' not in drawer,
        'spacedDarkerEquipmentHeading':'spacingX = 1.4' in levels and 'equipment: 408' in levels and 'equipment: 498' in levels and 'CAMPAIGN_TEXT.body' in levels,
    }
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/campaign-main-art-v8/type-review.log').read_text(encoding='utf-8-sig')
    primary=lambda text:re.findall(r'^assets/.*error TS.*$',text,re.M)
    types={'fullProjectPassed':False,'primaryDiagnosticCount':len(primary(diagnostic)),
           'samePriorPrimaryDiagnostics':primary(diagnostic)==primary(prior),
           'changedModulesHaveDiagnostics':any(n+'(' in diagnostic for n in changed)}
    markers=['campaignCheckpointOutpost','campaignCheckpointForest','campaignCheckpointLair','campaignPreparationDrawer',
             'campaignPrepare','campaignMapSquad','campaignEquipmentDivider','campaignEquipmentScrollView','campaignStartBattle',
             '#EAE5D8','#FFDB6A','#F4BC3C','#2D302F']
    result={'mainBundle':main.relative_to(build).as_posix(),'mainSha256':sha(main),
            'sourceHashes':{n:sha(root/n) for n in changed},'sourceReview':review,
            'remainingScriptsUnchanged':all(retained.values()),'retainedScripts':retained,
            'compiledMarkers':{m:m in bundle for m in markers},'typeReview':types,
            'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(retained.values()) or not all(result['compiledMarkers'].values()) \
        or not types['samePriorPrimaryDiagnostics'] or types['changedModulesHaveDiagnostics']:
        raise RuntimeError('Source/artifact inspection needs attention; see saved record')
    print(json.dumps({k:v for k,v in result.items() if k not in ['retainedScripts','sourceHashes']},ensure_ascii=False))
elif sys.argv[1]=='record':
    stage,receipt,inspection=(read(out/n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls=re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',(out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle'])!=inspection['mainSha256'] \
        or not all(sha(root/n)==v for n,v in inspection['sourceHashes'].items()):raise RuntimeError('Publication receipt/hash mismatch')
    elapsed=int(re.findall(r'build-project-total \((\d+)ms\)',Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'build':receipt,'creatorBuildMilliseconds':elapsed,
        'mainSha256':inspection['mainSha256'],'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False})
    note=(f"2026-10-17 关卡边光与准备抽屉细化v9已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '关卡牌高光收细降亮，前哨顶沿改局部短高光、漆面连续渐变；出战准备/开始战斗/编队取消宽大水平条带，共用连续渐变面与窄斜面。'
        '抽屉正文/详情/概率改灰黑，标题深蓝黑，概率掉落装备增加字距和上下留白、重排细线菱形；背板移除双黄边，使用低对比单中性细边。'
        '仅CampaignChrome/CampaignCheckpointArt/LevelsPage/LevelLootPreview四UI模块，其余脚本散列保持，无新图片或Git提交。'
        '地图/状态/奖励/返回与点击事务、一行半装备独立滚动和三难度同高保持。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型仍为此前十项主诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [关卡细化](docs/campaign-soft-finish-v9/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;content=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at=content.index('\n');path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
