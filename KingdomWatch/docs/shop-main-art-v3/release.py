"""Read source/build artifacts and save deployment receipts. Does not run UI or game code."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
root = out.parents[1]
build = root / 'build/web-mobile'
changed = ['assets/scripts/ui/MainUI.ts', 'assets/scripts/ui/pages/ShopPage.ts']
added = ['assets/scripts/ui/LobbyChrome.ts']


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


if sys.argv[1] == 'inspect':
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    diff = []
    for name in changed + added:
        snapshot = out / 'before' / (Path(name).name + '.txt')
        before = snapshot.read_text(encoding='utf-8-sig') if snapshot.exists() else ''
        after = (root / name).read_text(encoding='utf-8-sig')
        diff.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True),
            fromfile='before/' + name, tofile=name))
    (out / 'source-review.diff').write_text(''.join(diff), encoding='utf-8')
    retained = {p['path']: sha(root / p['path']) == p['sha256']
        for p in read(out / 'source-baseline.json') if p['path'] not in changed + added}
    old = (out / 'before/ShopPage.ts.txt').read_text(encoding='utf-8-sig')
    new = (root / 'assets/scripts/ui/pages/ShopPage.ts').read_text(encoding='utf-8-sig')
    def between(text, start, end):
        return text.split(start, 1)[1].split(end, 1)[0]
    behavior = {
        'productInfoUnchanged': between(old, 'function productInfo(', 'function openProductDetails(')
            == between(new, 'function productInfo(', 'function openProductDetails('),
        'purchaseTransactionHandlerUnchanged': between(old, '  const attemptPurchase = ', '\n  const purchase = comicButton(panel')
            == between(new, '  const attemptPurchase = ', '\n  const purchase = comicButton(panel'),
    }
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root / 'docs/gear-slots-fill-v3/type-review.log').read_text(encoding='utf-8-sig')
    pattern = r'^assets/.*error TS.*$'
    same = re.findall(pattern, diagnostics, re.M) == re.findall(pattern, prior, re.M)
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {name: sha(root / name) for name in changed + added},
        'compiledMarkers': {s: s in code for s in ['shopProductTitleBar', 'shopSectionEmblem',
            'shopAttributeGroup', 'shopProductUsers', 'shopDetailRule', 'shopQualitySocket',
            'shopProductDetails:', 'shopPurchaseConfirm', 'shopDetailsClose',
            'campaignEquipmentTwoRows', 'preparation_art_v2/', '__kingdomWatchOverlayBack']},
        'rarityCornerLabelCompiled': 'gearQualityTag' in code,
        'remainingScriptsUnchanged': all(retained.values()), 'retainedScripts': retained,
        'purchaseDataAndTransaction': behavior,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'primaryDiagnosticCount': len(re.findall(pattern, diagnostics, re.M)),
            'changedModulesHaveDiagnostics': any(name + '(' in diagnostics for name in changed + added)},
        'testsRun': False, 'gameRun': False, 'simulationRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not same or result['typeReview']['changedModulesHaveDiagnostics'] or not all(retained.values()) \
            or result['rarityCornerLabelCompiled'] or not all(result['compiledMarkers'].values()) or not all(behavior.values()):
        raise RuntimeError('Source/artifact review needs attention.')
    print(json.dumps({k: v for k, v in result.items() if k not in ['retainedScripts', 'sourceHashes']}, ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage, receipt, inspection = (read(out / name) for name in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] \
            or not all(sha(root / name) == value for name, value in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': receipt,
        'creatorBuildMilliseconds': elapsed, 'mainSha256': inspection['mainSha256'],
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun': False, 'gameRun': False, 'simulationRun': False, 'browserRun': False, 'onlineAcceptance': False})
    note = (f"2026-10-17 商店主页面与商品详情美术v3已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '按商店效果图完成深蓝分类条/金色选中签、米纸商品卡、180方形品质槽、绿色斜面价格按钮；五页共用导航使用深蓝条、金色选中与四条低对比度浅分割线，高度128保持。'
        '商品详情采用暖纸薄金框与深蓝弧形标题栏、168品质槽大图、名称/适用英雄/描述展示；初始属性、武器特性、持有情况、获取说明分组，浅属性底条和绿色加成数值。'
        '详情按实际内容分配高度，购买区域固定；短屏可滚动信息区，价格不压住属性。关闭深蓝、购买绿色按钮仅同色斜面/厚度/高光，不加金边，禁用灰绿态。'
        '商品数据预览和实际购买事务与本轮前源码相同，解锁/库存/不足提示/成功反馈/存档规则保持。仅改MainUI/ShopPage并新增LobbyChrome，其余原脚本散列保持；复用现有插画，无新增运行图片或额外Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型诊断与上一版相同，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [商店主页面与商品详情美术](docs/shop-main-art-v3/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = root / name
        content = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at = content.index('\n')
            path.write_text(content[:at + 1] + '\n' + note + '\n' + content[at + 1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as file:
        file.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
