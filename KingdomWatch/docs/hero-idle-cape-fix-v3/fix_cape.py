"""Remove clipped source motion without changing the retained character pixels."""
import copy
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
from hero_frame_bounds import source_frame_margin, require_source_margin
sys.path.insert(0, str(GAME / 'docs/hero-stance-rebuild-v1'))
from package_frames import decode, key_red, preview
sys.stdout.reconfigure(encoding='utf-8')


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


original = GAME / 'docs/sniper-idle-lively-loop-v2'
target = GAME / 'docs/sniper-idle-cape-safe-v3'
resource = 'sniper_idle_cape_safe_v3'
assets = GAME / 'assets/resources/ux' / resource
target.mkdir(parents=True, exist_ok=True)
assets.mkdir(parents=True, exist_ok=True)
for filename in ['source.mp4', 'source-info.json', 'ready-red.png', 'ready-transparent.png',
                 'art.json', 'image-prompt.txt', 'idle-prompt.txt', 'video-task.json']:
    shutil.copy2(original / filename, target / filename)
prior = json.loads((original / 'idle.frames.json').read_text(encoding='utf-8'))
manifest = copy.deepcopy(prior)
info, originals = decode(original)
source_indices = prior['source']['indices']
source_records = []
keyed_sources = {}
for index in source_indices:
    keyed, _ = key_red(originals[index])
    keyed_sources[index] = keyed
    source_records.append({'sourceFrame': index, **source_frame_margin(keyed)})
runs, current = [], []
for record in source_records:
    if record['completeWithinSource']:
        current.append(record['sourceFrame'])
    else:
        if current:
            runs.append(current)
        current = []
if current:
    runs.append(current)
selected = max(runs, key=len)
if len(selected) < 2:
    raise RuntimeError('No intact continuous motion range; preserve source for a new generation')
require_source_margin([keyed_sources[index] for index in selected], selected)
atlas_before = Image.open(original / 'idle.png').convert('RGBA')
width, height = prior['cellSize']
columns = 8
atlas = Image.new('RGBA', (columns * width, ((len(selected)+columns-1)//columns)*height))
cells, rects, old_positions = [], {}, []
(target / 'frames').mkdir(exist_ok=True)
for index, source_index in enumerate(selected):
    old_index = source_indices.index(source_index)
    old_positions.append(old_index)
    x, y, w, h = prior['frames']['idle' + str(old_index)]
    cell = atlas_before.crop((x, y, x+w, y+h))
    cells.append(cell)
    cell.save(target / 'frames' / ('idle-' + f'{index:02d}' + '.png'))
    px, py = index % columns * width, index // columns * height
    atlas.paste(cell, (px, py))
    rects['idle' + str(index)] = [px, py, width, height]
seconds = prior['animation']['seconds'] * (len(selected)-1)/(len(source_indices)-1)
order, durations, contract = idle_loop_timeline(len(selected), seconds)
manifest['frames'] = rects
manifest['animation'] = {'frames': ['idle'+str(index) for index in order], 'loop': True,
                         'seconds': seconds, 'frameDurations': durations, 'loopClosure': contract}
manifest['sourceOrder'] = order
manifest['source']['indices'] = selected
manifest['source']['redFieldPerFrame'] = [prior['source']['redFieldPerFrame'][index] for index in old_positions]
manifest['source']['excludedSourceFrames'] = [index for index in source_indices if index not in selected]
manifest['source']['packagingOrigin'] = '../' + original.name + '/idle.frames.json'
manifest['processing']['spatial'] = 'Exact retained cells from the prior atlas; same fixed source crop, scale and foot anchor; no resize or deformation'
manifest['sourceFraming'] = [record for record in source_records if record['sourceFrame'] in selected]
record = {'cause': 'The original video clips the cape at its right edge during later frames',
          'requiredSourceMarginPixels': 12, 'selectedContinuousSourceRange': [selected[0], selected[-1]],
          'selectedSourceIndices': selected, 'allPriorSourceMargins': source_records,
          'retainedCellPixelsUnmodified': True, 'newVideoSubmitted': False,
          'loopClosure': contract, 'loopSeconds': seconds,
          'timing': 'Cycle length scaled to retained frame transitions to preserve average motion cadence',
          'review': 'Source range production only; effect review by user'}
manifest['loopSelection'] = {'method': 'pingpong', 'range': [selected[0], selected[-1]],
                             'reason': 'Longest intact continuous range from the user-approved motion',
                             'loopSeconds': seconds, 'contract': contract, 'sourceVideoNewlyGenerated': False}
for folder in [target, assets]:
    atlas.save(folder / 'idle.png', optimize=True)
    write_json(folder / 'idle.frames.json', manifest)
write_json(target / 'cape-framing.json', record)
write_json(target / 'loop-selection.json', manifest['loopSelection'])
for path, importer, version in [(assets, 'directory', '1.2.0'), (assets / 'idle.frames.json', 'json', '2.0.1')]:
    meta = Path(str(path)+'.meta')
    if not meta.exists():
        write_json(meta, {'ver': version, 'importer': importer, 'imported': True,
                   'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                   'subMetas': {}, 'userData': {}})
preview(target, 'sniper', 'idle', cells, manifest)
packaging = json.loads((original / 'packaging.json').read_text(encoding='utf-8'))
packaging.update({'resource': resource, 'uniqueFrames': len(cells), 'timelineFrames': len(order),
                  'sourceIndices': selected, 'seconds': seconds, 'atlas': list(atlas.size),
                  'atlasBytes': (assets / 'idle.png').stat().st_size,
                  'sourceVideoNewlyGenerated': False, 'retainedCellPixelsUnmodified': True,
                  'atlasPixelsRetained': False, 'gameIntegrated': False, 'userAccepted': False,
                  'capeFixAcceptedByUser': False, 'loopClosure': contract,
                  'sourceVideoOrigin': 'sniper-idle-lively-v1',
                  'atlasFileSha256': hashlib.sha256((assets / 'idle.png').read_bytes()).hexdigest(),
                  'sourceFraming': record})
write_json(target / 'packaging.json', packaging)
print(json.dumps({'hero': 'sniper', 'resource': resource, 'selectedSources': [selected[0], selected[-1]],
                  'uniqueFrames': len(cells), 'timelineFrames': len(order), 'seconds': seconds,
                  'retainedCellPixelsUnmodified': True, 'atlas': list(atlas.size)}), flush=True)
