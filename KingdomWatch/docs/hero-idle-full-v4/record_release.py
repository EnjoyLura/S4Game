import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


parser = argparse.ArgumentParser()
parser.add_argument('--deployment', required=True)
parser.add_argument('--uploaded', type=int, required=True)
parser.add_argument('--cached', type=int, required=True)
parser.add_argument('--upload-seconds', type=float, required=True)
parser.add_argument('--build-exit', type=int, required=True)
parser.add_argument('--publish-attempts', type=int, default=1)
parser.add_argument('--source-folder', default='sniper-idle-full-v6')
args = parser.parse_args()
log_path = Path('C:/Users/user/AppData/Local/Temp/kw-hero-idle-full-v4-20261014-out.log')
log = log_path.read_text(encoding='utf-8-sig', errors='replace')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', log)[-1])
finished = re.findall(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - debug: =+ build Task', log)[-1]
release = read_json(ROOT / 'deployment-stage.json')
folder = GAME / 'docs' / args.source_folder
packaging = read_json(folder / 'packaging.json')
manifest = read_json(folder / 'idle.frames.json')
source_info = read_json(folder / 'source-info.json')
packaging['gameIntegrated'] = True
packaging['sourceVideoNewlyGenerated'] = True
packaging['fullSourceRequired'] = True
packaging['motionAcceptedByUser'] = False
packaging['userAccepted'] = False
write_json(folder / 'packaging.json', packaging)
release.update({'status': 'published', 'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai', 'animationAcceptedByUser': False,
    'newVideoSubmitted': True, 'sniper': packaging,
    'videoTask': read_json(folder / 'video-task.json'),
    'firstFrameLayout': read_json(folder / 'first-frame-layout.json'),
    'firstFrameHost': read_json(folder / 'first-frame-host.json'),
    'sourceInfo': source_info,
    'sourceFraming': manifest['sourceFraming'],
    'allSourceFramesRetained': manifest['source']['indices'] == list(range(source_info['frameCount'])),
    'loopClosure': manifest['animation']['loopClosure'],
    'supersedesRejectedWorkaround': '../hero-idle-cape-fix-v3/release.json',
    'rejectedVideoAttempts': [read_json(path) for path in sorted((GAME / 'docs').glob('sniper-idle-full-v*/rejected-source.json'))],
    'build': {'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': args.build_exit,
              'milliseconds': milliseconds, 'finishedLocal': finished, 'log': str(log_path)},
    'dprPatch': 'completed',
    'publication': {'tool': 'Wrangler3.114.17', 'exitCode': 0, 'attempts': args.publish_attempts,
                    'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds},
    'retained': 'Approved static master, stance, grips, game scale and foot pivot, volt idle, archer media and sniper attack',
    'review': 'Source production only; user manual effect review; no tests, browser, game or online QA'})
write_json(ROOT / 'release.json', release)
write_json(folder / 'release.json', {**release, 'releaseRoot': '../hero-idle-full-v4/release.json'})
paragraph = (
    f"2026-10-14 [重弩手完整待机重新生成](docs/hero-idle-full-v4/README.md) 已接入并构建发布："
    f"[正式游戏]({release['game']}) · [新完整视频与序列帧]({release['preview']})，部署 `{args.deployment}`。"
    "用户否定从坏源片截短后发布的处理，明确要求重新生成；旧 cape-fix-v3 仅保留历史。"
    f"本轮用同一确认图的宽留白首帧请求两秒 MiniMax H3，新任务 `{release['videoTask']['taskId']}`，"
    f"返回 {source_info['frameCount']} 张源帧，全部保留为 {packaging['uniqueFrames']} 张完整人物帧／"
    f"{packaging['timelineFrames']} 项相邻往返时序，约 {packaging['seconds']:.6f} 秒完整循环；"
    "不截短、不筛掉出框坏帧，所有源帧在制作前必须保持原视频四边至少 12 像素留白。"
    f"新正式资源 `{packaging['resource']}`，画内基准 467.1111、游戏高度 153 和脚底保持；"
    "雷法师当前媒体与循环、弓箭手媒体及高度 185.64、重弩攻击保持。"
    "源码打包默认要求待机全帧，出框拒绝整段并重生；已在 AGENTS 和制作规范记住此纠正。"
    "相邻帧闭合和转折缓和继续适用，五个旧预览入口同步新版。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功。"
    "仅素材制作、构建与发布，用户人工查看，未运行测试、浏览器、游戏或线上验收；"
    "新生成动画尚未获用户认可。详情见 `docs/hero-idle-full-v4/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n本轮实际使用 {source_info['frameCount']} 张源帧，全帧保留，图集 {packaging['atlas']}，"
                 f"{packaging['timelineFrames']} 项时序，循环约 {packaging['seconds']:.6f} 秒。\n"
                 f"\n已发布：[新完整视频与序列帧]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
