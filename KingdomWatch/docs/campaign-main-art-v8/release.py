"""Source and built-file inspection only. Never executes the game, UI or simulation."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import difflib,hashlib,json,re,sys

out=Path(__file__).resolve().parent
root=out.parents[1]
build=root/'build/web-mobile'
changed=['assets/scripts/ui/CampaignChrome.ts','assets/scripts/ui/CampaignCheckpointArt.ts',
         'assets/scripts/ui/CampaignRoute.ts','assets/scripts/ui/pages/LevelsPage.ts',
         'assets/scripts/ui/LevelLootPreview.ts','assets/scripts/ui/SquadPanel.ts']
added=['assets/scripts/ui/SquadChrome.ts']
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
    for name in changed+added:
        old=before(name) if name in changed else ''
        diff.extend(difflib.unified_diff(old.splitlines(True),source(name).splitlines(True),fromfile='before/'+name,tofile=name))
    (out/'source-review.diff').write_text(''.join(diff),encoding='utf-8')
    retained={p['path']:sha(root/p['path'])==p['sha256'] for p in read(out/'source-baseline.json') if p['path'] not in changed}
    old,levels=before(changed[3]),source(changed[3])
    route,oldroute=source(changed[2]),before(changed[2])
    squad,oldsquad=source(changed[5]),before(changed[5])
    chrome=source(changed[0])
    callback=lambda text,start,end:between(text,start,end)
    review={
        'routeCoordinatesUnchanged':between(route,'const ROAD_POINTS','const { ccclass }')==between(oldroute,'const ROAD_POINTS','const { ccclass }'),
        'routeHitAreaUnchanged':"p.x, -p.top, 112, 128" in route and "p.x, -p.top, 112, 128" in oldroute,
        'mapAndChapterLockRenderingUnchanged':old.split('  function renderWorld()',1)[1]==levels.split('  function renderWorld()',1)[1],
        'scrollAndLevelGatesUnchanged':between(old,'  function levelOpen','  function renderHeader')==between(levels,'  function levelOpen','  function renderHeader'),
        'pinInteractionUnchanged':between(old,'  function renderPins','  function renderDock')==between(levels,'  function renderPins','  function renderDock'),
        'drawerCloseAndMapOffsetUnchanged':between(old,'  function closeDrawer','  function renderSheet')==between(levels,'  function closeDrawer','  function renderSheet'),
        'drawerFreezeRetained':between(old,'    mapScroll?.stopAutoScroll();\n    if (mapScroll) st.offsets','    // Every difficulty')==between(levels,'    mapScroll?.stopAutoScroll();\n    if (mapScroll) st.offsets','    // The paper'),
        'claimTransactionUnchanged':between(old,'          if (claiming)','        }, { dragThreshold: 7 });')==between(levels,'          if (claiming)','        }, { dragThreshold: 7 });'),
        'battleEntryUnchanged':between(old,'        if (!open || closing','      paintCampaignAction(battle.node').split('      }, { tone:')[0]==between(levels,'        if (!open || closing','      const battleFace').split('      }, { tone:')[0],
        'deployTransactionUnchanged':between(oldsquad,'        if (dep) { confirmRemove','    });\n    const noteTop')==between(squad,'        if (dep) { confirmRemove','    });\n    const noteTop'),
        'removeConfirmationUnchanged':oldsquad.split('  function confirmRemove',1)[1]==squad.split('  function confirmRemove',1)[1],
        'browserBackAndCloseRetained':between(oldsquad,'  const close =','  mainLabel(dim')==between(squad,'  const close =','  const title ='),
        'centeredPrepareRightSquadSameSize':all(s in levels and s in old for s in ['comicButton(dock, 0, actionY, 354, 82','comicButton(dock, 272, actionY, 136, 82','const dockH = 102']),
        'chapterMaterialsAndActualStarsRetained':all(s in route for s in ['selected && open','s<earned','if (!open) campaignCheckpointLock']) and all(s in source(changed[1]) for s in ['function forest','function lair','function outpost']),
        'equipmentOnlyLocalScroll':levels.count("const equipmentView = N('campaignEquipmentScrollView'")==1 and 'layout.icon*1.5' in levels and 'equipmentScroll.cancelInnerEvents = true' in levels,
        'fullEquipmentPoolAndNormalDescription':"challenge.gearPool.forEach" in levels and '普通难度不掉落装备' in levels and 'campaignEquipmentTwoRows' not in levels,
        'threeDifficultyLayoutHeightShared':'sheetH = Math.min(928' in levels and 'sheetH = Math.min(928' in old,
        'warmWhitePreparation':"g.fillColor = C('#FFF8E7')" in chrome and "C('#FFFCF3')" in chrome,
        'existingActualArtRetained':all(s in levels+chrome for s in ['chapter_banner_v1','chest_bronze_v2','chest_sapphire_v2','chest_crimson_v2','claim_button_v2','difficulty_']),
    }
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/hero-detail-shared-v6/type-review.log').read_text(encoding='utf-8-sig')
    primary=lambda text:re.findall(r'^assets/.*error TS.*$',text,re.M)
    types={'fullProjectPassed':False,'primaryDiagnosticCount':len(primary(diagnostic)),
           'samePriorPrimaryDiagnostics':primary(diagnostic)==primary(prior),
           'changedModulesHaveDiagnostics':any(n+'(' in diagnostic for n in changed+added)}
    markers=['campaignChapterInlay','campaignCheckpointOutpost','campaignCheckpointForest','campaignCheckpointLair',
             'campaignLockSeal','campaignChestReady','selectedCheckpointName','campaignPrepare','campaignMapSquad',
             'campaignChestColumns','campaignEquipmentDivider','campaignEquipmentScrollView','campaignEquipmentScrollContent',
             'campaignStartBattle','squadTitlePlaque','squadFormation','squadHeroRoster','squadRoyalWatermark','squadDone','squadHallPaperVeil']
    result={'mainBundle':main.relative_to(build).as_posix(),'mainSha256':sha(main),
            'sourceHashes':{n:sha(root/n) for n in changed+added},'sourceReview':review,
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
    note=(f"2026-10-17 关卡主页、准备抽屉与出战编队美术v8已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '主页完成深蓝金边章节/箭头、前哨金属盾/深林木路标/兽穴骨牙黑铁、两层石台、真实星锁和奖励标识、居中出战准备及右侧编队按钮。'
        '准备按最新效果稿使用浅白纸框/粗标题/三枚难度旗/三档宝箱/独立一键领取/浅白金币材料卡/金色开始按钮，装备区改为一行半独立滚动，完整池不截断；三难度同高，普通留白写说明。'
        '编队完成深蓝金边标题/返回、站位背板、四站位卡和五英雄卡、实际选中与解锁状态、营房衔接透纸大厅/盾徽水印及完成按钮。'
        '复用原始插画与原生Graphics，无运行图片修改。地图坐标/点击区/滚动与抽屉返回、奖励和上下阵事务、手机返回保持，配置/数值/存档/英雄动作/导航未改。'
        '仅六个原UI模块与新增SquadChrome，其余脚本散列保持，无Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型仍为此前十项主诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [关卡整套美术](docs/campaign-main-art-v8/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;content=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at=content.index('\n');path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
