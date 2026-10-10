"""Prepare four AI compositing layers, not an animation sequence."""
from pathlib import Path
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
src = Image.open(Path(__file__).with_name('ice-layers-alpha.png')).convert('RGBA')
cell = src.width // 2
size = 512
names = ['rim', 'spire', 'burst', 'shard']
atlas = Image.new('RGBA', (size * 2, size * 2))
frames = {}
metrics = {}
for k, name in enumerate(names):
    x, y = k % 2 * cell, k // 2 * cell
    part = src.crop((x, y, x + cell, y + cell))
    rgba = np.array(part)
    # The inspected matte has one isolated stray pixel at the canvas edge.
    # Each cell's empty gutters are safe to clear; no crystal intersects them.
    gutter = 6
    rgba[:gutter] = 0; rgba[-gutter:] = 0
    rgba[:, :gutter] = 0; rgba[:, -gutter:] = 0
    part = Image.fromarray(rgba).resize((size, size), Image.Resampling.LANCZOS)
    rgba = np.array(part)
    rgba[rgba[:, :, 3] <= 5] = 0
    part = Image.fromarray(rgba)
    bounds = part.getbbox()
    left, top, right, bottom = bounds
    bottom_alpha = rgba[max(top, bottom - 16):bottom, :, 3].astype(float)
    foot_x = float((bottom_alpha.sum(axis=0) * np.arange(size)).sum() / max(bottom_alpha.sum(), 1))
    anchor = [0.5, 0.5] if name in ('rim', 'burst') else [round((foot_x + 0.5) / size, 6), round(1 - (bottom - 0.5) / size, 6)]
    metrics[name] = {'span': round((right-left)/size, 6), 'height': round((bottom-top)/size, 6), 'anchor': anchor, 'bounds': list(bounds)}
    frames[name] = [k % 2 * size, k // 2 * size, size, size]
    atlas.paste(part, (k % 2 * size, k // 2 * size))
    part.save(Path(__file__).with_name(name + '.png'), optimize=True)
out = root / 'assets/resources/fx/frost_ice_v4.png'
atlas.save(out, optimize=True)
meta = {'frames': frames, 'metrics': metrics, 'kind': 'four static compositing layers, not sequence frames'}
out.with_name('frost_ice_v4.frames.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
print(json.dumps({'source_size': list(src.size), 'runtime_size': list(atlas.size), 'bytes': out.stat().st_size, 'metrics': metrics}))
