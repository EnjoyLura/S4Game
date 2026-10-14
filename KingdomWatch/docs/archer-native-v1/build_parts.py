"""Slice generated puppet components, preserve RGBA, pack one shared Cocos texture."""
from pathlib import Path
import hashlib
import json
import uuid
from collections import deque
from PIL import Image, ImageDraw, ImageFont
import numpy as np

def component_boxes(alpha):
    work = np.asarray(alpha).copy() >= 32
    height, width = work.shape
    boxes = []
    for sy, sx in zip(*np.nonzero(work)):
        if not work[sy, sx]:
            continue
        queue = deque([(int(sx), int(sy))])
        work[sy, sx] = False
        x0 = x1 = int(sx)
        y0 = y1 = int(sy)
        pixels = 0
        while queue:
            x, y = queue.popleft()
            pixels += 1
            x0, x1 = min(x0, x), max(x1, x)
            y0, y1 = min(y0, y), max(y1, y)
            for nx, ny in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
                if 0 <= nx < width and 0 <= ny < height and work[ny, nx]:
                    work[ny, nx] = False
                    queue.append((nx, ny))
        if pixels >= 400:
            boxes.append((x0, y0, x1 + 1, y1 + 1))
    return boxes

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
OUT = GAME / 'assets/resources/ux/archer_native_v1'
OUT.mkdir(exist_ok=True)
PARTS = ROOT / 'parts'
PARTS.mkdir(exist_ok=True)
names = ['up_legs', 'up_torso', 'up_head', 'up_cape',
         'left_upper_arm', 'left_forearm', 'left_hand', 'right_upper_arm',
         'right_forearm', 'right_hand', 'bow', 'quiver']
turn_names = [f'{direction}_{part}' for direction in ['left', 'right']
              for part in ['legs', 'torso', 'head', 'cape']]
images = {}
diagnostics = []
sources = [('archer-parts-up.png', 4, 3, names), ('archer-body-turns.png', 4, 2, turn_names)]
if (ROOT / 'sources/archer-torso-cores.png').exists():
    sources.append(('archer-torso-cores.png', 3, 1, ['up_torso', 'left_torso', 'right_torso']))
for filename, columns, rows, sequence in sources:
    sheet = Image.open(ROOT / 'sources' / filename).convert('RGBA')
    components = {}
    for x0, y0, x1, y1 in component_boxes(sheet.getchannel('A')):
        col = min(columns - 1, int((x0 + x1) / 2 / sheet.width * columns))
        row = min(rows - 1, int((y0 + y1) / 2 / sheet.height * rows))
        index = row * columns + col
        assert index not in components, (filename, index, 'multiple large components')
        components[index] = (max(0, x0 - 4), max(0, y0 - 4),
                             min(sheet.width, x1 + 4), min(sheet.height, y1 + 4))
    assert len(components) == len(sequence), (filename, len(components))
    for index, name in enumerate(sequence):
        # Generated pieces may extend beyond nominal grid cells. Measure each isolated
        # component's complete rectangle instead of cutting limbs at grid boundaries.
        # Detection is used only to find crop bounds; all source RGBA pixels survive.
        bounds = components[index]
        cell = sheet.crop(bounds)
        alpha = cell.getchannel('A')
        box = alpha.point(lambda value: 255 if value >= 12 else 0).getbbox()
        assert box is not None, name
        box = (max(0, box[0] - 3), max(0, box[1] - 3),
               min(cell.width, box[2] + 3), min(cell.height, box[3] + 3))
        part = cell.crop(box)
        k = min(1, 238 / max(part.size))
        part = part.resize((round(part.width * k), round(part.height * k)), Image.Resampling.LANCZOS)
        # Add transparent edge without changing generated character pixels or alpha.
        padded = Image.new('RGBA', (part.width + 6, part.height + 6))
        padded.alpha_composite(part, (3, 3))
        padded.save(PARTS / (name + '.png'))
        images[name] = padded
        diagnostics.append({'name': name, 'source': filename, 'cell': bounds,
                            'crop': box, 'scale': k, 'size': padded.size})

atlas = Image.new('RGBA', (1280, 1024))
frames = {}
for index, (name, part) in enumerate(images.items()):
    x, y = index % 5 * 256 + 6, index // 5 * 256 + 6
    assert part.width <= 244 and part.height <= 244
    atlas.alpha_composite(part, (x, y))
    frames[name] = [x, y, part.width, part.height]
atlas.save(OUT / 'parts.png', optimize=True)
manifest = {'version': 1, 'atlas': 'parts.png', 'width': atlas.width, 'height': atlas.height,
            'frames': frames, 'directions': ['up', 'left', 'right'], 'groundAnchor': [0, 0],
            'displayHeight': 146, 'source': 'approved archer, imagegen puppet component artwork',
            'animations': 'Cocos native node transforms and an analytic two-joint arm solver; no Spine'}
(OUT / 'parts.frames.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def meta_id(path):
    return json.loads(path.read_text())['uuid'] if path.exists() else str(uuid.uuid4())

folder_meta = OUT.with_suffix('.meta')
folder_meta.write_text(json.dumps({'ver': '1.2.0', 'importer': 'directory', 'imported': True,
    'uuid': meta_id(folder_meta), 'files': [], 'subMetas': {}, 'userData': {}}, indent=2) + '\n')
texture_meta_path = OUT / 'parts.png.meta'
texture_meta = json.loads((GAME / 'assets/resources/ux/battle_heroes_v2.png.meta').read_text())
texture_id = meta_id(texture_meta_path)
old_id = texture_meta['uuid']
serialized = json.dumps(texture_meta).replace(old_id, texture_id).replace('battle_heroes_v2', 'parts')
texture_meta = json.loads(serialized)
sprite = texture_meta['subMetas']['f9941']['userData']
sprite.update({'width': atlas.width, 'height': atlas.height, 'rawWidth': atlas.width,
               'rawHeight': atlas.height, 'offsetX': 0, 'offsetY': 0, 'trimX': 0, 'trimY': 0, 'packable': False})
sprite['vertices'] = {'rawPosition': [-640, -512, 0, 640, -512, 0, -640, 512, 0, 640, 512, 0],
                      'indexes': [0, 1, 2, 2, 1, 3], 'uv': [0, 1, 1, 1, 0, 0, 1, 0],
                      'nuv': [0, 0, 1, 0, 0, 1, 1, 1], 'minPos': [-640, -512, 0], 'maxPos': [640, 512, 0]}
texture_meta_path.write_text(json.dumps(texture_meta, indent=2) + '\n')
manifest_meta_path = OUT / 'parts.frames.json.meta'
manifest_meta = {'ver': '2.0.1', 'importer': 'json', 'imported': True,
                 'uuid': meta_id(manifest_meta_path), 'files': ['.json'], 'subMetas': {}, 'userData': {}}
manifest_meta_path.write_text(json.dumps(manifest_meta, indent=2) + '\n')

contact = Image.new('RGB', (1000, 870), '#ede5d6')
draw = ImageDraw.Draw(contact)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 17)
for index, (name, part) in enumerate(images.items()):
    x, y = index % 5 * 200, index // 5 * 216
    draw.rounded_rectangle((x + 5, y + 5, x + 195, y + 209), 8, fill='#d2d9cd')
    k = min(170 / part.width, 170 / part.height)
    thumb = part.resize((round(part.width * k), round(part.height * k)), Image.Resampling.LANCZOS)
    contact.paste(thumb, (x + (200 - thumb.width) // 2, y + 7), thumb)
    draw.text((x + 100, y + 182), name, font=font, fill='#2b3931', anchor='mt')
contact.save(ROOT / 'parts-contact.jpg', quality=94)
report = {'ok': True, 'rgba': True, 'componentCount': len(images), 'atlasSize': atlas.size,
          'atlasBytes': (OUT / 'parts.png').stat().st_size,
          'atlasSHA256': hashlib.sha256((OUT / 'parts.png').read_bytes()).hexdigest(), 'components': diagnostics}
(ROOT / 'asset-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['ok', 'componentCount', 'atlasSize', 'atlasBytes']}, ensure_ascii=False))
