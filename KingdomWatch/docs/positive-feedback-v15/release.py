"""Inspect source files/build artifacts and record deployment receipts. Never run game code."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
root = out.parents[1]
web = root / 'build/web-mobile'
changed = ['assets/scripts/ui/GrowthFeedback.ts', 'assets/scripts/ui/TrainingGrowthFx.ts',
    'assets/scripts/ui/TrainingLobby.ts', 'assets/scripts/ui/RewardPopup.ts', 'assets/scripts/ui/SettlementMotion.ts',
    'assets/scripts/ui/UIAudio.ts', 'assets/scripts/core/AudioCatalog.ts',
    'assets/scripts/ui/pages/ShopPage.ts', 'assets/scripts/ui/pages/BasePage.ts']
added = ['assets/scripts/ui/PositiveFeedback.ts', 'assets/scripts/ui/CelebrationInk.ts', 'assets/scripts/ui/RewardCollectFx.ts']
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
source = lambda n: (root / n).read_text(encoding='utf-8-sig')
before = lambda n: (out / 'before' / (Path(n).name + '.txt')).read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

if sys.argv[1] == 'inspect':
    baseline = read(out / 'source-baseline.json')
    retained = {f['path']: sha(root / f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    paths = {p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.ts')}
    unexpected = sorted(paths - {f['path'] for f in baseline} - set(added))
    shop = source(changed[7]); base = source(changed[8]); growth = source(changed[0])
    popup = source(changed[3]); training = source(changed[2]); positive = source(added[0])
    old_shop = before(changed[7])
    buy_prefix = lambda text, stop: text.split('  const attemptPurchase = (): void => {', 1)[1].split(stop, 1)[0]
    review = {
        'purchaseGuardsAndTransactionPreserved': buy_prefix(shop, '    dismissUI(panel.parent, () => {') == buy_prefix(old_shop, '    toast(g.name'),
        'oneShopBuyCallPreserved': shop.count('shopBuy(g)') == old_shop.count('shopBuy(g)') == 1,
        'oneCodexClaimAndKeepUpgradePreserved': base.count('claimCodexReward(id)') == base.count('() => upKeep()') == 1,
        'singleGrowthActionBetweenCaptures': 'const before = capture(target), result = action();' in growth and growth.count('action()') == 1 and 'const after = capture(target)' in growth,
        'growthFailureReturnsBeforeCelebration': growth.index('if (!result.ok)') < growth.index('showPositiveFeedback(GLOBAL_ROOT'),
        'holdUsesOneGrowthActionPerTick': 'const result = growthAction(target, action, repeating);' in training and "uiSound(repeating ? 'confirm' : 'upgrade')" not in training,
        'sameGestureHitTargetRetained': 'footerControl.refresh(nextCost, capped); ctx.refreshResources?.();' in training and 'fx.pulse(before, heroStats(hid).power, milestone)' in training,
        'coalescedPowerAndOpacityDoNotRestart': 'this.fromPower = this.displayedPower' in positive and 'out(this.appearanceAge / .12)' in positive and 'before: previous!.level.before' in positive,
        'rewardReceiptOnly': all(token not in popup for token in ['shopBuy(', 'upHero(', 'upKeep(', 'claimAllChests(', 'saveSave(', 'claimCodexReward(']),
        'rewardPositiveAmountFilterRetained': 'Number.isFinite(item.amount) && item.amount > 0' in popup,
        'oneGuardedCloseAndSemanticSound': 'if (closing) return;' in popup and popup.count('uiSound(this.sound)') == 1 and 'bindBrowserBack(dim, close)' in popup,
        'successPopupsAboveRetainedPageLayers': 'showRewardPopup(ctx.screens.parent || ctx.screens' in shop and 'showRewardPopup(ctx.screens.parent || ctx.screens' in base,
        'constructionPulseUsesRefreshedArt': 'keepModal(ctx, session, true)' in base and 'constructionPulse(castle,side*.72)' in base,
        'ordinaryNoticeSourceUnchanged': retained['assets/scripts/ui/UINotice.ts'],
        'settlementLayoutSourceUnchanged': retained['assets/scripts/ui/SettlementPanelSkin.ts'] and retained['assets/scripts/ui/Panels.ts'],
        'coreTransactionsAndConfigsUnchanged': all(ok for name, ok in retained.items() if '/core/' in name or '/config/' in name or '/battle/' in name),
    }
    for name in changed:
        (out / (Path(name).stem + '-review.diff')).write_text(''.join(difflib.unified_diff(before(name).splitlines(True), source(name).splitlines(True), fromfile='before/' + name, tofile=name)), encoding='utf-8')
    diagnostic = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (root / 'docs/reward-banner-notice-v14/type-review.log').read_text(encoding='utf-8-sig')
    primary = lambda s: re.findall(r'^assets/.*error TS.*$', s, re.M)
    types = {'fullProjectPassed': False, 'primaryDiagnosticCount': len(primary(diagnostic)),
        'samePrimaryDiagnosticsAsV14': primary(diagnostic) == primary(prior),
        'modifiedFilesHaveDiagnostics': any(n + '(' in diagnostic for n in changed + added)}
    main = max((web / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    markers = ['PositiveFeedback', 'ConstructionPulse', 'rewardBacklight', 'recruitedHero:', 'rewardCollectFx',
        'settlementVictoryBacklight', 'trainingGrowthBacklight', 'feedback-v15/reward', 'feedback-v15/construction',
        'gameToastFadedBackground', 'baseCampTitlePlate']
    native = {sha(p): p.relative_to(web).as_posix() for p in (web / 'assets/resources').rglob('*.wav')}
    audio = read(out / 'audio-manifest.json')
    for entry in audio:
        entry['sourceStillMatchesManifest'] = sha(root / entry['file']) == entry['sha256']
        entry['builtNativeAsset'] = native.get(entry['sha256'])
    result = {'mainBundle': main.relative_to(web).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {n: sha(root / n) for n in changed + added}, 'sourceReview': review,
        'remainingScriptsUnchanged': all(retained.values()), 'retainedScripts': retained,
        'unexpectedNewScripts': unexpected, 'compiledMarkers': {m: m in bundle for m in markers},
        'audio': audio, 'typeReview': types, 'testsRun': False, 'simulationRun': False, 'gameRun': False,
        'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not all(review.values()) or not all(retained.values()) or unexpected or not all(result['compiledMarkers'].values()) or not types['samePrimaryDiagnosticsAsV14'] or types['modifiedFilesHaveDiagnostics'] or not all(a['sourceStillMatchesManifest'] and a['builtNativeAsset'] for a in audio):
        raise RuntimeError('Local source/build inspection requires attention')
    print(json.dumps({'sourceReview': review, 'typeReview': types, 'compiledMarkers': result['compiledMarkers'],
        'audioAssets': len(audio), 'retainedScriptCount': len(retained)}, ensure_ascii=False))
elif sys.argv[1] == 'record':
    stage, build, inspection = (read(out / n) for n in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] or not all(sha(root / n) == v for n, v in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
        'creatorBuildMilliseconds': elapsed, 'mainSha256': inspection['mainSha256'],
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'testsRun': False, 'simulationRun': False,
        'gameRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False})
    note = (f"2026-10-17 关键玩法正向反馈v15已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '胜利增加皇冠放射光/庆祝碎片/星级落点与音效；领奖保留v14横幅并强化依次揭晓/扫光/真实数量，收下货币飞资源栏。'
        '购买商品改实际品质物品展示，招募改现有完整立绘登场。英雄/武器/技能/装备与主城成长使用非阻塞真实等级/属性/战力增量，长按连升合并且数字/透明度不重启；培养脚底双环/上升暖光，主城新预览局部光环。'
        '八条原创和声短音约345KB，原音频开关/解锁/后台静音/混音限频保持。九原UI/音频脚本和三新增模块，其他原脚本散列保持；交易/奖励/成长/存档/地图/英雄媒体/布局/原普通Toast保持，无新图片或Git提交。'
        f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '类型仍为原九项诊断，本轮模块无新增诊断；不运行测试、模拟、游戏、浏览器、试听或线上验收，效果由用户人工确认。详见 [正向反馈](docs/positive-feedback-v15/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = root / name; contents = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in contents:
            at = contents.index('\n'); path.write_text(contents[:at+1] + '\n' + note + '\n' + contents[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
