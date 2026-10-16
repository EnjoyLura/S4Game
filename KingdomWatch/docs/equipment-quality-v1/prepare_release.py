"""Package this iteration's source delta and existing production publish workflow."""
from pathlib import Path
import difflib
import hashlib
import json

out = Path(__file__).resolve().parent
game = out.parents[1]
sources = {
    'ShopPage.ts': 'assets/scripts/ui/pages/ShopPage.ts',
    'HeroPage.ts': 'assets/scripts/ui/pages/HeroPage.ts',
    'BasePage.ts': 'assets/scripts/ui/pages/BasePage.ts',
    'LevelLootPreview.ts': 'assets/scripts/ui/LevelLootPreview.ts',
    'BattleEntry.ts': 'assets/scripts/ui/BattleEntry.ts',
    'MainUI.ts': 'assets/scripts/ui/MainUI.ts',
    'BattleDirector.ts': 'assets/scripts/battle/BattleDirector.ts',
    'SettlementPanelSkin.ts': 'assets/scripts/ui/SettlementPanelSkin.ts',
    'Panels.ts': 'assets/scripts/ui/Panels.ts',
    'SniperUltimateVFX.ts': 'assets/scripts/battle/SniperUltimateVFX.ts',
}
new = ['assets/scripts/ui/GearQuality.ts', 'assets/scripts/ui/SettlementMotion.ts']
diff = []
for basename, path in sources.items():
    before = (out / (basename + '.before.txt')).read_text(encoding='utf-8-sig')
    after = (game / path).read_text(encoding='utf-8-sig')
    diff.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True), fromfile='before/' + path, tofile=path))
for path in new:
    diff.extend(difflib.unified_diff([], (game / path).read_text(encoding='utf-8-sig').splitlines(True), fromfile='/dev/null', tofile=path))
(out / 'source-review.diff').write_text(''.join(diff), encoding='utf-8')
scope = 'equipment rarity; clickable drop previews; locked monster silhouettes; battle-exit gates; animated reward-only settlement; durable defeat floor and revival deduplication; brighter blue sniper aim'
publish = (game / 'docs/training-weapon-float-v1/publish.ps1').read_text(encoding='utf-8-sig')
publish = publish.replace('docs/hero-weapon-slot-halves-v1/deployment-stage.json', 'docs/training-weapon-float-v1/deployment-stage.json')
publish = publish.replace('training-weapon-float-v1-', 'equipment-settlement-v1-')
old_scope = 'weapon float; hero equipment vertical alignment; hold hero/weapon upgrades with local power feedback; higher attribute panels; horizontal hero rosters'
publish = publish.replace(old_scope, scope)
(out / 'publish.ps1').write_text(publish, encoding='utf-8-sig')
receipt = (game / 'docs/training-weapon-float-v1/record_release.py').read_text(encoding='utf-8-sig')
start = receipt.index('note = (')
end = receipt.index("for name in ['AGENTS.md', 'README.md']:", start)
note = '''note = (f"2026-10-16 装备品质与结算交互v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '装备普通灰/优秀绿/稀有蓝/史诗紫共享饱和切角框、名称和品质标签，应用商店、背包、穿戴、详情及掉落；未解锁怪物显示现有图像暖灰剪影和？？？。'
    '关卡掉落图标点开单件实际属性与单次击杀概率，完整目录保留，同遮罩返回不闪。战斗返回关卡页共用城门，240ms合拢、至少1.5秒闭合、320ms展开，目标页嵌套美术/刷新及绘制就绪再开门。'
    '胜败结算移除统计和页签，仅奖励；皇冠按结果弹起/沉降收稳，胜利灰星依次190ms点亮、局部金环碎光，金币/本局经验滚数及落位回弹，双倍从原金额滚动，约1.65秒收净，无全屏白闪、无动画等待锁按钮。'
    '用户确认保留30%失败金币保底，修复原来只算不发；按基础金币与击杀合计30%入账，本局已发目标补差，复活再败/最终通关/双倍不重领。经验明确本局累计，避免升级消耗后余量误显示0，不新增永久经验字段。'
    '重弩大招轴线改高可见度主蓝，起始alpha235、线宽2.6，额外枪线与准星同系，目标伤害时长不改。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
    '静态类型检查记录原有ButtonFeedback等诊断；本轮新增模块无相关诊断。不运行测试、模拟、游戏、浏览器或线上验收，实际观感由用户人工确认。'
    '详见 [装备品质与结算](docs/equipment-quality-v1/README.md)。')
'''
receipt = receipt[:start] + note + receipt[end:]
(out / 'record_release.py').write_text(receipt, encoding='utf-8')
hashes = {path: hashlib.sha256((game / path).read_bytes()).hexdigest() for path in [*sources.values(), *new]}
(out / 'source-hashes.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
print(json.dumps({'sourceFiles': len(hashes), 'diffLines': len(''.join(diff).splitlines()), 'scope': scope}, ensure_ascii=False))
