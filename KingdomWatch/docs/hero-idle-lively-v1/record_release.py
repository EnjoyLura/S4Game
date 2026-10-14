import argparse
import json
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
args = parser.parse_args()
release = read_json(ROOT / 'deployment-stage.json')
release.update({
    'status': 'published',
    'deployment': args.deployment,
    'date': datetime.now(timezone(timedelta(hours=8), name='Asia/Shanghai')).isoformat(timespec='seconds'),
    'timezone': 'Asia/Shanghai',
    'animationAcceptedByUser': False,
    'characters': [],
    'build': {
        'creator': '3.8.8', 'platform': 'web-mobile', 'exitCode': 36,
        'milliseconds': 10330, 'finishedLocal': '2026-10-14 00:34:13',
        'log': 'C:/Users/user/AppData/Local/Temp/kw-hero-idle-lively-v1-20261014-out.log',
    },
    'dprPatch': 'completed',
    'publication': {
        'tool': 'Wrangler3.114.17', 'exitCode': 0,
        'uploaded': args.uploaded, 'cached': args.cached, 'uploadSeconds': args.upload_seconds,
    },
    'retained': 'Approved static masters, weapon grips, display sizes, foot anchors, archer media, sniper attack and combat timing',
    'review': 'Source annotation and production only; user manual effect review; no tests, browser, game or online QA',
})
for hero in ['sniper', 'volt']:
    folder = GAME / 'docs' / (hero + '-idle-lively-v1')
    packaging = read_json(folder / 'packaging.json')
    task = read_json(folder / 'video-task.json')
    manifest = read_json(folder / 'idle.frames.json')
    packaging['gameIntegrated'] = True
    write_json(folder / 'packaging.json', packaging)
    record = {**packaging, 'videoTask': task, 'loopSelection': read_json(folder / 'loop-selection.json'),
              'groundAnchor': [256, 496], 'newVideoSubmitted': True,
              'readyHeightPx': manifest['readyHeightPx'], 'published': True,
              'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}
    write_json(folder / 'release.json', record)
    release['characters'].append(record)
write_json(ROOT / 'release.json', release)

paragraph = (
    f"2026-10-14 [两位英雄重新生成待机视频](docs/hero-idle-lively-v1/README.md) 已接入并构建发布："
    f"[正式游戏]({release['game']}) · [新视频与序列帧预览]({release['preview']})，部署 `{args.deployment}`。"
    "用户明确反馈上一轮仍不够灵动，本次沿用已确认站姿图，重新提交两段 MiniMax H3 两秒视频，"
    "任务为 `task_EitBsCykZfpPwn5aCiyusS6EkSgRdIHX`／`task_nFeFWhnNV3ek4aQABCiGLEQ9PWUxtuZX`，"
    "各返回 56 张完整源帧。重弩手选新源帧 4–53 共 50 张，雷法师选 2–44 共 43 张，"
    "连续循环 3.076923 秒，新正式资源 `sniper_idle_lively_v1`／`volt_idle_lively_v1`；"
    "运动重点为整片披风、袍摆和衣物褶皱，限制身体与武器大幅运动，提示词不等于效果验收。"
    "保留固定画内比例、脚底和显示高度 153／146，弓箭手素材与高度 185.64、重弩攻击保持。"
    "旧 `hero-idle-subtle-v2`／`hero-stance-rebuild-v1` 预览入口同步本版，预览提供本次新原视频。"
    "Cocos 成功退出码 36、10330ms，DPR 完成，Wrangler main 成功。"
    "仅制作、接入、构建与发布，用户人工查看，不运行测试、游戏、浏览器或线上验收；"
    "已确认静态图片，不记录新动画已获认可。详情见 `docs/hero-idle-lively-v1/release.json`。"
)
for name in ['AGENTS.md', 'README.md']:
    path = GAME / name
    content = path.read_text(encoding='utf-8-sig')
    heading, rest = content.split('\n', 1)
    path.write_text(heading + '\n\n' + paragraph + '\n' + rest, encoding='utf-8')
with (ROOT / 'README.md').open('a', encoding='utf-8') as stream:
    stream.write(f"\n已发布：[新预览]({release['preview']}) · [正式游戏]({release['game']})。部署 `{args.deployment}`。\n")
print(json.dumps({'game': release['game'], 'preview': release['preview'], 'deployment': args.deployment}, ensure_ascii=False))
