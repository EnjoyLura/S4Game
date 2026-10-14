"""Record compiler/deployment receipts; user performs listening acceptance."""
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
note = (f"2026-10-15 配乐与采样音效已构建发布：[正式游戏]({stage['game']})，部署 `{deployment[1]}`。"
    "按用户要求先提交既有版本 `fec68d9`，随后替换音频。大厅／战斗为 cynicmusic 两首奇幻配乐，"
    "42条采样音效含真实长弓／重弩、火／雷／冰普攻与独立技能大招、命中、升级、就绪、胜负和UI。"
    "单例WebAudio按Cocos UUID加载，手势解锁、变体、14声部与命中限流、总线压缩、配乐跨场景淡入和提示压低；"
    "暂停／三选一降低音乐，后台挂起，原音乐／音效开关即时生效。CC0及CC BY 3.0素材保留作者、许可和编辑说明，"
    "随游戏发布audio-credits.html并在暂停设置增加鸣谢入口。英雄媒体、战斗数值、攻速、弹道、特效及防线布局保持。"
    f"无付费生成调用，Cocos成功退出码{build['exitCode']}、{milliseconds}ms，DPR完成，Wrangler main成功。"
    "依用户要求不运行测试、游戏、浏览器或线上试听，听感由用户人工体验。详见 [音频更新](docs/audio-upgrade-v1/README.md)。")
for name in ['AGENTS.md', 'README.md']:
    path = GAME/name
    source = path.read_text(encoding='utf-8-sig')
    first = source.index('\n')
    path.write_text(source[:first+1]+'\n'+note+'\n'+source[first+1:], encoding='utf-8')
with (OUT/'README.md').open('a', encoding='utf-8') as handle:
    handle.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({deployment[1]})。Cocos退出码{build['exitCode']}、{milliseconds}ms，DPR完成，main上传{uploaded[1]}文件、{uploaded[2]}缓存。听感由用户人工体验。\n")
print(json.dumps({'published': True, 'game': stage['game'], 'deployment': deployment[1], 'milliseconds': milliseconds}))
