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
log_path = Path('C:/Users/user/AppData/Local/Temp/kw-hero-idle-cape-fix-v3-20261014-out.log')
log = log_path.read_text(encoding='utf-8-sig', errors='replace')
milliseconds = int(re.findall(r'build-project-total \((\d+)ms\)', log)[-1])
finished = re.findall(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - debug: =+ build Task', log)[-1]
release = read_json(ROOT / 'deployment-stage.json')
folder = GAME / 'docs/sniper-idle-cape-safe-v3'
packaging = read_json(folder / 'packaging.json')
packaging['gameIntegrated'] = True
write_json(folder / 'packaging.json', packaging)
release.update({'status': 'published', 'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai', 'motionAcceptedByUser': True, 'capeFixAcceptedByUser': False,
    'newVideoSubmitted': False, 'sniper': packaging,
    'cause': 'Original video later cape frames cross the source image right edge',
    'build': {'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': args.build_exit,
              'milliseconds': milliseconds, 'finishedLocal': finished, 'log': str(log_path)},
    'dprPatch': 'completed',
    'publication': {'tool': 'Wrangler3.114.17', 'exitCode': 0,
                    'attempts': 2, 'retry': 'First upload-token request returned authentication code 10000; same retained stage retried',
                    'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds},
    'retained': 'Intact original cell pixels, display scale and foot pivot, adjacent loop closure, volt idle/archer media/sniper attack',
    'review': 'Source production only; user manual effect review; no tests, browser, game or online QA'})
write_json(ROOT / 'release.json', release)
write_json(folder / 'release.json', {**packaging, 'deployment': args.deployment,
            'game': release['game'], 'preview': release['preview'], 'published': True,
            'videoTask': read_json(folder / 'video-task.json'), 'newVideoSubmitted': False})
paragraph = (
    f"2026-10-14 [重弩手斗篷出框修正](docs/hero-idle-cape-fix-v3/README.md) 已构建发布："
    f"[正式游戏]({release['game']}) · [完整斗篷预览]({release['preview']})，部署 `{args.deployment}`。"
    "用户指出斗篷超屏，源片第 28–52 帧已被右边界截断，本轮从认可段保留完整连续源帧 4–26，"
    "23 张原像素、44 项相邻往返时序、约 2.762951 秒，随保留运动段缩短时长维持平均节奏。"
    "新正式资源 `sniper_idle_cape_safe_v3`，图集 4096×1536，未重新生成视频／图片，"
    "固定比例、人物尺寸 153、脚底及原帧像素保持，不靠缩人物或扩大透明画布遮掩原片缺失。"
    "首尾相邻衔接、转折减速继续适用；雷法师当前像素与循环、弓箭手及重弩攻击保持。"
    "源取景留白要求已写入永久规范和生成提示词，通用打包入口拒绝距源边界不足 12 像素的帧。"
    "四个旧预览入口同步新版，原视频作为记录并明确与修正动画区别。"
    f"Cocos 成功退出码 {args.build_exit}、{milliseconds}ms，DPR 完成，Wrangler main 成功。"
    "仅素材制作、构建与发布，用户人工查看，未运行测试、浏览器、游戏或线上验证；"
    "原动作认可不等于本轮斗篷修正已验收。详情见 `docs/hero-idle-cape-fix-v3/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    heading, rest = path.read_text(encoding='utf-8-sig').split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n已发布：[完整斗篷预览]({release['preview']}) · [正式游戏]({release['game']})。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
