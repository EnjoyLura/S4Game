"""Package the user's existing idle video; one fixed crop, scale and foot pivot."""
from pathlib import Path
import hashlib, json, sys, shutil, uuid
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
UX = GAME / 'assets/resources/ux/archer_idle_v1'
SOURCE = ROOT / 'source.mp4'
if not SOURCE.exists():
    shutil.copy2('C:/Users/user/Downloads/弓箭手姿势描述.mp4', SOURCE)
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from mob_video2frames import key_frame

reader = imageio_ffmpeg.read_frames(str(SOURCE))
metadata = next(reader)
# The entire character stays inside this fixed source region; video branding is outside it.
crop = (480, 0, 880, 720)
raw = [np.asarray(Image.frombytes('RGB', metadata['size'], b).crop(crop)).copy() for b in reader]
fps = float(metadata['fps'])
small = [np.asarray(Image.fromarray(f).resize((80, 144), Image.Resampling.BILINEAR)).astype(float) for f in raw]
costs = []
for start in range(min(24, len(raw) // 4)):
    for end in range(start + 48, len(raw)):
        mask = (small[start].max(2) > 20) | (small[end].max(2) > 20)
        cost = float(np.abs(small[start] - small[end])[mask].mean())
        costs.append((cost, start, end))
cost, start, end = min(costs)
step_cost = float(np.median([np.abs(small[i + 1] - small[i])[small[i].max(2) > 20].mean() for i in range(len(raw) - 1)]))
# Match an actual continuous interval if its seam is comparable to one frame's motion.
# Otherwise use the quiet motion forwards/backwards, without crossfading or inventing poses.
continuous = cost <= max(4.0, step_cost * 2.5)
if not continuous:
    start, end = 0, len(raw) - 1
indices = list(dict.fromkeys(round(i) for i in np.arange(start, end + .001, fps / 16)))
frames = [raw[i] for i in indices]
boxes = []
for f in frames:
    y, x = np.where(f.max(2) > 28)
    boxes.append((int(x.min()), int(y.min()), int(x.max() + 1), int(y.max() + 1)))
left = max(0, min(b[0] for b in boxes) - 4)
top = max(0, min(b[1] for b in boxes) - 4)
right = min(400, max(b[2] for b in boxes) + 4)
baseline = 720
# Root midway between the boots, fixed for every frame (not bounding-box centering).
foot_x = 650 - crop[0]
width, height = 192, 352
scale = min(336 / (baseline - top), (width - 16) / (2 * max(foot_x - left, right - foot_x)))
ready_height = (baseline - min(b[1] for b in boxes)) * scale
draw_w, draw_h = round((right - left) * scale), round((baseline - top) * scale)
px = round(width / 2 - (foot_x - left) * scale)
py = round(height - 8 - (baseline - top) * scale)
cols = 8
atlas = Image.new('RGBA', (cols * width, ((len(frames) + cols - 1) // cols) * height))
cells, rects = [], {}
dest = ROOT / 'frames'
dest.mkdir(exist_ok=True)
for n, f in enumerate(frames):
    rgba = key_frame(f, 18)
    rgb = np.asarray(rgba.convert('RGB'))
    alpha = np.asarray(rgba.getchannel('A')).copy()
    # Truly black enclosed bow/arm gaps, preserving colored dark leather and ink.
    alpha[rgb.max(2) <= 5] = 0
    rgba.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.25)))
    rgba = rgba.crop((left, top, right, baseline)).resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (width, height))
    cell.alpha_composite(rgba, (px, py))
    cell.save(dest / f'idle-{n:02d}.png')
    cells.append(cell)
    x, y = (n % cols) * width, (n // cols) * height
    atlas.paste(cell, (x, y))
    rects[f'idle{n}'] = [x, y, width, height]
order = list(range(len(cells))) if continuous else list(range(len(cells))) + list(range(len(cells) - 2, 0, -1))
duration = (end - start) / fps if continuous else 2 * (indices[-1] - indices[0]) / fps
manifest = {
    'frames': rects, 'animation': {'frames': [f'idle{i}' for i in order], 'seconds': duration, 'loop': True},
    'groundAnchor': [width / 2, height - 8], 'readyHeightPx': ready_height, 'displayHeight': 185.64,
    'source': {'file': 'source.mp4', 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
               'fps': fps, 'crop': list(crop), 'indices': indices, 'fixedScale': scale,
               'fixedFootSource': [650, baseline]},
    'loopMethod': 'continuous endpoint matched' if continuous else 'continuous forward/backward idle',
    'diagnostics': {'endpointMeanError': cost, 'medianAdjacentError': step_cost},
}
UX.mkdir(parents=True, exist_ok=True)
atlas.save(UX / 'idle.png', optimize=True)
(UX / 'idle.frames.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'asset-validation.json').write_text(json.dumps({
    'ok': True, 'frameCount': len(cells), 'timelineFrames': len(order), 'seconds': duration,
    'atlas': atlas.size, 'bytes': (UX / 'idle.png').stat().st_size,
    'sourceVideo': metadata, 'fixedFoot': [650, baseline], 'loopMethod': manifest['loopMethod'],
    'endpointMeanError': cost, 'medianAdjacentError': step_cost,
    'bounds': [left, top, right, baseline], 'scale': scale,
}, ensure_ascii=False, indent=2), encoding='utf-8')
for path, importer, ver in [(UX, 'directory', '1.2.0'), (UX / 'idle.frames.json', 'json', '2.0.1')]:
    meta = Path(str(path) + '.meta')
    if not meta.exists():
        meta.write_text(json.dumps({'ver': ver, 'importer': importer, 'imported': True,
                                   'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                                   'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
# Static alpha review on both light and dark backgrounds.
contact = Image.new('RGB', (width * 6, height * 2), '#eaddbf')
for k, n in enumerate(np.linspace(0, len(cells) - 1, 6).round().astype(int)):
    for row, bg in enumerate(['#eaddbf', '#263a43']):
        tile = Image.new('RGBA', (width, height), bg); tile.alpha_composite(cells[n])
        contact.paste(tile.convert('RGB'), (k * width, row * height))
contact.save(ROOT / 'alpha-contact.jpg', quality=95)
print(json.dumps({'frames': len(cells), 'seconds': duration, 'loop': manifest['loopMethod'],
                  'atlas': atlas.size, 'bytes': (UX / 'idle.png').stat().st_size,
                  'seam': cost, 'adjacent': step_cost}, ensure_ascii=False))
