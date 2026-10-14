"""Retain current character pixels and motion; remove long turn-frame holds."""
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


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


reports = {}
for hero, origin_name, target_name, resource in [
    ('sniper', 'sniper-idle-full-v6', 'sniper-idle-flow-v1', 'sniper_idle_flow_v1'),
    ('volt', 'volt-idle-lively-loop-v2', 'volt-idle-flow-v1', 'volt_idle_flow_v1'),
]:
    origin = GAME / 'docs' / origin_name
    folder = GAME / 'docs' / target_name
    destination = GAME / 'assets/resources/ux' / resource
    folder.mkdir(exist_ok=True)
    destination.mkdir(exist_ok=True)
    for path in origin.iterdir():
        if path.is_file() and path.name != 'release.json':
            shutil.copy2(path, folder / path.name)
    manifest = read_json(origin / 'idle.frames.json')
    animation = manifest['animation']
    original_durations = animation['frameDurations']
    order, durations, contract = idle_loop_timeline(len(manifest['frames']), animation['seconds'])
    # Existing forward/backward frame order, crop, scale and all pixels are retained.
    animation['frames'] = [f'idle{i}' for i in order]
    animation['frameDurations'] = durations
    animation['loopClosure'] = contract
    manifest['sourceOrder'] = order
    manifest['processing']['temporal'] = contract['strategy']
    manifest['animationAcceptedByUser'] = False
    timing = {
        'origin': '../' + origin_name,
        'sourceVideoNewlyGenerated': False,
        'allCurrentFramesRetained': True,
        'atlasPixelsRetained': True,
        'atlasFileSha256': hashlib.sha256((origin / 'idle.png').read_bytes()).hexdigest(),
        'previousMaximumFrameSeconds': max(original_durations),
        'maximumFrameSeconds': max(durations),
        'normalFrameSeconds': min(durations),
        'seconds': animation['seconds'],
        'loopClosure': contract,
        'review': 'Timing production only; user manual review; no tests, game, browser or online QA',
    }
    manifest['timingRevision'] = timing
    write_json(folder / 'idle.frames.json', manifest)
    write_json(destination / 'idle.frames.json', manifest)
    shutil.copy2(origin / 'idle.png', destination / 'idle.png')
    for path, importer, version in [(destination, 'directory', '1.2.0'),
                                     (destination / 'idle.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path) + '.meta')
        if not meta.exists():
            write_json(meta, {'ver': version, 'importer': importer, 'imported': True,
                'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                'subMetas': {}, 'userData': {}})
    selection = read_json(folder / 'loop-selection.json')
    selection.update({'contract': contract, 'timingRevision': timing,
                      'sourceVideoNewlyGenerated': False})
    write_json(folder / 'loop-selection.json', selection)
    packaging = read_json(folder / 'packaging.json')
    packaging.update({'resource': resource, 'gameIntegrated': True,
        'sourceVideoNewlyGenerated': False, 'mediaOrigin': origin_name,
        'allCurrentFramesRetained': True, 'atlasPixelsRetained': True,
        'atlasFileSha256': timing['atlasFileSha256'], 'loopClosure': contract,
        'timingRevision': timing, 'userAccepted': False, 'animationAcceptedByUser': False})
    write_json(folder / 'packaging.json', packaging)
    atlas = Image.open(origin / 'idle.png').convert('RGBA')
    cells = []
    for i in range(len(manifest['frames'])):
        x, y, width, height = manifest['frames'][f'idle{i}']
        cells.append(atlas.crop((x, y, x + width, y + height)))
    preview(folder, hero, 'idle', cells, manifest)
    write_json(folder / 'timing-revision.json', timing)
    reports[hero] = packaging
    print(json.dumps({'hero': hero, 'frames': len(cells), 'timelineFrames': len(order),
        'oldHoldSeconds': max(original_durations), 'longestFrameSeconds': max(durations),
        'resource': resource}, ensure_ascii=False), flush=True)
write_json(ROOT / 'production.json', reports)
