"""Record compiler and Pages receipts; visual acceptance is manual."""
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
note = (f"2026-10-15 英雄页控件与入口布局已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "左右切换停止加载圆石按钮，改为ComicUI深色64×64切角面和原生金色箭头，复用主界面按下反馈；"
    "属性／故事移至角色战力正下方，148×50、图标30、文字22，新增64高操作行；"
    "原立绘尺寸与绝对位置、名字、战力和装备槽保持，站台脚底锚点同步，装备整栏收短至最后一行下方16留白。"
    "背包武器／装备／材料页签采用30图标＋10间距＋44文字框的完整居中组合，选中状态和分类逻辑保持。"
    "本次用户反馈取代hero-comic-v3的圆石按钮与旧详情入口尺寸／位置要求；英雄媒体、背包操作、战斗特效、音频和上一轮弹窗保持。"
    f"无生图调用，Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "按用户要求不运行测试、游戏、浏览器或线上视觉验收，用户人工查看。详见 [英雄页控件布局](docs/hero-controls-lobby-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1]+'\n'+note+'\n'+source[first+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}))
