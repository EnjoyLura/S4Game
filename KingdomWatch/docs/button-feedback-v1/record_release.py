"""Record build/publication receipts without launching the game."""
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
note = (f"2026-10-15 全局按钮反馈已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "源码触控入口已归类，ComicUI／UIKit共用按钮、五页导航／页签／卡片／物品、编队、HUD、三选一、暂停、结算、设置和GM统一ButtonFeedback。"
    "65ms按下缩放96.5%／下沉1.5、120ms回位、180ms高光、鼠标悬停和有效点击采样音效；"
    "配对触点、滑出／拖动取消、ScrollView兼容、松开后真实命中、140ms跨节点连点保护、共用触控至少44，"
    "禁用／销毁／后台清理，无闲置update。图文同步反馈，连体页签与三选一原动画保持。"
    "广告刷新、双倍领取、复活和进入战斗补齐处理中禁点；已领取／满级等明确禁用，资源不足保留原因提示；"
    "新怪物通知去除重复回调，设置开关增加滑动。页面布局、英雄媒体、战斗与特效、已授权音频保持，无新媒体生成。"
    f"Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "按用户要求不运行测试、游戏、浏览器或线上效果验收，手感由用户人工体验。详见 [按钮反馈](docs/button-feedback-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1]+'\n'+note+'\n'+source[first+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。效果由用户人工查看。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}))
