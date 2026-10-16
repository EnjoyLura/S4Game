"""Record build/publication receipts, leaving visual acceptance to the user."""
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
note = (f"2026-10-15 战斗弹窗按钮统一主界面风格已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "用户否定宝石切面钮，三选一刷新、暂停退出／继续／倍速、成功失败导航及广告领取复用ComicUI主界面按钮，"
    "单层色块、细深色轮廓、小切角、窄顶部高光和按下2像素；绿钮奶白字、金钮深字、禁用灰绿。"
    "新增共享comicButtonControl处理动态文案及禁点，主界面原API和显示保持；暂停设置行与开关同步平面化。"
    "暂停／结算页签使用同系金／深色连体面，原分段几何保持。位置、文字、字号、刷新按钮宽度差、广告／扣钻／"
    "奖励与存档回调保持，标题、奖励、卡面、统计、英雄媒体、战斗、上一轮发射强化与配乐音效保持。"
    f"无生图调用，Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户要求不运行测试、游戏、浏览器或线上视觉验收，用户人工查看。详见 [主界面按钮复用](docs/battle-buttons-lobby-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1]+'\n'+note+'\n'+source[first+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}))
