"""Deliver only a new sniper idle while copying the accepted mage media intact."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--source-folder', default='sniper-idle-natural-v2')
args = parser.parse_args()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


folder = GAME / 'docs' / args.source_folder
manifest = read_json(folder / 'idle.frames.json')
packaging = read_json(folder / 'packaging.json')
packaging.update({'folder': args.source_folder, 'gameIntegrated': True,
    'sourceVideoNewlyGenerated': True, 'reversePlayback': False,
    'nativeSourceCycleRequired': True, 'loopClosure': manifest['animation']['loopClosure'],
    'animationAcceptedByUser': False, 'motionAcceptedByUser': False})
write_json(folder / 'packaging.json', packaging)
task = read_json(folder / 'video-task.json')
write_json(folder / 'source-cycle.json', {
    'method': 'New complete forward source cycle requested from the unchanged approved master',
    'sourceVideoTask': task['taskId'], 'actualPrompt': 'idle-prompt-effective.txt',
    'allSourceFramesRetained': packaging['allSourceFramesRetained'],
    'reversePlayback': False, 'noArtificialHold': True,
    'note': 'User reported previous sniper closure defective; new source retained whole; user manual effect review',
    'userAccepted': False})
mage = read_json(GAME / 'docs/volt-idle-natural-v1/packaging.json')
mage.update({'folder': 'volt-idle-natural-v1', 'sourceVideoNewlyGenerated': False,
             'approvedMediaRetained': True, 'runtimeResourceUnchanged': True})
write_json(ROOT / 'production.json', {'sniper': packaging, 'volt': mage})

previous = GAME / 'docs/hero-idle-natural-v1'
builder = (previous / 'build_preview.cjs').read_text(encoding='utf-8')
builder = builder.replace("const sources=[['sniper','sniper-idle-natural-v1']", f"const sources=[['sniper','{args.source_folder}']")
builder = builder.replace("for(const name of ['hero-idle-natural-v1'", "for(const name of ['sniper-idle-loop-close-v1','hero-idle-natural-v1'")
builder = builder.replace('重弩手与雷法师 · 正向自然待机', '重弩手 · 正向循环衔接')
builder = builder.replace('沿用确认的站姿，重新生成完整待机视频。披风与袍摆按原始时间顺序运动，两位英雄均取消倒放。',
    '单独重新生成重弩手的完整待机周期，保持正向播放。雷法师保留你已确认顺滑的当前版本。')
builder = builder.replace('以下为本次重新生成的两段原始视频。上方序列帧与 GIF 保留全段动作，按时间顺序正向播放。',
    '左侧为本次新生成的重弩手原视频，右侧为已确认的雷法师原视频。序列帧与 GIF 均保留完整原帧，正向播放。')
(ROOT / 'build_preview.cjs').write_text(builder, encoding='utf-8')
publisher = (previous / 'publish.ps1').read_text(encoding='utf-8')
publisher = publisher.replace('IdleNatural', 'SniperLoopClose').replace('hero-idle-natural-v1', 'sniper-idle-loop-close-v1')
publisher = publisher.replace('publish-hero-idle-flow-v1-20261014-013408', 'publish-hero-idle-natural-v1-20261014-014839')
(ROOT / 'publish.ps1').write_text(publisher, encoding='utf-8')
player = GAME / 'assets/scripts/battle/SniperIdleAnimation.ts'
player.write_text(player.read_text(encoding='utf-8').replace("'sniper_idle_natural_v1'", repr(packaging['resource'])), encoding='utf-8')
print(json.dumps({'sniperResource': packaging['resource'], 'sniperFrames': packaging['uniqueFrames'],
    'voltResource': mage['resource'], 'voltMediaChanged': False}, ensure_ascii=False))
