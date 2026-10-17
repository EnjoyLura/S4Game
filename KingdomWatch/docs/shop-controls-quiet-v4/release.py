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
changed = ['assets/scripts/ui/LobbyChrome.ts', 'assets/scripts/ui/pages/ShopPage.ts', 'assets/scripts/ui/MainUI.ts', 'assets/scripts/core/GameAudio.ts']
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
    audio_before = (out / 'before/GameAudio.ts.txt').read_text(encoding='utf-8-sig')
    audio_after = (root / 'assets/scripts/core/GameAudio.ts').read_text(encoding='utf-8-sig')
    behavior['audioOnlySharedBusBoostChanged'] = audio_before.split('const SFX_BUS_GAIN', 1)[1] == audio_after.split('const SFX_BUS_GAIN', 1)[1]
    behavior['audioAdditionalOneDbExpression'] = 'const AUDIO_LEVEL_BOOST = Math.SQRT2 * Math.pow(10, 1 / 20);' in audio_after
    navigation = (root / 'assets/scripts/ui/MainUI.ts').read_text(encoding='utf-8-sig')
    behavior['navigationOriginalRoundedSelection'] = 'paintLobbyFace' not in navigation and 'ag.roundRect(-63, -50, 126, 104, 12); ag.fill();' in navigation
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root / 'docs/shop-main-art-v3/type-review.log').read_text(encoding='utf-8-sig')
    pattern = r'^assets/.*error TS.*$'
    same = re.findall(pattern, diagnostics, re.M) == re.findall(pattern, prior, re.M)
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {name: sha(root / name) for name in changed + added},
        'compiledMarkers': {s: s in code for s in ['shopProductTitleBar', 'shopSectionEmblem',
            'shopAttributeGroup', 'shopAttributeRow', 'shopProductUsers', 'shopDetailRule', 'shopQualitySocket',
            'shopProductDetails:', 'shopPurchaseConfirm', 'shopDetailsClose',
            'campaignEquipmentTwoRows', 'preparation_art_v2/', '__kingdomWatchOverlayBack']},
        'rarityCornerLabelCompiled': 'gearQualityTag' in code,
        'remainingScriptsUnchanged': all(retained.values()), 'retainedScripts': retained,
        'purchaseDataAndTransaction': behavior,
        'audioAdjustment': {'relativeToPreviousMixDb': 1, 'bgmAndSfxGainRatio': 10 ** (1 / 20), 'listened': False},
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
    note = (f"2026-10-17 商店按钮还原与词条简化v4已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '按用户截图恢复商品详情右上关闭、底部关闭/购买和商店分类页签的原ComicUI单层样式，移除该处多层斜面绘制，底部按钮恢复248×58和24字号。'
        '弹窗两条金棕分割线加深并加粗为1.8，导航/分类分隔透明度提高；属性、武器特性、持有情况去掉逐条和组内底板，直接在纸面排字，分组标题和绿色加成保留。'
        '暖纸主框、深蓝标题、商品展示、商品卡/品质槽/价格按钮及固定购买区保持。商品预览与购买事务原函数相同，解锁/库存/存档不变。'
        '用户工作中追加BGM和音效各加1dB：GameAudio共享增益在原√2基础上再乘10^(1/20)，营地/战斗BGM及音效初始化/设置刷新共用，静音/淡入淡出/压低避让/压缩保持。'
        '用户追加导航栏选中效果还原：MainUI恢复原126×104圆角纯金底与原图标色，不用多层斜面，保留加深分割线。'
        '仅ShopPage/LobbyChrome/MainUI三UI模块和GameAudio增益变动，其他原脚本散列保持，不新增素材或Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型诊断仍为此前十项主诊断，改动模块无新增诊断；不运行测试、模拟、游戏、浏览器或线上验收，由用户人工确认。'
        '详见 [商店按钮还原与词条简化](docs/shop-controls-quiet-v4/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = root / name
        content = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at = content.index('\n')
            path.write_text(content[:at + 1] + '\n' + note + '\n' + content[at + 1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as file:
        file.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
