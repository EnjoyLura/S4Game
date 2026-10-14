import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


parser = argparse.ArgumentParser()
parser.add_argument('--deployment', required=True)
parser.add_argument('--uploaded', type=int, required=True)
parser.add_argument('--cached', type=int, required=True)
parser.add_argument('--upload-seconds', type=float, required=True)
parser.add_argument('--build-exit', type=int, required=True)
parser.add_argument('--build-log', required=True)
parser.add_argument('--publish-attempts', type=int, default=1)
args = parser.parse_args()
log = Path(args.build_log).read_text(encoding='utf-8-sig', errors='replace')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', log)[-1])
finished = re.findall(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - debug: =+ build Task', log)[-1]
release = read_json(ROOT / 'deployment-stage.json')
production = read_json(ROOT / 'production.json')
sources = {}
for hero, packaging in production.items():
    folder = GAME / 'docs' / packaging['folder']
    sources[hero] = {'packaging': packaging, 'videoTask': read_json(folder / 'video-task.json'),
                     'sourceInfo': read_json(folder / 'source-info.json'),
                     'sourceCycle': read_json(folder / 'source-cycle.json'),
                     'sourceFraming': read_json(folder / 'idle.frames.json')['sourceFraming']}
release.update({'status': 'published', 'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai', 'animationAcceptedByUser': False, 'newVideoSubmitted': True,
    'reversePlayback': False, 'sources': sources,
    'build': {'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': args.build_exit,
              'milliseconds': milliseconds, 'finishedLocal': finished, 'log': args.build_log},
    'dprPatch': 'completed',
    'publication': {'tool': 'Wrangler3.114.17', 'exitCode': 0, 'attempts': args.publish_attempts,
                    'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds},
    'retained': 'Approved static masters, stance, grips, display scale, painted-height calibration, foot pivot, archer media and sniper attack',
    'supersedesRejectedReversePlayback': '../hero-idle-flow-v1/release.json',
    'review': 'Source production only; user manual effect review; no tests, browser, game or online QA'})
write_json(ROOT / 'release.json', release)
for hero, packaging in production.items():
    write_json(GAME / 'docs' / packaging['folder'] / 'release.json',
               {'hero': hero, **release, 'releaseRoot': '../hero-idle-natural-v1/release.json'})
paragraph = (
    f"2026-10-14 [两位英雄正向待机重做](docs/hero-idle-natural-v1/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [新原视频与正向序列帧]({release['preview']})，部署 `{args.deployment}`。"
    "用户否定正放／倒放循环造成披风诡异；本次沿用确认母版重新提交两段两秒 MiniMax H3，"
    f"任务 `{sources['sniper']['videoTask']['taskId']}`／`{sources['volt']['videoTask']['taskId']}`。"
    f"重弩手 {production['sniper']['uniqueFrames']}／雷法师 {production['volt']['uniqueFrames']} 张完整源帧全部保留，"
    "按原时间顺序等时正向播放，单周期约 3.076923 秒；不追加倒放、不截短、不删帧、不加长停留或透明度过渡。"
    f"资源 `{production['sniper']['resource']}`／`{production['volt']['resource']}`，"
    "固定画内基准、脚底与高度 153／146，弓箭手媒体及重弩攻击保持。"
    "共享函数、打包入口、提示词和永久规范已取消默认往返，七个旧预览入口同步新版。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功。"
    "用户人工查看，不运行测试、浏览器、游戏或线上验收；生成提示词和时序不证明视觉闭合，本轮新动作尚未获用户认可。"
    "详情见 `docs/hero-idle-natural-v1/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n已发布：[新原视频与正向序列帧]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
