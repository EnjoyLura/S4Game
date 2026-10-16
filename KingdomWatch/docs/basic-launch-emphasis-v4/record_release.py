"""Record build/deployment output; visual acceptance belongs to the user."""
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
deployment = re.search(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', log)
uploaded = re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)', log)
if not deployment or not uploaded:
    raise RuntimeError('Successful Wrangler receipt required')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
integration = read(OUT/'integration.json')
integration.update(status='published', game=stage['game'], deployment=deployment[1])
write(OUT/'integration.json', integration)
write(OUT/'release.json', {**stage, **integration, 'date': datetime.now().astimezone().isoformat(),
    'build': build, 'creatorBuildMilliseconds': milliseconds, 'deploymentSucceeded': True,
    'uploadedFiles': int(uploaded[1]), 'cachedFiles': int(uploaded[2])})
note = (f"2026-10-15 普攻发射强化已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "用户要求更夸张、更明显，沿用纯程序Shader；弓箭／重弩／火／雷／冰缩放分别1.45／1.7／1.5／1.5／1.5，"
    "时长0.32／0.36／0.34／0.30／0.36秒。透明度系数1.4、衰减指数0.95，亮芯与柔边加粗；"
    "双层错时风压、更宽焰流与8余烬、3支双侧分叉电弧、更强霜气与6晶片。Graphics载入回退同步强化，"
    "仍为36槽池、实际出弹方向与模拟时钟，无发射贴图或AI调用。英雄媒体、弹体、飞行拖尾、数值攻速、"
    "技能大招、命中、防线布局以及上一轮配乐音效保持。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "用户人工查看，不运行测试、游戏、浏览器或线上验收。详见 [普攻发射强化](docs/basic-launch-emphasis-v4/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1]+'\n'+note+'\n'+source[first+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}))
