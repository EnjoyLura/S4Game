"""Record compiler/deployment receipts; gameplay acceptance remains manual."""
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
note = (f"2026-10-15 重弩手强化卡v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '重弩卡按白2／蓝6／紫3／黄4重排，解锁技能大招及额外枪线为黄，多目标锁定／快速充能为紫；通用数值卡仍共图、独立归属与叠层。'
    '新蓝远距校准每层技能索敌×1.3，紫贯颅弩矢每层技能额外穿透1个目标，初设各3层；新黄死亡准星1次，大招命中的存活目标头顶红准星、后续受伤+30%持续5秒，百分比已向用户确认。'
    '标记与火坑独立计时，同类易伤及原20%等级标记取高；共享Graphics、战斗模拟时钟、立即命中/死亡清理与池化重置。处决覆盖Boss，处决和猎手增伤接入普攻／技能／大招。'
    '三张新圆形图标由内置image_gen分别生成并完整复制入项目，透明通道保留，完整提示词与源路径见同目录记录；其他旧卡数值前置、弓卡、双基础伤害、雷法特效、人物及音频保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，观感与平衡待用户人工确认。详见 [重弩手强化卡](docs/sniper-cards-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。实际观感与平衡待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
