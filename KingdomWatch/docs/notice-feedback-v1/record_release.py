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
note = (f"2026-10-15 通知与成长反馈已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "PageKit.toast统一信息／成功／提醒／奖励／升级通知，沿用主界面深色牌面和状态色、图标、标题与正文。"
    "英雄、武器、普攻／技能／大招、装备与主城升级展示实际等级变化、两项主要属性增量、数字变化、轻回弹、六光屑与突破提示。"
    "GrowthFeedback包裹既有数据操作取前后快照，属性来自heroStats／equipStat／战斗配置／主城公式；数值与存档规则保持。"
    "购买招募、宝箱／图鉴奖励、穿戴替换卸下、出售分解和编队同步，语义采样音合并按钮声。"
    "通知不拦截输入，独立于刷新，图标就绪再入场；单条替换，同对象连续升级合并基线与最新结果，不积压，后台与销毁清理、空闲停更、支持减少动态效果。"
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户约定不运行测试、游戏、浏览器或线上验收。详见 [通知与成长反馈](docs/notice-feedback-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。体验待用户确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
