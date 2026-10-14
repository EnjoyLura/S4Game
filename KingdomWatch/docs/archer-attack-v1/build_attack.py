"""Convert the supplied attack video to complete transparent character frames."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import uuid

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
UX = GAME / 'assets/resources/ux/archer_attack_v1'
SOURCE = ROOT / 'source.mp4'
if not SOURCE.exists():
    shutil.copy2('C:/Users/user/Downloads/弓箭手姿势描述 (1).mp4', SOURCE)
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from mob_video2frames import key_frame

idle = json.loads((GAME / 'assets/resources/ux/archer_idle_v1/idle.frames.json').read_text(encoding='utf-8'))
reader = imageio_ffmpeg.read_frames(str(SOURCE))
metadata = next(reader)
raw = [Image.frombytes('RGB', metadata['size'], b) for b in reader]
fps = float(metadata['fps'])
# Keep the full release/recoil/reload action, cutting the 1.4s opening hold.
# Source 40/41 contain the already airborne arrow; actual arrows remain engine projectiles.
indices = [34, 36, 38, 39] + list(range(42, 91, 2))
release_index = 4
crop = (480, 16, 908, 684)
foot_x, baseline = 650, 684
width, height = 256, 352
ground = [128, 344]
# One scale for the entire video, matching the existing ready pose's painted height.
ready_height = float(idle['readyHeightPx'])
scale = ready_height / (baseline - 22)
draw_w = round((crop[2] - crop[0]) * scale)
draw_h = round((crop[3] - crop[1]) * scale)
px = round(ground[0] - (foot_x - crop[0]) * scale)
py = round(ground[1] - (baseline - crop[1]) * scale)
cols = 8
atlas = Image.new('RGBA', (cols * width, ((len(indices) + cols - 1) // cols) * height))
rects = {}
frames_dir = ROOT / 'frames'
frames_dir.mkdir(exist_ok=True)
for n, source_index in enumerate(indices):
    rgb = np.asarray(raw[source_index].crop(crop)).copy()
    rgba = key_frame(rgb, 18)
    alpha = np.asarray(rgba.getchannel('A')).copy()
    alpha[rgb.max(2) <= 5] = 0
    rgba.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.25)))
    rgba = rgba.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', (width, height))
    cell.alpha_composite(rgba, (px, py))
    cell.save(frames_dir / f'attack-{n:02d}.png')
    x, y = n % cols * width, n // cols * height
    atlas.paste(cell, (x, y))
    rects[f'attack{n}'] = [x, y, width, height]

manifest = {
    'frames': rects,
    'animation': {
        'frames': list(rects), 'seconds': (indices[-1] - indices[0]) / fps,
        'loop': False, 'releaseIndex': release_index, 'recoverySeconds': .62,
    },
    'groundAnchor': ground, 'readyHeightPx': ready_height, 'displayHeight': idle['displayHeight'],
    'source': {
        'file': 'source.mp4', 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'fps': fps, 'crop': list(crop), 'indices': indices,
        'fixedScale': scale, 'fixedFootSource': [foot_x, baseline],
        'omittedAirborneArrowFrames': [40, 41],
    },
    'playback': 'Prepare before the existing fire event; release/recoil/reload once per gesture. Rapid rows do not restart an active gesture.',
}
UX.mkdir(parents=True, exist_ok=True)
atlas.save(UX / 'attack.png', optimize=True)
(UX / 'attack.frames.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
for path, importer, version in [(UX, 'directory', '1.2.0'), (UX / 'attack.frames.json', 'json', '2.0.1')]:
    meta = Path(str(path) + '.meta')
    if not meta.exists():
        meta.write_text(json.dumps({
            'ver': version, 'importer': importer, 'imported': True, 'uuid': str(uuid.uuid4()),
            'files': ['.json'] if importer == 'json' else [], 'subMetas': {}, 'userData': {},
        }, indent=2), encoding='utf-8')
print(json.dumps({
    'frames': len(indices), 'releaseIndex': release_index, 'atlas': atlas.size,
    'bytes': (UX / 'attack.png').stat().st_size, 'fixedFoot': [foot_x, baseline],
    'displayHeight': idle['displayHeight'],
}, ensure_ascii=False))
