"""Record compiler and deployment receipts without opening the game."""
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
note = (f"2026-10-15 全画面点击与弹性按钮v2已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    "用户要求空白画面也反馈、按钮不能变白：TouchFeedback增加Cocos全局未处理触摸入口与DOM捕获去重，"
    "按下接触环、松手0.4秒金色细环与6光屑，暗边提高浅背景可见度，拖动／滑动取消、后台清空、无输入拦截。"
    "ButtonFeedback完全去除白色覆盖层和高光Tween，旧UIKit停止换按下图片；70ms压至默认94%／下沉2，"
    "100ms回弹102.2%再130ms收稳，快点保留轻压，悬停微抬；页签、三选一卡片、大招图文能量同步。"
    "保留命中范围、禁用／忙碌／拖动取消、点击音效，支持减少动态效果；上一轮48条战斗采样、混音与BGM和页面动画保持。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户要求不运行测试、游戏、浏览器或线上效果验收，手感由用户人工体验。详见 [全画面点击与弹性按钮](docs/tap-spring-v2/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    at = text.index('\n')
    path.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。手感待用户体验。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
