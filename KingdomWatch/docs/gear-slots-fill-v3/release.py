"""Source and local artifact review/receipt only; never launches the game or browser."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
root = out.parents[1]
build = root/'build/web-mobile'
changed = ['assets/scripts/ui/GearQuality.ts', 'assets/scripts/ui/pages/HeroPage.ts',
    'assets/scripts/ui/pages/ShopPage.ts', 'assets/scripts/ui/LevelLootPreview.ts']

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, data):
    (out/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

if sys.argv[1] == 'inspect':
    main = max((build/'assets/main').glob('index.*.js'), key=lambda p:p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    diff = []
    for name in changed:
        before = (out/'before'/(Path(name).name+'.txt')).read_text(encoding='utf-8-sig')
        after = (root/name).read_text(encoding='utf-8-sig')
        diff.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='before/'+name,tofile=name))
    (out/'source-review.diff').write_text(''.join(diff),encoding='utf-8')
    baseline = read(out/'source-baseline.json')
    retained = {p['path']:sha(root/p['path'])==p['sha256'] for p in baseline if p['path'] not in changed}
    diagnostics = (out/'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root/'docs/preparation-art-v2/type-review.log').read_text(encoding='utf-8-sig')
    pattern = r'^assets/.*error TS.*$'
    same = re.findall(pattern,diagnostics,re.M)==re.findall(pattern,prior,re.M)
    script_text = '\n'.join(p.read_text(encoding='utf-8-sig') for p in (root/'assets/scripts').rglob('*.ts'))
    result = {'mainBundle':main.relative_to(build).as_posix(),'mainSha256':sha(main),
        'sourceHashes':{name:sha(root/name) for name in changed},
        'rarityCornerLabelReferencesRemaining':'gearQualityTag' in script_text,
        'rarityCornerLabelCompiled':'gearQualityTag' in code,
        'compiledMarkers':{s:s in code for s in ['gearQualitySquare','heroEquipped:','heroBagItem:',
            'campaignEquipmentTwoRows','preparation_art_v2/','campaignMapSquad','__kingdomWatchOverlayBack']},
        'remainingScriptsUnchanged':all(retained.values()),'retainedScripts':retained,
        'typeReview':{'fullProjectPassed':False,'samePriorPrimaryDiagnostics':same,
            'primaryDiagnosticCount':len(re.findall(pattern,diagnostics,re.M)),
            'changedModulesHaveDiagnostics':any(name+'(' in diagnostics for name in changed)},
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not same or result['typeReview']['changedModulesHaveDiagnostics'] or not all(retained.values()) \
        or result['rarityCornerLabelReferencesRemaining'] or result['rarityCornerLabelCompiled'] \
        or not all(result['compiledMarkers'].values()):
        raise RuntimeError('Source/artifact review needs attention.')
    print(json.dumps({k:v for k,v in result.items() if k not in ['retainedScripts','sourceHashes']},ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage,receipt,inspection = (read(out/name) for name in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle'])!=inspection['mainSha256'] \
        or not all(sha(root/name)==value for name,value in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)',Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'build':receipt,
        'creatorBuildMilliseconds':elapsed,'mainSha256':inspection['mainSha256'],
        'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False})
    note = (f"2026-10-17 装备槽铺满与品质角标移除v3已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '按用户截图删除普通/优秀/稀有/史诗左上品质签，移除共享gearQualityTag及英雄穿戴/背包/对比、商店/商品详情、结算战利品全部调用。'
        '英雄已穿戴槽由完整方形品质底板覆盖，取消槽内76%小底板与浅色外圈；背包和详情图标同样铺满。武器左半方形与四装备槽共用sq尺寸，保留右半名称/等级，武器行高度同步sq，四装备行与14间距、44顶部和14底边明确排布。'
        '商店商品图158方形与槽同大、详情124方形铺满原槽；等级与数量角标、空槽提示、品质说明文字保持，未改任何穿戴/强化/购买/奖励/存档逻辑。'
        '本轮仅四个UI模块，其余脚本散列保持，不新增运行时美术资源、未额外Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型诊断与上一版相同，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '后续用户追加商店页与商品弹窗效果图请求，图稿独立保存在docs/shop-art-concept-v2，尚未实装其新布局。'
        '详见 [装备槽铺满与品质角标移除](docs/gear-slots-fill-v3/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path = root/name
        text = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as file:
        file.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
