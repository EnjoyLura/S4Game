"""Record build/deployment receipts without claiming manual gameplay acceptance."""
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
note = (f"2026-10-15 弓箭手强化卡v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '弓卡分组白2／蓝5／紫7／黄3，补齐黄色品质及两套卡面和GM呈现；连射／齐射最大5层，齐射间隔10°→7°且保留主箭方向。'
    '连射／齐射／分裂／爆炸／寒霜／烈焰每次领取仅本英雄攻击倍率×0.9并在卡面说明；爆炸和两附魔改1次，避免旧第二层无增益只减攻。'
    '爆炸范围／威力需爆炸，充能／多轮需解锁大招；其余数值和前置保持。'
    '攻击20%／攻速15%白卡与暴击15%／暴伤30%蓝卡成为五英雄同工厂独立副本，共用对应图标，按owner与ID单独生效叠层；保留弓弩旧ID，法师补12张。'
    '黄卡相对权重0.05，旧品质及类型乘权保持；其余英雄专属卡和全局卡暂不改，后续按英雄迭代。双基础伤害、雷法特效、人物动作及音频保持。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，平衡待用户人工确认。详见 [弓箭手强化卡](docs/archer-cards-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。实际平衡待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
