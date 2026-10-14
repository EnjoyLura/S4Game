"""Record successful build/publication; leave visual acceptance to the user."""
from pathlib import Path
from datetime import datetime
import json
import re

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
stage,build = read(OUT/'deployment-stage.json'),read(OUT/'build-record.json')
log = (OUT/'publish.log').read_text(encoding='utf-8-sig')
deployment = re.search(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)',log)
if not deployment or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)',Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT/'integration.json')
integration.update(status='published',game=stage['game'],deployment=deployment[1])
write(OUT/'integration.json',integration)
release = {**stage,**integration,'date':datetime.now().astimezone().isoformat(),
    'build':build,'creatorBuildMilliseconds':milliseconds,'deploymentSucceeded':True,
    'uploadedFiles':int(uploaded[1]),'cachedFiles':int(uploaded[2]),
    'visualAcceptance':'pending user manual review'}
write(OUT/'release.json',release)
note = (f"2026-10-15 五英雄普攻发射特效已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "弓箭手0.18秒白青风压音爆，重弩手0.22秒更宽的白蓝风压，火法师0.24秒橙红短焰流与黄芯余烬，"
    "雷法师0.18秒紫白分叉电弧，冰法师0.25秒冰蓝霜气与细小晶片。原创原生Graphics按真实普攻方向和同一出弹原点绘制，"
    "弓箭每排一次、齐射不叠加、连射每排触发，强化普攻同款微放大；其他四位只在普攻shoot出手时触发。"
    "单Graphics、36份预分配数据、无逐发Node/Tween，共用战斗时钟暂停／倍速，随场景清理。"
    "没有调用付费图片／视频生成或复制其他游戏素材；五英雄图片和待机／攻击、弹体、飞行尾迹、技能、大招、"
    "命中特效、伤害、攻速、弹速、碰撞、索敌、音效与UI保留。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "按用户要求不运行测试、游戏、浏览器或线上验收，效果由用户人工查看，未记作视觉认可。详见 [普攻发射特效](docs/basic-launch-v1/README.md)。")
for name in ['AGENTS.md','README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    first = text.index('\n')
    path.write_text(text[:first+1]+'\n'+note+'\n'+text[first+1:],encoding='utf-8')
with (OUT/'README.md').open('a',encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published':True,'game':stage['game'],'deployment':deployment[1],'milliseconds':milliseconds},ensure_ascii=True))
