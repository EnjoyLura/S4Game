"""Review source and packaged artifacts only. Does not run tests, game, simulation or browser."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game/'build/web-mobile'
changed = ['assets/scripts/ui/pages/LevelsPage.ts','assets/scripts/ui/CampaignChrome.ts',
    'assets/scripts/ui/LevelLootPreview.ts','assets/scripts/ui/GearQuality.ts',
    'assets/scripts/ui/pages/ShopPage.ts','assets/scripts/ui/pages/HeroPage.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name,value):
    (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if sys.argv[1] == 'inspect':
    main = max((build/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    sources = [(game/p).read_text(encoding='utf-8-sig') for p in changed]
    levels,chrome,loot,quality,shop,hero = sources
    diff = []
    for path,after in zip(changed,sources):
        before = (out/'before'/(Path(path).name+'.txt')).read_text(encoding='utf-8-sig')
        diff.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='before/'+path,tofile=path))
    (out/'source-review.diff').write_text(''.join(diff),encoding='utf-8')
    retained = {row['path']:sha(game/row['path'])==row['sha256']
        for row in read(out/'source-baseline.json') if row['path'] not in changed}
    diagnostics = (out/'type-review.log').read_text(encoding='utf-8-sig')
    prior = (game/'docs/chapter-banner-art-v1/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$',diagnostics,re.M)==re.findall(r'^assets/.*error TS.*$',prior,re.M)
    body = levels.split('function renderSheet():',1)[1].split('function renderWorld():',1)[0]
    opening = levels.split('function openDrawer(',1)[1].split('function closeDrawer(',1)[0]
    closing = levels.split('function closeDrawer(',1)[1].split('function renderSheet(',1)[0]
    before_levels = (out/'before/LevelsPage.ts.txt').read_text(encoding='utf-8-sig')
    dock = levels.split('function renderDock():',1)[1].split('function openDrawer(',1)[0]
    before_dock = before_levels.split('function renderDock():',1)[1].split('function openDrawer(',1)[0]
    claim = body.split('if (canClaim) bindButton(spot,',1)[1].split('}, { dragThreshold: 7 });',1)[0]
    before_claim = before_levels.split('if (canClaim) bindButton(spot,',1)[1].split('}, { dragThreshold: 7 });',1)[0]
    art = read(out/'art-provenance.json')
    config = '\n'.join(p.read_text(encoding='utf-8') for p in (build/'assets/resources').glob('config.*.json'))
    native_files = list((build/'assets/resources/native').rglob('*.png'))
    assets = []
    for a in art['assets']:
        source = game/a['asset']
        meta = read(source.with_suffix('.png.meta'))['subMetas']['f9941']['userData']
        native = [p.relative_to(build).as_posix() for p in native_files
            if p.stat().st_size==a['bytes'] and sha(p)==a['assetSha256']]
        imports = list((build/'assets/resources/import'/a['uuid'][:2]).glob(a['uuid']+'@f9941.*.json'))
        packed = None
        for path in imports:
            arrays = read(path)
            packed = next((item[0] for item in arrays if isinstance(item,list) and item
                and isinstance(item[0],dict) and item[0].get('name')==a['id']),None)
            if packed:
                break
        rect = dict(zip(['x','y','width','height'],a['spriteRect']))
        assets.append({'id':a['id'],'sha256':a['assetSha256'],'nativePaths':native,
            'sourceUnchanged':sha(source)==a['sourceSha256']==a['assetSha256'],
            'registered':('ux/preparation_art_v2/'+a['id']) in config,
            'sourceRectRetained':[meta[k] for k in ['trimX','trimY','width','height']]==a['spriteRect'],
            'importedRectRetained':bool(packed and packed['rect']==rect),
            'originalSize':packed['originalSize'] if packed else None,
            'capInsets':packed['capInsets'] if packed else None})
    review = {
        'difficultyIconsExactlyThree':len([a for a in art['assets'] if a['id'].startswith('difficulty_')])==3
            and "['normal','elite','hell']" in chrome,
        'threeIllustratedChests':all(a in body for a in ['chest_bronze_v2','chest_sapphire_v2','chest_crimson_v2']),
        'paintedClaimAllButton':"'claim_button_v2'" in body and 'Sprite.Type.SLICED' in chrome,
        'actualClaimTransactionUnchanged':claim==before_claim and 'claimAllChests(key)' in claim,
        'boldNativeHeading':"size: 33, font: 'body', bold: true" in body,
        'noDrawerScrollOrScale':all(s not in body for s in ['pageScroll(','ScrollView','scrollToOffset','body.setScale']),
        'commonDrawerHeightAcrossDifficulties':'sheetH = Math.min(928, bottom - Math.max(20, LO.notchTop + 12))' in opening
            and 'sheetH =' not in body,
        'twoRowsAlwaysReserved':"N('campaignEquipmentTwoRows'" in body and 'layout.rowStep + layout.icon' in body,
        'allConfiguredEquipmentVisible':'challenge.gearPool.forEach(' in body and 'slice(' not in body,
        'normalDifficultyEmptyState':'普通难度不掉落装备\\n挑战精英 / 地狱解锁装备掉落' in body,
        'removedGuaranteedSubtitle':'通关必得' not in levels+loot,
        'centeredProbabilityTitle':"mainLabel(body, 0, by(layout.equipment), '概率掉落装备'" in body,
        'materialAmountPrefix':"'×' + row.n.toLocaleString()" in loot,
        'squareRaritySockets':"N('gearQualitySquare'" in quality and 'g.circle(' not in quality,
        'shopMaterialsShareRaritySocket':'gearQualityHalo(icon, 0, -2, 150, 150, q)' in shop and "'itemHalo'" not in shop,
        'bagMaterialsShareRaritySocket':'isMat || !!d' in hero and "gearQualityHalo(panel, 0, 118, 136, 136, 1)" in hero,
        'dockUnchanged':dock==before_dock,
        'drawerNeverRecentersMap':all(s not in opening+closing for s in ['focusMap(','scrollMap(']),
        'noSquadInsideDrawer':'出战阵容' not in body and 'heroPortrait(' not in body,
        'remainingScriptsUnchanged':all(retained.values()),
        'allArtPackagedUnchanged':all(a['sourceUnchanged'] and a['registered'] and a['sourceRectRetained']
            and a['importedRectRetained'] and a['nativePaths'] for a in assets),
    }
    markers = ['preparation_art_v2/','chest_bronze_v2','chest_sapphire_v2','chest_crimson_v2','claim_button_v2',
        'campaignPreparationContent','campaignEquipmentTwoRows','gearQualitySquare','campaignClaimAll:',
        'campaignMapSquad','campaignChapterLocked','__kingdomWatchOverlayBack']
    result = {'mainBundle':main.relative_to(build).as_posix(),'mainSha256':sha(main),
        'sourceHashes':{path:sha(game/path) for path in changed},'sourceReview':review,'assets':assets,
        'compiledMarkers':{m:m in code for m in markers},'retainedSources':retained,
        'typeReview':{'fullProjectPassed':False,'samePriorPrimaryDiagnostics':same,
            'primaryDiagnosticCount':len(re.findall(r'^assets/.*error TS.*$',diagnostics,re.M)),
            'changedModulesHaveDiagnostics':any(p+'(' in diagnostics for p in changed)},
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(result['compiledMarkers'].values()) or not same \
        or result['typeReview']['changedModulesHaveDiagnostics']:
        raise RuntimeError('Source/artifact review requires attention.')
    print(json.dumps({'mainBundle':result['mainBundle'],'sourceReview':review,'typeReview':result['typeReview']},ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage,receipt,inspection = (read(out/n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle'])!=inspection['mainSha256'] \
        or not all(sha(game/p)==h for p,h in inspection['sourceHashes'].items()) \
        or not all(sha(Path(stage['stage'])/p)==a['sha256'] for a in inspection['assets'] for p in a['nativePaths']):
        raise RuntimeError('Published artifact or receipt mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)',Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'build':receipt,
        'creatorBuildMilliseconds':elapsed,'mainSha256':inspection['mainSha256'],'assets':inspection['assets'],
        'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False})
    note = (f"2026-10-17 战斗准备美术与方形品质底板v2已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '用户澄清一键升级指一键领取，后续纠正难度图标仅普通/精英/地狱各一枚共三枚，已按最新要求制作。内置imagegen新制三枚铜/蓝/红难度旗、棕木/蓝/红金边三档宝箱、金色一键领取按钮，共七张透明原PNG完整接入，无像素修改。'
        '抽屉标题显式使用body粗体，领取按钮九宫格保留斜角与边饰；可领/已领/未达成对应原星级和实际一键领取事务。抽屉统一928上限、同档布局高度，直接显示全部内容，无内部ScrollView或整页缩放；短竖屏用固定紧凑间距。装备预留两行六列、完整池逐项显示、末行居中，普通难度留白仅写解锁描述。'
        '删除通关必得文字、概率掉落装备居中，强化石/铁锭等材料数量加×。装备和材料共用切角方形品质底板、深色内底与品质边光，商店、英雄穿戴/背包、材料详情及掉落图标同步；外层商品/信息纸面保持中性。'
        '地图/节点坐标、底部出战准备和右编队、抽屉不移动大图、主页面切换/战斗返回关闭及编队返回行为保持。仅六个UI模块改动，其余脚本散列保持，无数值/奖励/存档修改，无额外Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型诊断与上一版相同，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，视觉由用户人工确认。'
        '详见 [战斗准备美术与方形品质底板](docs/preparation-art-v2/README.md)。')
    for name in ['AGENTS.md','README.md']:
        p = game/name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as file:
        file.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
