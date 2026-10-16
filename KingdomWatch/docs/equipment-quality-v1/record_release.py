"""Save the Wrangler receipt; never load the published game."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
import re

out = Path(__file__).resolve().parent
game = out.parents[1]
stage = json.loads((out / 'deployment-stage.json').read_text(encoding='utf-8-sig'))
build = json.loads((out / 'build-record.json').read_text(encoding='utf-8-sig'))
inspection = json.loads((out / 'bundle-inspection.json').read_text(encoding='utf-8'))
log = (out / 'publish.log').read_text(encoding='utf-8-sig')
urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
if not urls:
    raise RuntimeError('Successful publication receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
digest = hashlib.sha256((Path(stage['stage']) / inspection['mainBundle']).read_bytes()).hexdigest()
if digest != inspection['mainBundleSha256']:
    raise RuntimeError('Published bundle differs from inspected bundle')
record = {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
    'creatorBuildMilliseconds': milliseconds,
    'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
    'mainBundleSha256': digest,
    'validation': {'sourceReview': True, 'localBundleInspection': True, 'cocosBuild': True, 'DPRPatch': True,
        'testsRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False,
        'manualAcceptance': 'pending user'}}
(out / 'release.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
note = (f"2026-10-16 装备品质与结算交互v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。"
    '装备普通灰/优秀绿/稀有蓝/史诗紫共享饱和切角框、名称和品质标签，应用商店、背包、穿戴、详情及掉落；未解锁怪物显示现有图像暖灰剪影和？？？。'
    '关卡掉落图标点开单件实际属性与单次击杀概率，完整目录保留，同遮罩返回不闪。战斗返回关卡页共用城门，240ms合拢、至少1.5秒闭合、320ms展开，目标页嵌套美术/刷新及绘制就绪再开门。'
    '胜败结算移除统计和页签，仅奖励；皇冠按结果弹起/沉降收稳，胜利灰星依次190ms点亮、局部金环碎光，金币/本局经验滚数及落位回弹，双倍从原金额滚动，约1.65秒收净，无全屏白闪、无动画等待锁按钮。'
    '用户确认保留30%失败金币保底，修复原来只算不发；按基础金币与击杀合计30%入账，本局已发目标补差，复活再败/最终通关/双倍不重领。经验明确本局累计，避免升级消耗后余量误显示0，不新增永久经验字段。'
    '重弩大招轴线改高可见度主蓝，起始alpha235、线宽2.6，额外枪线与准星同系，目标伤害时长不改。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，production/MD5/DPR与Wrangler main完成。"
    '静态类型检查记录原有ButtonFeedback等诊断；本轮新增模块无相关诊断。不运行测试、模拟、游戏、浏览器或线上验收，实际观感由用户人工确认。'
    '详见 [装备品质与结算](docs/equipment-quality-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = game / name
    source = path.read_text(encoding='utf-8-sig')
    if stage['game'] not in source:
        at = source.index('\n')
        path.write_text(source[:at+1] + '\n' + note + '\n' + source[at+1:], encoding='utf-8')
readme = out / 'README.md'
if stage['game'] not in readme.read_text(encoding='utf-8'):
    with readme.open('a', encoding='utf-8') as stream:
        stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。实际视觉由用户人工确认。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'milliseconds': milliseconds}))
