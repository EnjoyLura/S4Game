"""Record compiler/deployment receipts; actual gameplay remains user-reviewed."""
from pathlib import Path
from datetime import datetime
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
stage, build = read(OUT/'deployment-stage.json'), read(OUT/'build-record.json')
log = (OUT/'publish.log').read_text(encoding='utf-8-sig')
deployments = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployments or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
deployment = deployments[-1]
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT/'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment)
write(OUT/'integration.json', integration)
write(OUT/'release.json', {**stage, **integration, 'date': datetime.now().astimezone().isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 双基础伤害与无死亡残迹已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '用户更正：攻击力与技能伤害是两个独立基础数值，普攻=攻击×普攻倍率；技能和大招=攻击×小额攻击系数+技能伤害×技能倍率。'
    '此前百分比转换提议与未发布修改已撤回，不得再将装备技能伤害14/30转换成14%/30%。'
    '本轮初设小额系数20%，弓/弩普攻型每级攻击8%技能3%，雷技能型/火大招型攻击3%技能8%，冰全能型两项5.5%；分类与数值为初设而非用户逐项定稿。'
    'Lv1攻击沿用原实战45/140/60/55/58，独立技能伤害沿用原主界面100/140/90/85/80，GameData.heroStatsAt统一面板/预览/战斗及武器装备聚合，避免重复。'
    '技能等级仅提升对应倍率，装备技能伤害保持固定点数；所有技能大招、弓强化箭、火灼烧共用双项公式，普通倍率不外乘技能；升级通知展示真实两项增量，技能升级展示倍率。'
    '死亡取消全部绿色地面残迹，保留原地短促碎散及元素收尾，继续禁止整人倒地；旧v2残迹说明已被本条取代。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，实际效果与平衡待用户人工确认。详见 [双基础伤害](docs/dual-base-damage-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。实际表现与平衡待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
