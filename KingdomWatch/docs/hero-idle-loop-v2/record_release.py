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
args = parser.parse_args()
log_path = Path('C:/Users/user/AppData/Local/Temp/kw-hero-idle-loop-v2-20261014-out.log')
log = log_path.read_text(encoding='utf-8-sig', errors='replace')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', log)[-1])
finished = re.findall(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - debug: =+ build Task', log)[-1]
release = read_json(ROOT / 'deployment-stage.json')
release.update({'status': 'published', 'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai', 'motionAcceptedByUser': True, 'loopFixAcceptedByUser': False,
    'newVideoSubmitted': False, 'characters': [],
    'build': {'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': args.build_exit,
              'milliseconds': milliseconds, 'finishedLocal': finished, 'log': str(log_path)},
    'dprPatch': 'completed',
    'publication': {'tool': 'Wrangler3.114.17', 'exitCode': 0,
                    'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds},
    'memory': ['AGENTS.md: permanent idle-loop closure requirement',
               '../美术/tools/英雄待机循环规范.md', '../美术/tools/AI视频特效工作流.md',
               'generate_video.py: automatic effective loop prompt',
               'package_frames.py: shared adjacent-loop timeline, no loose seam threshold'],
    'review': 'User manual effect review; no tests, browser, game or online QA'})
for hero in ['sniper', 'volt']:
    folder = GAME / 'docs' / (hero + '-idle-lively-loop-v2')
    packaging = read_json(folder / 'packaging.json')
    packaging['gameIntegrated'] = True
    write_json(folder / 'packaging.json', packaging)
    record = {**packaging, 'newVideoSubmitted': False,
              'videoTask': read_json(folder / 'video-task.json'),
              'loopSelection': read_json(folder / 'loop-selection.json'),
              'published': True, 'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}
    write_json(folder / 'release.json', record)
    release['characters'].append(record)
write_json(ROOT / 'release.json', release)
paragraph = (
    f"2026-10-14 [待机循环衔接修正与固定要求](docs/hero-idle-loop-v2/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [新版循环预览]({release['preview']})，部署 `{args.deployment}`。"
    "用户认可上一版动作，但指出首尾跳跃，并明确要求记住衔接约束。本轮不生成新视频或图片，"
    "原 50／43 张动作及图集像素保留，逐相邻帧往返和转折减速，98／84 项约 6.153846 秒完整循环，"
    "平均单程时长保持；末尾第 1 帧接首帧，不再第 49／42 帧硬切首帧，不加透明度过渡。"
    "正式资源 `sniper_idle_lively_loop_v2`／`volt_idle_lively_loop_v2`，尺寸 153／146 和脚底保持；"
    "弓箭手媒体、高度 185.64 及重弩攻击保持。旧三个预览入口同步新版。"
    "首尾衔接要求已经写进 AGENTS 永久约束、英雄待机规范和 AI 视频工作流；"
    "新视频任务自动追加闭合提示词，打包强制相邻帧闭合，取消宽松像素阈值自动放行。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功。"
    "用户人工查看，不运行测试、浏览器、游戏或线上验收；原动作已认可，本次循环修正待人工查看。"
    "详情见 `docs/hero-idle-loop-v2/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n已发布：[新版循环预览]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
