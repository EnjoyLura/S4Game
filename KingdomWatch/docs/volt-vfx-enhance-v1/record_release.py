"""Record compiler and deployment receipts; visual acceptance belongs to the user."""
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
note = (f"2026-10-15 雷法师特效增强v1已构建发布：[正式游戏]({stage['game']})，部署 `{deployment}`。"
    '纯程序雷电：普攻增强电光弹头、随距离增长的166px渐细离子拖尾、侧电弧、出手放电和命中分叉；'
    '技能同路径紫蓝光晕／细白电芯、附着分叉及错开余电脉冲；大招保留15道落雷，增强分叉雷柱、两次视觉复亮、局部触点爆发及0.33秒地面断弧。'
    'VoltVFX三个共享Graphics层、96事件池，密集命中预留24容量，复用顶点与独立视觉噪声；移除旧逐事件Node/Tween闪电，统一模拟时钟跟随暂停／倍速／顿帧。'
    '双基础伤害、攻速、技能大招即时结算／目标／范围／节奏、人物序列、其他英雄及音频保持，不新增AI图片视频，无绿色死亡残迹。'
    f"Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    '依约不运行测试、模拟、游戏、浏览器或线上验收，观感待用户人工确认。详见 [雷法师特效增强](docs/volt-vfx-enhance-v1/README.md)。')
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    content = path.read_text(encoding='utf-8-sig')
    at = content.index('\n')
    path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as f:
    f.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。观感待用户人工确认。\n")
print(json.dumps(dict(published=True, game=stage['game'], deployment=deployment, milliseconds=milliseconds)))
