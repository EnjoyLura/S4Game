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
folder = GAME / 'docs' / production['sniper']['folder']
task = read_json(folder / 'video-task.json')
release.update({'status': 'published', 'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai', 'sniperAnimationAcceptedByUser': False,
    'voltAnimationAcceptedByUser': True, 'newVideoSubmitted': ['sniper'],
    'reversePlayback': False, 'sniper': production['sniper'], 'volt': production['volt'],
    'videoTask': task, 'sourceInfo': read_json(folder / 'source-info.json'),
    'sourceFraming': read_json(folder / 'idle.frames.json')['sourceFraming'],
    'build': {'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': args.build_exit,
              'milliseconds': milliseconds, 'finishedLocal': finished, 'log': args.build_log},
    'dprPatch': 'completed',
    'publication': {'tool': 'Wrangler3.114.17', 'exitCode': 0, 'attempts': args.publish_attempts,
                    'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds},
    'retained': 'Accepted mage video, atlas and timing; archer media; sniper attack; approved sniper static master, grips, scale and foot pivot',
    'supersedesRejectedSniperClosure': '../sniper-idle-natural-v1/release.json',
    'review': 'Source production only; user manual effect review; no tests, browser, game or online QA'})
write_json(ROOT / 'release.json', release)
write_json(folder / 'release.json', {**release, 'releaseRoot': '../sniper-idle-loop-close-v1/release.json'})
paragraph = (
    f"2026-10-14 [重弩手正向待机首尾重做](docs/sniper-idle-loop-close-v1/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [新重弩手／已确认雷法师预览]({release['preview']})，部署 `{args.deployment}`。"
    "用户确认当前雷法师待机很丝滑，只否定重弩手首尾衔接；雷法师 `volt_idle_natural_v1` 全部媒体、时序和运行时引用冻结，未提交雷法师任务。"
    f"重弩手保留确认母版与宽留白首帧，重新请求两秒 MiniMax H3，任务 `{task['taskId']}`，"
    f"{production['sniper']['uniqueFrames']} 张完整源帧全部保留，正向等时约 3.076923 秒循环。"
    "不倒放、不截短、删帧、停帧或透明度过渡；强调披风端点、轮廓、褶皱和运动相位回归原状。"
    f"新资源 `{production['sniper']['resource']}`，高度 153、画内基准 467.1111 和脚底保持；弓箭手及重弩攻击保持。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功，八个旧预览入口同步。"
    "用户人工查看，不运行测试、浏览器、游戏或线上验收；雷法师已认可，新重弩手效果尚未认可。"
    "详情见 `docs/sniper-idle-loop-close-v1/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n已发布：[新重弩手／已确认雷法师预览]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
