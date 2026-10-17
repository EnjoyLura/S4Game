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
changed = ['assets/scripts/ui/pages/ShopPage.ts', 'assets/scripts/ui/LobbyChrome.ts']
added = []


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
    chrome = (root / 'assets/scripts/ui/LobbyChrome.ts').read_text(encoding='utf-8-sig')
    behavior['modalButtonsUseOriginalStyle'] = 'paintLobbyFace' not in new.split('function openProductDetails(', 1)[1]
    behavior['categoryButtonsUseOriginalStyle'] = 'paintShopCategory' not in new and 'paintShopCategory' not in chrome
    behavior['attributesHaveNoPaintedBackgrounds'] = 'Graphics' not in between(chrome, 'export function shopAttributeGroup(', 'export function shopDetailRule(')
    original = (root / 'docs/shop-main-art-v3/before/ShopPage.ts.txt').read_text(encoding='utf-8-sig')
    original_card = between(original, '  const purchase = comicButton(card,', '\ninterface ProductInfo')
    current_card = between(new, '  const purchase = comicButton(card,', '\ninterface ProductInfo')
    behavior['cardPriceButtonMatchesOriginalStyle'] = original_card.replace('0, -117, 192, 48', '0, -130, 192, 48') == current_card
    behavior['noCustomButtonBevelPainterRemaining'] = 'paintLobbyFace' not in new and 'paintLobbyFace' not in chrome
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root / 'docs/shop-controls-quiet-v4/type-review.log').read_text(encoding='utf-8-sig')
    pattern = r'^assets/.*error TS.*$'
    same = re.findall(pattern, diagnostics, re.M) == re.findall(pattern, prior, re.M)
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {name: sha(root / name) for name in changed + added},
        'compiledMarkers': {s: s in code for s in ['shopProductTitleBar', 'shopSectionEmblem',
            'shopAttributeGroup', 'shopAttributeRow', 'shopProductUsers', 'shopDetailRule', 'shopQualitySocket',
            'shopProductDetails:', 'shopPurchaseConfirm', 'shopDetailsClose',
            'campaignEquipmentTwoRows', 'preparation_art_v2/', '__kingdomWatchOverlayBack']},
        'rarityCornerLabelCompiled': 'gearQualityTag' in code,
        'customButtonBevelPainterCompiled': 'paintLobbyFace' in code,
        'remainingScriptsUnchanged': all(retained.values()), 'retainedScripts': retained,
        'purchaseDataAndTransaction': behavior,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'primaryDiagnosticCount': len(re.findall(pattern, diagnostics, re.M)),
            'changedModulesHaveDiagnostics': any(name + '(' in diagnostics for name in changed + added)},
        'testsRun': False, 'gameRun': False, 'simulationRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not same or result['typeReview']['changedModulesHaveDiagnostics'] or not all(retained.values()) \
            or result['rarityCornerLabelCompiled'] or result['customButtonBevelPainterCompiled'] or not all(result['compiledMarkers'].values()) or not all(behavior.values()):
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
    note = (f"2026-10-17 商店卡片价格按钮还原v5已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '修正上一版漏改商品卡价格按钮：所有分类共用drawCard的金币/钻石购买按钮恢复原ComicUI绿色单层切角面、单轮廓与顶部细高光，尺寸192×48，移除多层渐变/嵌边/底斜面。'
        '删除已无调用的paintLobbyFace及其色板，价钱/货币图标/字号/可购买状态/点击查看详情保持，商品卡位置和品质槽不改。'
        '上一版详情关闭/购买、分类页签、导航圆角选中还原，加深分割线、无词条底板和BGM/音效各+1dB全部保留。'
        '仅ShopPage/LobbyChrome两UI模块改动，其他原脚本散列保持；商品预览及购买事务原函数相同，无数值/存档修改，无新素材或额外Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型诊断仍为此前十项主诊断，改动模块无新增诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [商店卡片价格按钮还原](docs/shop-price-buttons-v5/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = root / name
        content = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at = content.index('\n')
            path.write_text(content[:at + 1] + '\n' + note + '\n' + content[at + 1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as file:
        file.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
