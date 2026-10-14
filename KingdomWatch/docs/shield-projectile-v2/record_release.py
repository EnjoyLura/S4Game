"""Record the build and Wrangler receipts without claiming visual acceptance."""
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
write(OUT/'release.json',{**stage,**integration,'date':datetime.now().astimezone().isoformat(),
    'build':build,'creatorBuildMilliseconds':milliseconds,'deploymentSucceeded':True,
    'uploadedFiles':int(uploaded[1]),'cachedFiles':int(uploaded[2]),'visualAcceptance':'pending user manual review'})
note = (f"2026-10-15 防线蓝色外盾与普攻发射／飞行特效已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "耐久条底基198提高至212（上移14），蓝盾按盾量／最大耐久在完整血条外侧包覆空心细框，不盖绿色生命；"
    "右上数值生命在上、盾值在下，零盾保留0且隐藏蓝框。大招入口底基240提高至340，已解锁英雄仍紧凑排列。"
    "内置image_gen分别生成风压、火焰、雷电、冰霜四张透明发射贴图，原像素与alpha完整保存，配合原生扩散风压／碎屑，"
    "弓箭与弩分别0.32／0.36秒，火0.36、雷0.30、冰0.38秒，实际普攻方向触发，齐射每排一次。"
    "飞行增加渐隐锥形拖尾与两侧风线、余烬、电丝或霜晶，按距离与模拟年龄驱动，暂停倍速同步；"
    "只有普攻及强化普攻箭使用，原弹体与英雄媒体、尺寸、攻速、伤害、弹速、碰撞、技能、大招、命中特效、声音及其他UI保留。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "用户人工查看，不运行测试、游戏、浏览器或线上验收，未记作视觉认可。详见 [外盾与普攻特效](docs/shield-projectile-v2/README.md)。")
for name in ['AGENTS.md','README.md']:
    path = GAME/name
    text = path.read_text(encoding='utf-8-sig')
    first = text.index('\n')
    path.write_text(text[:first+1]+'\n'+note+'\n'+text[first+1:],encoding='utf-8')
with (OUT/'README.md').open('a',encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published':True,'game':stage['game'],'deployment':deployment[1],'milliseconds':milliseconds},ensure_ascii=True))
