"""Pack the previously prepared 30-frame king loop into an independent runtime atlas."""
from pathlib import Path
import copy
import hashlib
import json
import uuid
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT / 'docs/video-sequence-20261018'
OUT = ROOT / 'assets/resources/ux'
ID = 'goblin_king_walk_v1'
W, H = 256, 288
atlas = Image.new('RGBA', (W * 6, H * 5))
rects, feet, hashes = {}, [], {}
preview = Image.new('RGB', (6 * 192, 5 * 234), '#e6dece')
draw = ImageDraw.Draw(preview)
for k in range(30):
    path = SOURCE / 'loop-30-frames' / f'goblin_king_w{k:03d}.png'
    hashes[path.relative_to(ROOT).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    original = Image.open(path).convert('RGBA')
    im = original.resize((W, H), Image.Resampling.LANCZOS)
    x, y = k % 6 * W, k // 6 * H
    atlas.alpha_composite(im, (x, y))
    rects[f'goblin_king_w{k}'] = [x, y, W, H]
    alpha = np.asarray(original.getchannel('A'))
    fh, fw = alpha.shape
    pair = []
    # Restrict to the two boots, excluding the lowered axe on the far left.
    for lo, hi in [(int(fw * .30), int(fw * .53)), (int(fw * .53), int(fw * .79))]:
        ys, xs = np.where(alpha[int(fh * .76):, lo:hi] > 180)
        bottom = int(ys.max())
        contact_x = float(np.median(xs[ys >= bottom - 3])) + lo
        contact_y = bottom + int(fh * .76)
        pair.extend([(contact_x - fw / 2) / fh, (fh - 1 - contact_y) / fh])
    feet.append(pair)
    thumb = im.resize((192, 216), Image.Resampling.LANCZOS)
    px, py = k % 6 * 192, k // 6 * 234
    preview.paste(thumb, (px, py), thumb)
    draw.text((px + 6, py + 217), f'goblin_king_w{k}', fill='#222222')

atlas.save(OUT / (ID + '.png'))
manifest = {'frames': rects, 'cycles': {'goblin_king': 1.25}, 'walkSpeeds': {'goblin_king': 17.5},
            'ground': {'goblin_king': {'offset': 16 / 576, 'feet': feet}}}
(OUT / (ID + '.frames.json')).write_text(json.dumps(manifest, indent=2), encoding='utf-8')
preview.save(HERE / 'runtime-contact-sheet.jpg', quality=94)

# Dedicated UUIDs; disable trimming/packing of the atlas source, retaining exact rectangles.
meta = json.loads((OUT / 'battle_mob_anim_v1.png.meta').read_text(encoding='utf-8-sig'))
image_uuid = str(uuid.uuid4())
meta['uuid'] = image_uuid
texture = meta['subMetas']['6c48a']
texture['uuid'] = image_uuid + '@6c48a'
texture['displayName'] = ID
texture['userData']['imageUuidOrDatabaseUri'] = image_uuid
sf = meta['subMetas']['f9941']
sf['uuid'] = image_uuid + '@f9941'
sf['displayName'] = ID
sf['userData'] = {'trimThreshold': 1, 'rotated': False, 'offsetX': 0, 'offsetY': 0,
    'trimX': 0, 'trimY': 0, 'width': atlas.width, 'height': atlas.height,
    'rawWidth': atlas.width, 'rawHeight': atlas.height,
    'borderTop': 0, 'borderBottom': 0, 'borderLeft': 0, 'borderRight': 0,
    'packable': False, 'pixelsToUnit': 100, 'pivotX': .5, 'pivotY': .5, 'meshType': 0,
    'isUuid': True, 'imageUuidOrDatabaseUri': image_uuid + '@6c48a', 'atlasUuid': '', 'trimType': 'none'}
meta['userData']['redirect'] = image_uuid + '@6c48a'
(OUT / (ID + '.png.meta')).write_text(json.dumps(meta, indent=2), encoding='utf-8')
jm = copy.deepcopy(json.loads((OUT / 'battle_mob_anim_v1.frames.json.meta').read_text(encoding='utf-8-sig')))
jm['uuid'] = str(uuid.uuid4())
(OUT / (ID + '.frames.json.meta')).write_text(json.dumps(jm, indent=2), encoding='utf-8')
record = {'atlas': ID, 'size': list(atlas.size), 'frameCount': 30, 'cellSize': [W, H],
          'loopSeconds': 1.25, 'sourceFrameSize': [512, 576], 'sourceHashes': hashes,
          'resourcePaths': [str((OUT / (ID + ext)).relative_to(ROOT)) for ext in ['.png', '.frames.json']],
          'pngSha256': hashlib.sha256((OUT / (ID + '.png')).read_bytes()).hexdigest()}
(HERE / 'art-record.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
print('Packed 30 frames at 256x288 into 1536x1440; source PNGs preserved.')
