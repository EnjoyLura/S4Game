"""Offline source/build inspection and release receipts; never executes game modules."""
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
changed = ['assets/scripts/ui/Panels.ts', 'assets/scripts/ui/SettlementPanelSkin.ts',
           'assets/scripts/battle/BattleLoot.ts', 'assets/scripts/battle/BattleDirector.ts',
           'assets/scripts/ui/PositiveFeedback.ts', 'assets/scripts/ui/FeedbackSurface.ts']
added = ['assets/scripts/ui/BattleRewardPanel.ts', 'assets/scripts/ui/BattleRewardPanel.ts.meta']
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
source = lambda p: (root / p).read_text(encoding='utf-8-sig')
before = lambda p: (out / 'before' / (Path(p).name + '.txt')).read_text(encoding='utf-8-sig')

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def module_excerpt(bundle, name):
    at = bundle.index('chunks:///_virtual/' + name + '.ts')
    end = bundle.find('System.register(', at + 1)
    return bundle[at:end if end >= 0 else len(bundle)]

if sys.argv[1] == 'inspect':
    baseline = read(out / 'source-baseline.json')
    retained = {f['path']: sha(root / f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    actual = {p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.ts')}
    unexpected = sorted(actual - {f['path'] for f in baseline} - set(added))
    main = max((web / 'assets/main').glob('index*.js'), key=lambda p: p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    compiled = {}
    for path in changed + added[:1]:
        name = Path(path).stem
        compiled[name] = module_excerpt(bundle, name)
        (out / (name + '-compiled.txt')).write_text(compiled[name], encoding='utf-8')
    for path in changed:
        (out / (Path(path).stem + '-review.diff')).write_text(''.join(difflib.unified_diff(
            before(path).splitlines(True), source(path).splitlines(True), fromfile='before/' + path, tofile=path)), encoding='utf-8')
    panel, skin, loot, director = (source(p) for p in changed[:4])
    panel_before, skin_before, loot_before, director_before = (before(p) for p in changed[:4])
    growth, surface = (source(p) for p in changed[4:])
    helper = source(added[0])
    diagnostic = lambda p: re.findall(r'^assets/.*error TS.*$', p.read_text(encoding='utf-8-sig'), re.M)
    normalize = lambda rows: [re.sub(r'\(\d+,\d+\)', '(line,column)', row) for row in rows]
    types = diagnostic(out / 'type-review.log')
    previous = diagnostic(root / 'docs/growth-feedback-v19/type-review.log')
    expected_director = director_before.replace('xp: Math.floor(this.xp),', 'xp: Math.floor(this.xpEarned),\n        loot: this.loot.summary(),', 1)
    summary = ('  /** Pause reads already-stored pickups without collecting or rolling any pending drops. */\n'
               '  summary(): StageLootSummary { return { equipment: this.picked.slice(), materials: [] }; }\n')
    expected_loot = loot_before.replace('  /** Settlement, exit and repeated cleanup', summary + '  /** Settlement, exit and repeated cleanup', 1)
    last = expected_loot.rfind('    return { equipment: this.picked.slice(), materials: [] };')
    expected_loot = expected_loot[:last] + expected_loot[last:].replace('    return { equipment: this.picked.slice(), materials: [] };', '    return this.summary();', 1)
    new_uuid = read(root / added[1])['uuid']
    same_uuid = [p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.meta') if read(p).get('uuid') == new_uuid]
    audit = read(out / 'component-audit.json')
    checks = {
        'threePanelsShareRenderer': 'battleRewardPanel(root,' in panel and 'battleRewardPanel(parent,' in skin and "outcome === 'win' ? '通关奖励'" in skin,
        'continuousFeatheredSurfaceAndDoubleRules': all(s in helper for s in ["'feather'", "'battleRewardOuterRule'", "'battleRewardInnerRule'", 'height / 2 - 5.5']),
        'noSettlementPaperOrOldRoundPauseSockets': all(s not in skin + panel for s in ['settlementBody', 'reward_socket', 'private rewardIcons']),
        'materialsInUpperEarnedRow': 'options.loot?.materials' in helper and "rewardRow(panel, 'earnedBattleRewards'" in helper,
        'onlyActualEquipmentAggregated': 'for (const item of options.loot?.equipment || [])' in helper and 'counts[item.defId]' in helper and 'gearPool' not in helper,
        'equipmentSectionAbsentWhenEmpty': 'if (hasEquipment)' in helper and 'hasEquipment ? 326 : 204' in helper,
        'overflowAccessibleAndDragDoesNotSelect': 'scroll.horizontal = true; scroll.vertical = false' in helper and 'cancelInnerEvents = true' in helper and 'dragThreshold: 7' in helper,
        'pauseReadOnlySnapshotAndCumulativeXp': director == expected_director and loot == expected_loot,
        'existingWinLoseCallbacksAndTransactionsUnchanged': panel[panel.index('  showWin(o:'):] == panel_before[panel_before.index('  showWin(o:'):],
        'pauseOtherTabsAndActionsUnchanged': panel[panel.index('    } else if (tab === 1)'):panel.index('  showWin(o:')] == panel_before[panel_before.index('    } else if (tab === 1)'):panel_before.index('  showWin(o:')],
        'originalHeraldryAndStarsUnchanged': skin[skin.index('  const width = 590'):skin.index('export function playSettlement')] == skin_before[skin_before.index('  const width = 590'):skin_before.index('export function playSettlement')],
        'originalSettlementButtonsUnchanged': skin[skin.index('export interface SettlementButton'):] == skin_before[skin_before.index('export interface SettlementButton'):],
        'existingCounterMotionAndDoubleGoldStartRetained': '.addReward(number, target' in skin and 'animation.goldFrom || 0' in skin,
        'growthLessDenseWithOneMainComparison': 'growthDeltaSummary' in growth and 'growthStatNumbers' not in growth and 'valueDivider' not in growth and '174 + Math.ceil(secondary.length / 2) * 34' in growth,
        'growthTranslucencyAndRealMainCounter': "height, '#101F2B', .68" in surface and 'value(stat.before, stat)' in growth and 'value(row.value, stat)' in growth,
        'growthRealDeltasAndMergedCounterRetained': 'value(Math.abs(gain), stat)' in growth and 'previous!.level.before' in growth and 'shown.set(this.main.key, this.main.value)' in growth and 'this.countingFast = merged' in growth,
        'ordinaryNoticeSurfaceUnchanged': surface[surface.index('export function noticeSurface'):surface.index('/** Translucent growth')] == before(changed[5])[before(changed[5]).index('export function noticeSurface'):before(changed[5]).index('/** Dense center')],
        'noRegisteredComponentAdded': 'ccclass' not in helper and not audit['conflicts'] and audit['scripts'] == len(baseline) + 1,
        'uuidUnique': same_uuid == [added[1]],
        'sameExistingNineDiagnosticsAllowMovedLines': len(types) == 9 and normalize(types) == normalize(previous),
        'compiledRendererAndBindingsPresent': all('BattleRewardPanel' in compiled[n] for n in ['Panels', 'SettlementPanelSkin']) and 'collectedBattleEquipment' in compiled['BattleRewardPanel'] and 'summary' in compiled['BattleDirector'],
        'compiledNoOldSettlementPaper': 'settlementBody' not in compiled['SettlementPanelSkin'],
        'productionAndDprPrepared': read(web / 'web-release.json')['production'] and read(web / 'build-record.json')['dprPatch'] == 'completed',
    }
    write('bundle-inspection.json', {'checks': checks, 'sourceHashes': {p: sha(root / p) for p in changed + added},
          'retainedScripts': retained, 'remainingScriptsUnchanged': all(retained.values()), 'unexpectedScripts': unexpected,
          'mainBundle': main.relative_to(web).as_posix(), 'mainSha256': sha(main), 'typeDiagnosticCount': len(types),
          'gameRun': False, 'testsRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False})
    print(json.dumps({'checks': checks, 'retained': len(retained), 'typeDiagnostics': len(types)}, ensure_ascii=False))
    if not all(checks.values()) or not all(retained.values()) or unexpected:
        raise RuntimeError('Static inspection requires attention')
elif sys.argv[1] == 'record':
    stage, build, review = (read(out / name) for name in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / review['mainBundle']) != review['mainSha256']:
        raise RuntimeError('Publication receipt or bundle mismatch')
    if not all(sha(root / p) == h for p, h in review['sourceHashes'].items()):
        raise RuntimeError('Source changed after inspected build')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
          'creatorBuildMilliseconds': elapsed, 'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
          'gameRun': False, 'testsRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False})
    note = (f"2026-10-17 战斗奖励渐隐双线v20已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
            '暂停/胜利/失败共用连续alpha两端渐隐深蓝灰底及上下各两条渐隐金线；上层实际金币/本局累计经验/通关材料，'
            '下层按定义逐种显示实际已拾取装备和数量，超过五类横向滑动，点开原战利品目录；无装备则整层隐藏、背板缩短。'
            '暂停新增只读拾取快照且经验改累计，不收取未拾取物、不提前发结算材料；胜败奖励事务/保存/广告只双倍金币/复活和导航/皇冠星级数字动画音效保持。'
            '收到用户升级提示过挤/不够透明补充后，成长提示改208高常规布局（原278），主行保留真实原值→新值/增量，次要属性只显示一行两列增量；背景alpha98.5%降至68%，描边保持可读。'
            '真实快照/长按累计/数字追赶/突破/中部上移/原音效和页面完整对比保持。六原脚本及新增纯BattleRewardPanel工具，其他111脚本散列保持，118脚本无多组件注册，无新媒体。'
            f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR及Wrangler main完成；原九项类型诊断保持、仅Panels行号前移。'
            '本轮用户明确授权奖励分层重排；未运行测试、模拟、游戏、浏览器、试听或线上验收，实机观感待用户确认。详见[战斗奖励面板](docs/battle-rewards-feather-v20/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        path = root / name
        text = path.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            path.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。构建{elapsed}ms；实机观感待人工确认。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}, ensure_ascii=False))
