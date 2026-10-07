"""Crop an ImageGen 4x3 RGBA component sheet, retaining native alpha.
Fire stages share a hot-core pivot and scale; padding prevents atlas bleed.
Usage: python tools/pack-fire-vfx.py source.png
"""
import hashlib
import json
import sys
from pathlib import Path
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

IDS = ['core', 'flame_a', 'flame_b', 'flame_c', 'smoke_a', 'smoke_b',
       'ember', 'chip', 'dust', 'scorch', 'streak', 'fireball']
ROOT = Path(__file__).resolve().parents[1]


def main():
    source = Path(sys.argv[1])
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    if alpha.getextrema()[0] != 0 or alpha.histogram()[0] < image.width * image.height * .25:
        raise ValueError('Expected genuine separated transparent components')
    # Image generation observes approximate cells. Connected silhouettes may
    # cross an invisible grid line, so segment them before cropping.
    pixels = np.asarray(alpha).reshape(-1)
    labels = np.full(len(pixels), -1, dtype=np.int32)
    regions = []
    w, h = image.size
    for seed in np.flatnonzero(pixels >= 64):
        if labels[seed] >= 0:
            continue
        ident = len(regions)
        labels[seed] = ident
        queue = deque([int(seed)])
        x0, y0, x1, y1, area, sum_x, sum_y = w, h, 0, 0, 0, 0, 0
        while queue:
            p = queue.popleft()
            x, y = p % w, p // w
            x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
            area += 1; sum_x += x; sum_y += y
            for n in [p - 1 if x else -1, p + 1 if x + 1 < w else -1,
                      p - w if y else -1, p + w if y + 1 < h else -1]:
                if n >= 0 and labels[n] < 0 and pixels[n] >= 64:
                    labels[n] = ident; queue.append(n)
        regions.append({'id': ident, 'area': area, 'bounds': (x0, y0, x1 + 1, y1 + 1),
                        'cx': sum_x / area, 'cy': sum_y / area})
    primary = {}
    for region in regions:
        slot = min(3, int(region['cx'] / w * 4)) + min(2, int(region['cy'] / h * 3)) * 4
        if slot not in primary or region['area'] > primary[slot]['area']:
            primary[slot] = region
    if len(primary) != len(IDS):
        raise ValueError('Expected 12 independent component silhouettes')
    labels = labels.reshape(h, w)
    crops = []
    for index, name in enumerate(IDS):
        region = primary[index]
        x0, y0, x1, y1 = region['bounds']
        bounds = (max(0, x0 - 16), max(0, y0 - 16), min(w, x1 + 16), min(h, y1 + 16))
        bx0, by0, bx1, by1 = bounds
        crop = image.crop(bounds)
        keep = Image.fromarray(np.uint8(labels[by0:by1, bx0:bx1] == region['id']) * 255)
        for _ in range(12):
            keep = keep.filter(ImageFilter.MaxFilter(3))
        # Keep original RGBA edge pixels, discarding only unrelated neighbours.
        rgba = np.array(crop)
        rgba[np.asarray(keep) == 0, 3] = 0
        crop = Image.fromarray(rgba)
        px, py = crop.width / 2, crop.height / 2
        if name in ['core', 'flame_a', 'flame_b', 'flame_c', 'fireball']:
            weights = [(x, y, a * max(0, g - 150)) for y in range(crop.height) for x in range(crop.width)
                       for r, g, b, a in [crop.getpixel((x, y))] if r > 220 and g > 150 and a > 100]
            total = sum(v[2] for v in weights)
            if total:
                px = sum(x * w for x, y, w in weights) / total
                py = sum(y * w for x, y, w in weights) / total
        extent = max(px, py, crop.width - px, crop.height - py)
        crops.append({'name': name, 'image': crop, 'pivot': (px, py), 'extent': extent})
    flame_extent = max(c['extent'] for c in crops if c['name'].startswith('flame_'))
    smoke_extent = max(c['extent'] for c in crops if c['name'].startswith('smoke_'))
    atlas = Image.new('RGBA', (1024, 768), (0, 0, 0, 0))
    frames = {}
    for index, item in enumerate(crops):
        extent = flame_extent if item['name'].startswith('flame_') else smoke_extent if item['name'].startswith('smoke_') else item['extent']
        scale = 108 / extent
        crop = item['image'].resize((max(1, round(item['image'].width * scale)), max(1, round(item['image'].height * scale))), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        tile.alpha_composite(crop, (round(128 - item['pivot'][0] * scale), round(128 - item['pivot'][1] * scale)))
        edge = max(max(tile.getchannel('A').crop(box).getextrema()) for box in [(0, 0, 256, 8), (0, 248, 256, 256), (0, 0, 8, 256), (248, 0, 256, 256)])
        if edge > 3:
            raise ValueError('Insufficient alpha padding: ' + item['name'])
        x, y = index % 4 * 256, index // 4 * 256
        atlas.alpha_composite(tile, (x, y))
        frames[item['name']] = [x, y, 256, 256]
    output = ROOT / 'assets/resources/fx/fire_v1.png'
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, optimize=True)
    manifest = {'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'width': 1024, 'height': 768, 'padding': 20, 'nativeAlpha': True,
                'flamePivot': 'hot-core centroid, shared scale', 'segmentation': 'connected alpha islands', 'frames': frames}
    output.with_suffix('.frames.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'atlas': str(output), 'bytes': output.stat().st_size, 'frames': len(frames), 'alphaEdges': 'pass'}))


if __name__ == '__main__':
    main()
