"""Record new source provenance and prepare the normal build/publication delivery."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--sniper-folder', default='sniper-idle-natural-v1')
parser.add_argument('--volt-folder', default='volt-idle-natural-v1')
args = parser.parse_args()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


production = {}
for hero, name in [('sniper', args.sniper_folder), ('volt', args.volt_folder)]:
    folder = GAME / 'docs' / name
    packaging = json.loads((folder / 'packaging.json').read_text(encoding='utf-8-sig'))
    manifest = json.loads((folder / 'idle.frames.json').read_text(encoding='utf-8-sig'))
    task = json.loads((folder / 'video-task.json').read_text(encoding='utf-8-sig'))
    packaging.update({'folder': name, 'gameIntegrated': True, 'sourceVideoNewlyGenerated': True,
                      'reversePlayback': False, 'nativeSourceCycleRequired': True,
                      'loopClosure': manifest['animation']['loopClosure'],
                      'animationAcceptedByUser': False, 'motionAcceptedByUser': False})
    write_json(folder / 'packaging.json', packaging)
    write_json(folder / 'first-frame-host.json', {
        'project': 'kw-vfx-src', 'branch': 'main',
        'deployment': 'https://3b188c7d.kw-vfx-src.pages.dev', 'imageUrl': task['imageUrl'],
        'uploaded': 1, 'cached': 31, 'uploadSeconds': 2.25, 'exitCode': 0})
    write_json(folder / 'source-cycle.json', {
        'method': 'New forward-time source cycle requested from the approved static master',
        'sourceVideoTask': task['taskId'], 'actualPrompt': 'idle-prompt-effective.txt',
        'allSourceFramesRetained': packaging['allSourceFramesRetained'],
        'reversePlayback': False, 'noArtificialHold': True,
        'note': 'Prompt and packaging do not certify visual closure; user reviews the actual new video and ordered frames',
        'userAccepted': False})
    production[hero] = packaging
write_json(ROOT / 'production.json', production)

previous = GAME / 'docs/hero-idle-flow-v1'
builder = (previous / 'build_preview.cjs').read_text(encoding='utf-8')
builder = builder.replace('hero-idle-flow-v1', 'hero-idle-natural-v1')
builder = builder.replace("['hero-idle-natural-v1','hero-idle-full-v4'", "['hero-idle-natural-v1','hero-idle-flow-v1','hero-idle-full-v4'")
builder = builder.replace('sniper-idle-flow-v1', args.sniper_folder).replace('volt-idle-flow-v1', args.volt_folder)
builder = builder.replace('重弩手与雷法师 · 连贯待机', '重弩手与雷法师 · 正向自然待机')
builder = builder.replace('保留当前完整动作，取消转折处的长停留，让披风与袍摆持续连贯运动，首尾平滑衔接。',
                          '沿用确认的站姿，重新生成完整待机视频。披风与袍摆按原始时间顺序运动，两位英雄均取消倒放。')
builder = builder.replace('以下沿用当前原始视频。本次调整后的待机节奏可看上方动画和 GIF。',
                          '以下为本次重新生成的两段原始视频。上方序列帧与 GIF 保留全段动作，按时间顺序正向播放。')
builder = builder.replace("'timing-revision.json'", "'source-cycle.json'")
builder = builder.replace("if(hero==='sniper')for", 'for')
builder = builder.replace(" .replace('href=\"sniper/idle-prompt.txt\"','href=\"sniper/idle-prompt-effective.txt\"');",
                          " .replace('href=\"sniper/idle-prompt.txt\"','href=\"sniper/idle-prompt-effective.txt\"')\n .replace('href=\"volt/idle-prompt.txt\"','href=\"volt/idle-prompt-effective.txt\"');")
(ROOT / 'build_preview.cjs').write_text(builder, encoding='utf-8')
publisher = (previous / 'publish.ps1').read_text(encoding='utf-8')
publisher = publisher.replace('IdleFlow', 'IdleNatural').replace('hero-idle-flow-v1', 'hero-idle-natural-v1')
publisher = publisher.replace('publish-hero-idle-full-v4-20261014-012234', 'publish-hero-idle-flow-v1-20261014-013408')
(ROOT / 'publish.ps1').write_text(publisher, encoding='utf-8')

for hero, filename in [('sniper', 'SniperIdleAnimation.ts'), ('volt', 'VoltIdleAnimation.ts')]:
    path = GAME / 'assets/scripts/battle' / filename
    source = path.read_text(encoding='utf-8')
    source = source.replace(f'{hero}_idle_flow_v1', production[hero]['resource'])
    path.write_text(source, encoding='utf-8')
print(json.dumps({hero: {'folder': value['folder'], 'resource': value['resource'],
    'uniqueFrames': value['uniqueFrames'], 'timelineFrames': value['timelineFrames'],
    'reversePlayback': value['reversePlayback']} for hero, value in production.items()}, ensure_ascii=False))
