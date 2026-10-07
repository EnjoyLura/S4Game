"""Pack AI animation cels with one shared scale and native RGBA edges.
Eight 256px animation tiles + nine 128px components fit a 1024x768 atlas.
Usage: python tools/pack-fire-vfx-v2.py sequence.png components.png
"""
import hashlib
import json
import sys
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = ['core', 'fireball', 'streak', 'ember', 'smoke_a', 'smoke_b', 'scorch', 'dust', 'chip']


def rgba(path):
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A')
    if a.getextrema()[0] != 0 or a.histogram()[0] < im.width * im.height * .25:
        raise ValueError('Native transparent alpha is required: ' + str(path))
    return im


def bleed_rgb(tile):
    """Extrude edge RGB four texels without changing a single alpha value.
    Straight-alpha bilinear sampling otherwise pulls black into painted rims.
    """
    data = np.array(tile)
    known = data[:, :, 3] > 0
    empty = data[:, :, 3] == 0
    for _ in range(4):
        total = np.zeros(data.shape[:2] + (3,), np.uint16)
        count = np.zeros(data.shape[:2], np.uint16)
        for axis, amount in [(0, -1), (0, 1), (1, -1), (1, 1)]:
            support = np.roll(known, amount, axis)
            total += np.roll(data[:, :, :3], amount, axis).astype(np.uint16) * support[:, :, None]
            count += support
        fill = empty & ~known & (count > 0)
        data[fill, :3] = (total[fill] / count[fill, None]).round().astype(np.uint8)
        known |= fill
    return Image.fromarray(data)


def islands(im, cols, rows):
    a = np.asarray(im.getchannel('A')).reshape(-1)
    w, h = im.size
    labels = np.full(len(a), -1, np.int32)
    regions = []
    for seed in np.flatnonzero(a >= 64):
        if labels[seed] >= 0:
            continue
        ident = len(regions); labels[seed] = ident; queue = deque([int(seed)])
        x0, y0, x1, y1, total, sx, sy = w, h, 0, 0, 0, 0, 0
        while queue:
            p = queue.popleft(); x, y = p % w, p // w
            x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
            total += 1; sx += x; sy += y
            for n in [p - 1 if x else -1, p + 1 if x + 1 < w else -1, p - w if y else -1, p + w if y + 1 < h else -1]:
                if n >= 0 and labels[n] < 0 and a[n] >= 64:
                    labels[n] = ident; queue.append(n)
        regions.append({'id': ident, 'area': total, 'bounds': (x0, y0, x1 + 1, y1 + 1),
                        'slot': min(cols - 1, int(sx / total / w * cols)) + cols * min(rows - 1, int(sy / total / h * rows))})
    labels = labels.reshape(h, w)
    return labels, regions


def component_crops(im):
    labels, regions = islands(im, 3, 3)
    w, h = im.size
    crops = []
    for slot, name in enumerate(COMPONENTS):
        region = max((r for r in regions if r['slot'] == slot), key=lambda r: r['area'])
        x0, y0, x1, y1 = region['bounds']
        box = max(0, x0 - 12), max(0, y0 - 12), min(w, x1 + 12), min(h, y1 + 12)
        crop = im.crop(box)
        mask = Image.fromarray(np.uint8(labels[box[1]:box[3], box[0]:box[2]] == region['id']) * 255)
        for _ in range(10): mask = mask.filter(ImageFilter.MaxFilter(3))
        data = np.array(crop); data[np.asarray(mask) == 0, 3] = 0
        crops.append({'name': name, 'image': Image.fromarray(data), 'pivot': (crop.width / 2, crop.height / 2)})
    return crops


def sequence_crops(im):
    crops = []
    labels, regions = islands(im, 4, 2)
    for i in range(8):
        col, row = i % 4, i // 4
        crop = im.crop((round(col * im.width / 4), round(row * im.height / 2),
                        round((col + 1) * im.width / 4), round((row + 1) * im.height / 2)))
        data = np.asarray(crop).astype(float)
        yy, xx = np.indices(data.shape[:2])
        if i < 4:
            # The impact point is the ivory ignition core, not the moving lobe centroid.
            weights = data[:, :, 3] * np.maximum(0, data[:, :, 1] - 205) * (data[:, :, 0] > 225)
            weights[(xx < crop.width * .25) | (xx > crop.width * .75) | (yy < crop.height * .35)] = 0
            pivot = ((xx * weights).sum() / weights.sum(), (yy * weights).sum() / weights.sum())
        else:
            # Later cels open at the same ignition point. Locate that central
            # negative space with a position penalty; do not center moving wisps.
            blurred = np.asarray(crop.getchannel('A').filter(ImageFilter.BoxBlur(12))).astype(float)
            cost = blurred + 2500 * ((xx / crop.width - .5) ** 2 + (yy / crop.height - .65) ** 2)
            cost[(xx < crop.width * .35) | (xx > crop.width * .65) | (yy < crop.height * .50) | (yy > crop.height * .77)] = 1e6
            y, x = np.unravel_index(cost.argmin(), cost.shape); pivot = (float(x), float(y))
        # The AI's layout is approximate. Global island ownership removes a
        # neighbour's contour even if it crosses a nominal cell boundary, while
        # retaining all four separated wisps of a late animation frame.
        owned = [r for r in regions if r['slot'] == i and r['area'] >= 24]
        box = (max(0, min(r['bounds'][0] for r in owned) - 12), max(0, min(r['bounds'][1] for r in owned) - 12),
               min(im.width, max(r['bounds'][2] for r in owned) + 12), min(im.height, max(r['bounds'][3] for r in owned) + 12))
        mask = Image.fromarray(np.uint8(np.isin(labels[box[1]:box[3], box[0]:box[2]], [r['id'] for r in owned])) * 255)
        for _ in range(10): mask = mask.filter(ImageFilter.MaxFilter(3))
        pixels = np.array(im.crop(box)); pixels[np.asarray(mask) == 0, 3] = 0
        crop = Image.fromarray(pixels)
        pivot = (round(col * im.width / 4) + pivot[0] - box[0], round(row * im.height / 2) + pivot[1] - box[1])
        bbox = crop.getchannel('A').point(lambda a: 255 if a >= 4 else 0).getbbox()
        extent = max(pivot[0] - bbox[0], pivot[1] - bbox[1], bbox[2] - pivot[0], bbox[3] - pivot[1])
        crops.append({'name': 'flame_' + str(i), 'image': crop, 'pivot': pivot, 'extent': extent})
    return crops


def main():
    sequence_path, components_path = map(Path, sys.argv[1:3])
    cels = sequence_crops(rgba(sequence_path))
    parts = component_crops(rgba(components_path))
    atlas = Image.new('RGBA', (1024, 768), (0, 0, 0, 0))
    frames = {}; align = {}
    sequence_scale = 112 / max(c['extent'] for c in cels)
    smoke_extent = max(max(c['image'].size) / 2 for c in parts if c['name'].startswith('smoke'))
    for i, c in enumerate(cels + parts):
        large = i < 8; size = 256 if large else 128
        scale = sequence_scale if large else 54 / (smoke_extent if c['name'].startswith('smoke') else max(c['image'].size) / 2)
        image = c['image'].resize((max(1, round(c['image'].width * scale)), max(1, round(c['image'].height * scale))), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        tile.alpha_composite(image, (round(size / 2 - c['pivot'][0] * scale), round(size / 2 - c['pivot'][1] * scale)))
        edge = max(tile.getchannel('A').crop(b).getextrema()[1] for b in [(0, 0, size, 8), (0, size - 8, size, size), (0, 0, 8, size), (size - 8, 0, size, size)])
        if edge > 3: raise ValueError('Alpha padding failed: ' + c['name'])
        x, y = (i % 4 * 256, i // 4 * 256) if large else ((i - 8) % 8 * 128, 512 + (i - 8) // 8 * 128)
        # paste retains invisible extruded RGB; alpha_composite would clear it.
        atlas.paste(bleed_rgb(tile), (x, y)); frames[c['name']] = [x, y, size, size]
        align[c['name']] = {'sourcePivot': [round(v, 2) for v in c['pivot']], 'scale': round(scale, 5)}
    out = ROOT / 'assets/resources/fx/fire_v2.png'
    atlas.save(out, optimize=True)
    manifest = {'width': 1024, 'height': 768, 'nativeAlpha': True, 'padding': 16, 'transparentRGBBleed': 4,
                'sequence': 'eight coherent cels, shared scale, ivory-core / central-opening pivot',
                'sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [sequence_path, components_path]},
                'alignment': align, 'frames': frames}
    out.with_suffix('.frames.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'atlas': str(out), 'bytes': out.stat().st_size, 'frames': len(frames), 'alphaPadding': 'pass', 'sequenceScale': sequence_scale}))


if __name__ == '__main__': main()
