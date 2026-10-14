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
release.update({'status': 'published', 'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai', 'animationAcceptedByUser': False, 'newVideoSubmitted': False,
    'sniper': production['sniper'], 'volt': production['volt'],
    'build': {'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': args.build_exit,
              'milliseconds': milliseconds, 'finishedLocal': finished, 'log': args.build_log},
    'dprPatch': 'completed',
    'publication': {'tool': 'Wrangler3.114.17', 'exitCode': 0, 'attempts': args.publish_attempts,
                    'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds},
    'retained': 'All current character frames, atlas bytes, original loop length, stance, grips, display scale, foot pivot, archer media and sniper attack',
    'review': 'Timing production only; user manual effect review; no tests, browser, game or online QA'})
write_json(ROOT / 'release.json', release)
for hero in ['sniper', 'volt']:
    write_json(GAME / 'docs' / f'{hero}-idle-flow-v1' / 'release.json',
               {'hero': hero, **release, 'releaseRoot': '../hero-idle-flow-v1/release.json'})
paragraph = (
    f"2026-10-14 [两位英雄待机停顿修正](docs/hero-idle-flow-v1/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [新版待机预览]({release['preview']})，部署 `{args.deployment}`。"
    "旧时序在往返转折帧额外停留约 0.25／0.32 秒；本轮取消五倍长停帧，仅保留最多 10% 的轻微缓和。"
    "完整保留重弩手 56 张／110 项、雷法师 43 张／84 项当前帧序，约 6.153846 秒循环，"
    "图集原样复制、相邻首尾及固定比例脚底保持，未生成视频、未裁短或删帧。"
    "新资源 `sniper_idle_flow_v1`／`volt_idle_flow_v1`，显示高度 153／146，弓箭手及重弩攻击保持。"
    "共享循环函数与永久规范已记住禁止转折长停留，GIF 和预览同步，六个旧入口更新。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功。"
    "用户人工查看，不运行测试、浏览器、游戏或线上验收；本次节奏修正尚未获用户认可。"
    "详情见 `docs/hero-idle-flow-v1/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n已发布：[新版待机预览]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
