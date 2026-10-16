"""Record compiler and publication receipts without gameplay acceptance."""
from pathlib import Path
from datetime import datetime
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

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
note = (f"2026-10-15 强化卡权重已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "按用户要求，通用攻击／攻速／暴击／经验卡抽取权重降至原0.3倍，普攻机制、元素、技能／大招解锁及强化提高至2倍，防线辅助保持1倍。"
    "类型权重与原稀有度权重相乘，首次和刷新共用draw3；上阵过滤、前置、上限、不重复和卡效果保持。"
    "权重倍率并非固定出现概率。保留技能突破滑动与页面白闪修复。"
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户约定不运行测试、抽样模拟、游戏或浏览器验收。详见 [强化卡抽取权重](docs/card-offer-weights-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    at = text.index('\n')
    path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。体验待用户确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
