"""Retain the user-approved atlas pixels; repair only idle playback closure."""
import hashlib
import json
import shutil
import sys
import uuid
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from hero_idle_loop import idle_loop_timeline
sys.path.insert(0, str(GAME / 'docs/hero-stance-rebuild-v1'))
from package_frames import preview
sys.stdout.reconfigure(encoding='utf-8')


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


for hero in ['sniper', 'volt']:
    original = GAME / 'docs' / (hero + '-idle-lively-v1')
    target = GAME / 'docs' / (hero + '-idle-lively-loop-v2')
    resource = hero + '_idle_lively_loop_v2'
    assets = GAME / 'assets/resources/ux' / resource
    target.mkdir(parents=True, exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)
    for filename in ['idle.png', 'source.mp4', 'source-info.json', 'ready-red.png',
                     'ready-transparent.png', 'art.json', 'image-prompt.txt', 'idle-prompt.txt',
                     'video-task.json', 'contact-sheet.jpg']:
        shutil.copy2(original / filename, target / filename)
    manifest = json.loads((original / 'idle.frames.json').read_text(encoding='utf-8'))
    previous_seconds = manifest['animation']['seconds']
    count = len(manifest['frames'])
    order, durations, contract = idle_loop_timeline(count, previous_seconds * 2)
    manifest['animation'] = {'frames': ['idle' + str(i) for i in order], 'loop': True,
                             'seconds': sum(durations), 'frameDurations': durations,
                             'loopClosure': contract}
    manifest['sourceOrder'] = order
    manifest['processing']['temporal'] = 'All user-approved frames forward/backward with eased turns; adjacent-frame closure'
    manifest['motionAcceptedByUser'] = True
    manifest['animationAcceptedByUser'] = False
    loop_record = {'method': 'pingpong', 'range': [manifest['source']['indices'][0], manifest['source']['indices'][-1]],
                   'previousSinglePassSeconds': previous_seconds, 'loopSeconds': sum(durations),
                   'preservesAllApprovedFrames': True, 'contract': contract,
                   'sourceVideoNewlyGenerated': False,
                   'supersedes': '../' + original.name + '/loop-selection.json'}
    manifest['loopSelection'] = loop_record
    for folder in [target, assets]:
        write_json(folder / 'idle.frames.json', manifest)
    shutil.copy2(original / 'idle.png', assets / 'idle.png')
    for path, importer, version in [(assets, 'directory', '1.2.0'), (assets / 'idle.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path) + '.meta')
        if not meta.exists():
            write_json(meta, {'ver': version, 'importer': importer, 'imported': True,
                       'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                       'subMetas': {}, 'userData': {}})
    write_json(target / 'loop-selection.json', loop_record)
    atlas = Image.open(original / 'idle.png').convert('RGBA')
    cells = []
    for i in range(count):
        x, y, w, h = manifest['frames']['idle' + str(i)]
        cells.append(atlas.crop((x, y, x+w, y+h)))
    preview(target, hero, 'idle', cells, manifest)
    packaging = json.loads((original / 'packaging.json').read_text(encoding='utf-8'))
    packaging.update({'resource': resource, 'timelineFrames': len(order), 'seconds': sum(durations),
                      'loopStyle': 'pingpong', 'motionAcceptedByUser': True, 'userAccepted': False,
                      'sourceVideoNewlyGenerated': False, 'sourceVideoOrigin': original.name,
                      'gameIntegrated': False, 'loopClosure': contract,
                      'atlasPixelsRetained': True,
                      'atlasFileSha256': hashlib.sha256((original / 'idle.png').read_bytes()).hexdigest()})
    write_json(target / 'packaging.json', packaging)
    print(json.dumps({'hero': hero, 'uniqueFrames': count, 'timelineFrames': len(order),
                      'seconds': sum(durations), 'wrapFrames': contract['wrapFrames'],
                      'atlasPixelsRetained': True, 'resource': resource}), flush=True)
