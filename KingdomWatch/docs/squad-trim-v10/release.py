"""Inspect source and build files only, without executing the game or UI."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import difflib,hashlib,json,re,sys

out=Path(__file__).resolve().parent
root=out.parents[1]
build=root/'build/web-mobile'
changed=['assets/scripts/ui/SquadChrome.ts','assets/scripts/ui/SquadPanel.ts',
         'assets/scripts/ui/CampaignCheckpointArt.ts','assets/scripts/ui/CampaignRoute.ts',
         'assets/scripts/ui/HeroRosterRail.ts','assets/scripts/ui/pages/HeroPage.ts',
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
    chrome,squad,checkpoint,route,rail,hero,levels,loot=map(source,changed)
    oldchrome,oldsquad,oldcheckpoint,oldroute,oldrail,oldhero,oldlevels,oldloot=map(before,changed)
    sheet=between(levels,'      const sv = loadSave(), lv = LEVELS[st.i]','  function renderWorld')
    oldsheet=between(oldlevels,'      const sv = loadSave(), lv = LEVELS[st.i]','  function renderWorld')
    review={
        'squadCloseAndBrowserBackUnchanged':squad.split('  function rebuild()',1)[0]==oldsquad.split('  function rebuild()',1)[0],
        'deployAndRemoveUnchanged':between(squad,'        if (dep) { confirmRemove','    const noteTop')==between(oldsquad,'        if (dep) { confirmRemove','    const noteTop') and squad.split('  function confirmRemove',1)[1]==oldsquad.split('  function confirmRemove',1)[1],
        'frameAndHallUnchanged':between(chrome,'export function paintSquadFrame','export function paintSquadCard')==between(oldchrome,'export function paintSquadFrame','export function paintSquadCard') and chrome.split('export function squadHallBackground',1)[1]==oldchrome.split('export function squadHallBackground',1)[1],
        'deployedGoldRimAndOpenDiamonds':'gold ? 5.4' in chrome and "kind: 'position' | 'hero'" in chrome and 'g.lineTo(center-radius,0); g.close(); g.stroke();' in chrome,
        'routeCoordinatesMotionHitAreaUnchanged':route.split('export function routeStop',1)[0]==oldroute.split('export function routeStop',1)[0] and 'p.x, -p.top, 112, 128' in route,
        'openZeroStarHasThreeGrayStars':'if (open) {\n    for (let s = 0; s < 3; s++)' in route and 's<earned' in route and "earned ? '#F9C641' : '#7F8C99'" in checkpoint,
        'nameBelowBase':'campaignChapterPlate(item, 0, -86, 152, 32)' in route,
        'forestAndLairRetained':between(checkpoint,'function forest','/** The empty-star face')==between(oldcheckpoint,'function forest','/** The empty-star face'),
        'heroBagFilteringAndNativeScrollUnchanged':between(hero,'      const cells:','function buildLobbyRoster')==between(oldhero,'      const cells:','function buildLobbyRoster'),
        'heroModalsAndInventoryActionsUnchanged':hero.split('function pressAction',1)[1]==oldhero.split('function pressAction',1)[1],
        'heroFigureAndPowerGeometryUnchanged':between(hero,'  const footY','  const sq')==between(oldhero,'  const footY','  const sq'),
        'heroEquipmentTopAlignedAndActionsContained':'const equipmentY = height / 2 - 12 - equipmentH / 2' in hero and "N('heroDetails', equipment, 0, -equipmentH / 2 + 38, 260, 52)" in hero,
        'heroBagMovesUpEighty':'const bagTop = stageTop + stageH;' in hero and 'heroEnvironment(body, bagTop, -154, 97)' in hero and 'HERO_DETAIL_H' not in hero,
        'nativeRailScrollUnchanged':between(rail,'  const state =','  return { content')==between(oldrail,'  const state =','  return { content'),
        'compactRailOnlyOptIn':'{ cardWidth:120,step:134,center:true }' in hero and 'opts.step ?? STEP' in rail and 'opts.cardWidth ?? ROSTER_CARD_W' in rail,
        'drawerNavigationAndWorldUnchanged':levels.split('  function renderSheet()',1)[0]==oldlevels.split('  function renderSheet()',1)[0] and levels.split('  function renderWorld()',1)[1]==oldlevels.split('  function renderWorld()',1)[1],
        'difficultyControlsRewardsAndBattleUnchanged':sheet.replace("{ sound: 'select', dragThreshold: 7, motion: false }","{ sound: 'select', dragThreshold: 7 }")==oldsheet,
        'opaqueSurfaceInsideExistingDrawBarrier':"refreshUI(host, () => {" in levels and "const panel = campaignPreparationPanel(host,0,0,750,sheetH)" in levels and "panel.name = 'campaignPreparationSurface'" in levels,
        'lootCatalogRewardsAndCollectionUnchanged':between(loot,'const pct =','/** Item previews')==between(oldloot,'const pct =','/** Item previews') and loot.split('/** Aggregate duplicates',1)[1]==oldloot.split('/** Aggregate duplicates',1)[1],
        'lootSharesCommonDetailSkinAndLayout':"else root = detailDialog(parent, width, h, '掉落物详情'" in loot and "detailSkin(root, width, h, '掉落物详情')" in loot and "detailBody(root, contentH, DETAIL_ACTION_FOOTER, 'dropItem')" in loot and 'shopQualitySocket(panel, x, y, side, d?.quality ?? 1)' in loot and 'detailGroup(content, cursor, group.title, group.rows)' in loot,
        'lootCloseAndReturnUnchanged':between(loot,'  const close = (): void => {','  // Catalog -> item')==between(oldloot,'  const close = (): void => {','  // Catalog -> item'),
        'lootProbabilityAndPreviewFormulasRetained':all(x in loot and x in oldloot for x in ["const preview = { uid: 'drop-preview', defId: id, lv: 1 }",'const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);','const weight = level.gearPool.find(row => row.id === id)?.weight || 0;','const share = total > 0 ? weight / total : 0;',"Number((value * 100).toFixed(4)) + '%'",'equipmentDropChance(level.difficulty) * share','equipmentDropChance(level.difficulty, { elite: true }) * share','equipStat(preview, key)']),
    }
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/campaign-soft-finish-v9/type-review.log').read_text(encoding='utf-8-sig')
    primary=lambda text:re.findall(r'^assets/.*error TS.*$',text,re.M)
    types={'fullProjectPassed':False,'primaryDiagnosticCount':len(primary(diagnostic)),
           'samePriorPrimaryDiagnostics':primary(diagnostic)==primary(prior),
           'changedModulesHaveDiagnostics':any(n+'(' in diagnostic for n in changed)}
    markers=['squadPaperDivider','squadHeroRoster','selectedCheckpointName','checkpointStar:',
             'campaignPreparationSurface','heroLobbyRoster','dropItemDetails:','掉落后抽取占比','#2863AF','#7F8C99','#B88E55','#E5B34A']
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
    note=(f"2026-10-17 英雄布局、掉落通用详情与关卡修复v10已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '编队分割线与完成按钮改空心菱形和渐细线，已上阵英雄卡加厚金边与切角肩部，上方站位卡保留浅金细框。'
        '前哨盾牌统一深蓝/琥珀金/炭灰漆面，渐变沿完整尖端；开放零星关卡绘制三颗更清晰灰星，关卡名移到底座和星星下方居中。'
        '英雄页头像中心距156→134、触摸槽120，五位完整入视口；头像大小保持，升级页沿用默认间距。'
        '穿戴面板顶部距展示区12，属性/故事移入面板底部，删除原80高独立操作带，背包提前80；人物脚底/石台、装备槽图标大小不变。'
        '抽屉原透明旧内容层会透出新内容，现于原refreshUI屏障内保留不透明完整纸面，素材就绪并绘制后整体交接，难度页签取消缩放回弹。'
        '装备/材料/金币掉落详情复用DetailDialog通用背板、深蓝标题、168展示区、分组浅白底、内容滚动和固定底部操作，按钮下留30；真实概率/收益公式、目录同遮罩返回和偏移保持。'
        '仅八个UI模块，其余脚本散列保持，无新图片或Git提交；地图坐标、解锁/奖励/上下阵/存档事务保持。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型仍为此前十项主诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [编队与关卡修复](docs/squad-trim-v10/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;content=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at=content.index('\n');path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
