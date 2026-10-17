"""Review saved source and build artifacts, then record the publication receipt; never run game/UI."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import difflib,hashlib,json,re,sys

out=Path(__file__).resolve().parent
root=out.parents[1]
build=root/'build/web-mobile'
changed=['assets/scripts/ui/pages/HeroPage.ts','assets/scripts/ui/LobbyChrome.ts']
added=['assets/scripts/ui/HeroChrome.ts']
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
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
    chrome=(root/changed[1]).read_text(encoding='utf-8-sig')
    skin=(root/added[0]).read_text(encoding='utf-8-sig')
    def between(text,start,end):return text.split(start,1)[1].split(end,1)[0]
    mutations=r'\b(?:saveSave|wearEquip|sellEquip|takeOff|growthAction|upWeapon|upWornEquip)\('
    mutation_lines=lambda s:[line.strip() for line in s.splitlines() if re.search(mutations,line)]
    behavior={
        'mutationCallLinesUnchanged':mutation_lines(old)==mutation_lines(hero),
        'replaceAndUnequipFunctionsUnchanged':between(old,'function replaceEquip(', 'function warehouseEquipModal(')==between(hero,'function replaceEquip(', 'function warehouseEquipModal('),
        'openWeaponBagUnchanged':between(old,'function openWeaponBag(', 'function replaceEquip(')==between(hero,'function openWeaponBag(', 'function replaceEquip('),
        'allWornEquipmentStillFiltered': '!Object.values(sv.heroes).some(h => Object.values(h.worn).includes(e.uid))' in hero,
        'bagScrollMemoryRetained': all(s in hero and s in old for s in ['bagSt.offsets[scrollKey] = offset','scroll.scrollToOffset(new Vec2(0, offset), 0)']),
        'figureAndPowerCallsUnchanged':all(line.strip() in hero for line in old.splitlines() if 'heroComicFigure(stage,' in line or "comic_power_plate_v3'" in line),
        'fullSizeWeaponAndEquipmentSquares': 'shopQualitySocket(slot,wide?artX:0,0,h,d.quality);' in hero,
        'originalSingleFaceButtons': 'paintLobbyFace' not in hero+chrome+skin and "const button = comicButton(parent, x, y, 150, 52" in hero,
        'equipmentNoOuterCloseX':"heroModalSkin(panel,w,h,current?'当前装备':'背包装备',false);" in hero,
        'blankTapDismissalUnchanged':between(old,'function equipmentDim(', 'function wornEquipModal(')==between(hero,'function equipmentDim(', 'function wornEquipModal('),
        'nearWhiteGroups':"'#FFFCF6','#FFFFFF'" in chrome and 'lobbyAttributeWell(parent,0,y,w,h' in skin,
        'shopGroupsUseWhiteWell':"lobbyAttributeWell(parent,0,y,552,height,'shopAttributeGroup')" in chrome,
        'heroActionBottomInset': 'height/2+60' in skin and hero.count('heroActionY(')>=5,
        'nativeLabelsNotScreenshot': all(s in hero for s in ['mainLabel(panel','heroStats(hid)','equipStat(inst']) and 'hero-art-concept-v4/' not in hero,
    }
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/shop-attribute-paper-v6/type-review.log').read_text(encoding='utf-8-sig')
    pattern=r'^assets/.*error TS.*$'
    current_errors=re.findall(pattern,diagnostic,re.M)
    type_review={'fullProjectPassed':False,'samePriorPrimaryDiagnostics':current_errors==re.findall(pattern,prior,re.M),
        'primaryDiagnosticCount':len(current_errors),'changedModulesHaveDiagnostics':any(n+'(' in diagnostic for n in changed+added)}
    markers=['heroModalTitleBar','heroAttributeWhite','heroPortraitRim','heroInventory','heroEquipmentCard:',
        'heroBagEmpty','heroStoryHeading','heroMaterialDialog','heroForgeDialog','shopProductTitleBar',
        'shopAttributeGroup','shopPurchaseConfirm','campaignEquipmentTwoRows','__kingdomWatchOverlayBack','#FFFCF6']
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
    note=(f"2026-10-17 英雄页美术落地v5已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '按英雄效果稿完成头像细金环/名字签、信息层次、暖白穿戴栏、完整方形品质槽、属性/故事单层按钮及80高独立操作区、浅纸背包/深蓝分类/淡化背包空态。'
        '属性、故事、装备详情/对比、出售确认、强化及材料详情统一暖白纸框/深蓝标题、整组浅白内容底；商店同组同步改为#FFFCF6→#FFFFFF。'
        '装备和强化动作底部留30–32单位，双栏武器卡800高完整分配三属性/两特性/继承说明/价格与操作；装备点空白关闭，不加外框或关闭X。'
        '原角色/场景/石台锚点/战力、全英雄已穿戴过滤、滚动记忆、原单层按钮和导航选中保持。'
        '仅HeroPage/LobbyChrome改动，新增HeroChrome；其他已有脚本散列保持，核心事务调用行相同，无配置/数值/存档修改，无新增图片或Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型诊断仍为此前十项主诊断，改动文件无诊断；不运行测试、模拟、游戏、浏览器或线上验收，由用户人工确认。'
        '详见 [英雄页美术落地](docs/hero-lobby-art-v5/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;content=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at=content.index('\n');path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
