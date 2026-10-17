"""Review saved source/build artifacts and record the deployment. No game or UI execution."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import difflib,hashlib,json,re,sys

out=Path(__file__).resolve().parent
root=out.parents[1]
build=root/'build/web-mobile'
changed=['assets/scripts/ui/pages/HeroPage.ts','assets/scripts/ui/pages/ShopPage.ts',
         'assets/scripts/ui/HeroChrome.ts','assets/scripts/ui/LobbyChrome.ts']
added=['assets/scripts/ui/DetailDialog.ts']
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
between=lambda s,a,b:s.split(a,1)[1].split(b,1)[0]

def write(name,data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1]=='inspect':
    main=max((build/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle=main.read_text(encoding='utf-8')
    diff=[]
    for name in changed+added:
        snapshot=out/'before'/(Path(name).name+'.txt')
        before=snapshot.read_text(encoding='utf-8-sig') if snapshot.exists() else ''
        after=(root/name).read_text(encoding='utf-8-sig')
        diff.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='before/'+name,tofile=name))
    (out/'source-review.diff').write_text(''.join(diff),encoding='utf-8')
    retained={p['path']:sha(root/p['path'])==p['sha256'] for p in read(out/'source-baseline.json') if p['path'] not in changed}
    old=(out/'before/HeroPage.ts.txt').read_text(encoding='utf-8-sig')
    hero=(root/changed[0]).read_text(encoding='utf-8-sig')
    oldshop=(out/'before/ShopPage.ts.txt').read_text(encoding='utf-8-sig')
    shop=(root/changed[1]).read_text(encoding='utf-8-sig')
    skin=(root/changed[2]).read_text(encoding='utf-8-sig')
    chrome=(root/changed[3]).read_text(encoding='utf-8-sig')
    shared=(root/added[0]).read_text(encoding='utf-8-sig')
    mutations=r'\b(?:saveSave|wearEquip|sellEquip|takeOff|growthAction|upWeapon|upWornEquip)\('
    mutation_lines=lambda s:[line.strip() for line in s.splitlines() if re.search(mutations,line)]
    behavior={
        'heroMutationCallLinesUnchanged':mutation_lines(old)==mutation_lines(hero),
        'replaceAndUnequipFunctionsUnchanged':between(old,'function replaceEquip(', 'function warehouseEquipModal(')==between(hero,'function replaceEquip(', 'function warehouseEquipModal('),
        'openWeaponBagUnchanged':between(old,'function openWeaponBag(', 'function replaceEquip(')==between(hero,'function openWeaponBag(', 'function replaceEquip('),
        'blankTapDismissalUnchanged':between(old,'function equipmentDim(', 'function wornEquipModal(')==between(hero,'function equipmentDim(', 'function wornEquipModal('),
        'shopCatalogAndCardsUnchanged':between(oldshop,'const CARD_W','function openProductDetails(')==between(shop,'const CARD_W','function openProductDetails('),
        'shopPurchaseFunctionUnchanged':between(oldshop,'  const attemptPurchase =','  const purchase =')==between(shop,'  const attemptPurchase =','  const purchase ='),
        'heroStageAndSocketsUnchanged':between(old,'function buildLobbyRoster(', 'function equipIcon(')==between(hero,'function buildLobbyRoster(', 'function equipIcon('),
        'allWornEquipmentStillFiltered':'!Object.values(sv.heroes).some(h => Object.values(h.worn).includes(e.uid))' in hero,
        'bagScrollMemoryRetained':all(s in hero and s in old for s in ['bagSt.offsets[scrollKey] = offset','scroll.scrollToOffset(new Vec2(0, offset), 0)']),
        'actualSharedShopHeroSkin':'export const heroModalSkin = detailSkin;' in skin and 'return detailDialog(parent,w,h,title,name);' in skin and 'paintShopModal(panel,width,height);' in shared and 'detailDialog(ctx.screens.parent' in shop,
        'sharedShowcaseAndBody':all(s in shop and s in hero for s in ['detailOverview(','detailBody(','detailGroup(','detailFooter(']),
        'nearWhiteGroupBackground':"'#FFFCF6','#FFFFFF'" in chrome and "'detailAttributeGroup'" in shared,
        'singleFaceButtonsAndBottomSpace':'paintLobbyFace' not in hero+shop+chrome+skin+shared and 'height/2+59' in shared,
        'equipmentNoExtraCloseX':"heroModalSkin(panel,w,h,current?'当前装备':'背包装备');" in hero and 'panel.addComponent(BlockInputEvents);' in hero,
        'flowingEquipmentHeight':'h = fixedHeight || detailHeight(contentH,footerH,640,w)' in hero,
        'comparisonEqualHeight':'Math.max(equipmentContentH(worn,hid,335),equipmentContentH(next,hid,335))' in hero,
        'inventoryContinuousPaper':'heroInventoryPaper(body,WY(bagTop,bagH),bagH);' in hero and 'g.rect(-375,-height/2,750,height)' in skin,
        'categoryContinuousStrip':'paintLobbyStrip(tabBar' not in hero and 'paint = face.getComponent(Graphics)!; paint.clear();' in hero,
        'fixedFooterAndShortScreenBody':'scroll.vertical = contentH>bodyH' in shared and 'height-headerH-footerH' in shared,
    }
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/hero-lobby-art-v5/type-review.log').read_text(encoding='utf-8-sig')
    pattern=r'^assets/.*error TS.*$'
    errors=re.findall(pattern,diagnostic,re.M)
    type_review={'fullProjectPassed':False,'samePriorPrimaryDiagnostics':errors==re.findall(pattern,prior,re.M),
        'primaryDiagnosticCount':len(errors),'changedModulesHaveDiagnostics':any(n+'(' in diagnostic for n in changed+added)}
    markers=['detailUsers','detailAttributeGroup','detailTextGroup','heroInventory','heroBagTabs',
        'heroEquipment','heroAttrs','heroStory','heroMaterial','shopProduct','InfoView','InfoContent',
        'shopProductTitleBar','heroEquipmentCard:','shopPurchaseConfirm','campaignEquipmentTwoRows','__kingdomWatchOverlayBack','#FFFCF6']
    result={'mainBundle':main.relative_to(build).as_posix(),'mainSha256':sha(main),'sourceHashes':{n:sha(root/n) for n in changed+added},
        'sourceReview':behavior,'remainingScriptsUnchanged':all(retained.values()),'retainedScripts':retained,
        'compiledMarkers':{m:m in bundle for m in markers},'rarityCornerLabelCompiled':'gearQualityTag' in bundle,
        'customButtonBevelPainterCompiled':'paintLobbyFace' in bundle,'typeReview':type_review,
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(behavior.values()) or not all(retained.values()) or not all(result['compiledMarkers'].values()) \
        or result['rarityCornerLabelCompiled'] or result['customButtonBevelPainterCompiled'] \
        or not type_review['samePriorPrimaryDiagnostics'] or type_review['changedModulesHaveDiagnostics']:
        raise RuntimeError('Source/artifact review needs attention; see bundle-inspection.json')
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
    note=(f"2026-10-17 英雄详情共用布局v6已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '抽出DetailDialog，商品详情和英雄装备/对比/属性/故事/材料/强化/出售确认实际复用纸面金框、内收深蓝标题、168展示区、分组标题、整块浅白底和固定底部操作。'
        '装备随属性/特性实际内容分配高度，比较两侧等高；原单层按钮下留30单位，短屏仅信息区独立。'
        '背包取消贴屏切角外框，连续浅纸面接场景/导航；分类统一圆角深蓝条，只绘制一个内收金色选中面，修复两端露底和切角接缝。'
        '角色场景/战力/穿戴槽、背包过滤/滚动记忆、底部导航保持，购买/穿戴/卸下/出售/强化事务调用与此前相同。'
        '仅HeroPage/ShopPage/HeroChrome/LobbyChrome四模块和新增DetailDialog，其他脚本散列保持；无配置/数值/存档修改、无新增图片或Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型诊断仍为此前十项主诊断，改动文件无诊断；不运行测试、模拟、游戏、浏览器或线上验收，由用户人工确认。'
        '详见 [英雄详情共用布局](docs/hero-detail-shared-v6/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;content=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at=content.index('\n');path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
