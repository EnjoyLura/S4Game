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
note = (f"2026-10-15 已穿戴装备卸下入口已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "装备栏详情弹窗底部新增卸下装备，与装备锻造并排；装备对比当前卡同样补齐卸下入口。"
    "复用takeOff保存，物品保留并回到对应背包分类顶部，关闭弹窗后刷新装备栏、穿戴数量、属性与战力；卸下前校验UID避免旧弹窗误操作。"
    "沿用主界面按钮、弹性反馈与确认音效。"
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户约定不运行测试、游戏、浏览器或线上验收。详见 [已穿戴装备卸下入口](docs/equipment-unequip-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。体验待用户确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
