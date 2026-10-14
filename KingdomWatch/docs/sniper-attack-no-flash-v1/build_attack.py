"""Package the approved, cleaned sniper attack with the idle's scale and foot pivot."""
from collections import deque
from pathlib import Path
import hashlib
import json
import sys
import uuid

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
UX = GAME / 'assets/resources/ux/sniper_attack_v1'
SOURCE = ROOT / 'sniper-attack-no-flash.mp4'
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from mob_video2frames import key_frame, KEY_COLOR

# In original source coordinates. Only matte selection follows the negative
# spaces; the character pixels, crop, scale and foot position never move.
APERTURES = {
    48: [[548, 177], [461, 211]], 52: [[554, 160], [474, 175]],
    56: [[559, 162], [484, 190]], 60: [[546, 172], [464, 209]],
    64: [[511, 219], [439, 276]], 70: [[505, 224], [442, 284]],
    76: [[536, 184], [454, 224]], 84: [[543, 171], [462, 207]],
    96: [[548, 177], [464, 213]],
}
CROP = (375, 82, 997, 640)
FOOT = (680.5, 636)
CELL = (512, 576)
GROUND = (256, 560)
INDICES = list(range(48, 97))
RELEASE = INDICES.index(52)


def aperture_centres(index):
    keys = sorted(APERTURES)
    lower = max(k for k in keys if k <= index)
    upper = min(k for k in keys if k >= index)
    amount = (index - lower) / (upper - lower) if upper != lower else 0
    return np.asarray(APERTURES[lower]) * (1 - amount) + np.asarray(APERTURES[upper]) * amount


def key_weapon_gaps(rgb, rgba, source_index):
    """Remove enclosed black background near the two actual crossbow apertures.

    Connected components select coherent black spaces rather than individual
    codec-noise pixels; density/size and the two local guides exclude ink lines
    and the character's dark clothing. Open spaces are already keyed by edges.
    """
    alpha = np.asarray(rgba.getchannel('A'))
    h, w = rgb.shape[:2]
    yy, xx = np.indices((h, w))
    expected = aperture_centres(source_index) - np.asarray(CROP[:2])
    near = np.zeros((h, w), dtype=bool)
    for x, y in expected:
        near |= (xx - x) ** 2 + (yy - y) ** 2 <= 64 ** 2
    dark = (rgb.sum(2, dtype=np.uint16) <= 18) & (alpha > 240) & near
    work = dark.copy()
    marked = Image.fromarray(rgb)
    records = []
    for sy, sx in zip(*np.where(dark)):
        if not work[sy, sx]:
            continue
        work[sy, sx] = False
        queue = deque([(int(sx), int(sy))])
        points = []
        while queue:
            x, y = queue.popleft()
            points.append((x, y))
            for nx, ny in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
                if 0 <= nx < w and 0 <= ny < h and work[ny, nx]:
                    work[ny, nx] = False
                    queue.append((nx, ny))
        if len(points) < 64:
            continue
        p = np.asarray(points)
        left, top = p.min(0)
        right, bottom = p.max(0) + 1
        density = len(points) / ((right - left) * (bottom - top))
        centre = p.mean(0)
        if len(points) > 6000 or density < .30 or np.linalg.norm(expected - centre, axis=1).min() > 36:
            continue
        values = rgb[p[:, 1], p[:, 0]].sum(1, dtype=np.uint16)
        seed = tuple(map(int, p[np.argmin(values)]))
        ImageDraw.floodfill(marked, seed, KEY_COLOR, thresh=18)
        records.append({'seed': [seed[0] + CROP[0], seed[1] + CROP[1]],
                        'corePixels': len(points), 'density': round(float(density), 4)})
    removed = np.all(np.asarray(marked) == KEY_COLOR, axis=2)
    gap_alpha = Image.fromarray(np.where(removed, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))
    rgba.putalpha(Image.fromarray(np.minimum(alpha, np.asarray(gap_alpha))))
    return rgba, records


def main():
    idle = json.loads((GAME / 'assets/resources/ux/sniper_idle_rebuild_v4/idle.frames.json').read_text(encoding='utf-8'))
    reader = imageio_ffmpeg.read_frames(str(SOURCE), pix_fmt='rgb24')
    info = next(reader)
    if tuple(info['size']) != (1280, 720) or info['fps'] != 24:
        raise RuntimeError('Unexpected approved source format')
    scale = idle['readyHeightPx'] / (FOOT[1] - 87)
    dw, dh = round((CROP[2] - CROP[0]) * scale), round((CROP[3] - CROP[1]) * scale)
    tx = round(GROUND[0] - (FOOT[0] - CROP[0]) * scale)
    ty = round(GROUND[1] - (FOOT[1] - CROP[1]) * scale)
    if tx < 0 or ty < 0 or tx + dw > CELL[0] or ty + dh > CELL[1]:
        raise RuntimeError('The fixed mapping does not fit the attack cell')
    cols = 7
    atlas = Image.new('RGBA', (cols * CELL[0], ((len(INDICES) + cols - 1) // cols) * CELL[1]))
    frame_dir = ROOT / 'frames'
    frame_dir.mkdir(exist_ok=True)
    rects, records = {}, []
    for source_index, data in enumerate(reader):
        if source_index not in INDICES:
            continue
        n = source_index - INDICES[0]
        full = np.frombuffer(data, dtype=np.uint8).reshape(720, 1280, 3)
        rgb = full[CROP[1]:CROP[3], CROP[0]:CROP[2]].copy()
        rgba = key_frame(rgb, 18)
        rgba, gaps = key_weapon_gaps(rgb, rgba, source_index)
        cell = Image.new('RGBA', CELL)
        cell.alpha_composite(rgba.resize((dw, dh), Image.Resampling.LANCZOS), (tx, ty))
        cell.save(frame_dir / f'attack-{n:02d}.png')
        x, y = n % cols * CELL[0], n // cols * CELL[1]
        atlas.paste(cell, (x, y))
        rects[f'attack{n}'] = [x, y, *CELL]
        records.append({'sourceFrame': source_index, 'apertures': gaps})
        if (n + 1) % 8 == 0:
            print(f'packaged {n+1}/{len(INDICES)} complete attack frames', flush=True)
    if len(rects) != len(INDICES):
        raise RuntimeError('Approved source is incomplete')
    manifest = {
        'frames': rects,
        'animation': {'frames': list(rects), 'seconds': len(INDICES) / info['fps'],
                      'frameDurations': [1 / info['fps']] * len(INDICES), 'loop': False,
                      'releaseIndex': RELEASE, 'readyIndex': len(INDICES) - 1,
                      'recoverySeconds': (len(INDICES) - RELEASE) / info['fps']},
        'hero': 'sniper', 'groundAnchor': list(GROUND), 'cellSize': list(CELL),
        'readyHeightPx': idle['readyHeightPx'], 'displayHeight': idle['displayHeight'],
        'source': {'file': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                   'fps': info['fps'], 'videoSize': list(info['size']), 'indices': INDICES,
                   'jointCrop': list(CROP), 'fixedScale': scale, 'fixedFootSource': list(FOOT),
                   'omittedOpeningHold': list(range(48)), 'cleanedFlashFrames': [52, 53, 54]},
        'processing': {'matte': 'Edge-connected black background plus coherent enclosed crossbow apertures',
                       'spatial': 'One fixed crop, scale and foot pivot; complete frames; no pose deformation',
                       'temporal': 'Every adjacent source frame from 48 to 96, in order; single attack, no reverse loop'},
        'playback': 'Actual bolt callbacks start at releaseIndex; preparation before fire and single recovery scaled to attack rate. An active rapid-fire gesture is not restarted.',
        'blend': 'straight RGBA; SRC_ALPHA / ONE_MINUS_SRC_ALPHA',
    }
    UX.mkdir(parents=True, exist_ok=True)
    atlas.save(UX / 'attack.png', optimize=True)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
    (UX / 'attack.frames.json').write_text(encoded, encoding='utf-8')
    (ROOT / 'attack.frames.json').write_text(encoded, encoding='utf-8')
    (ROOT / 'attack-matte.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    for path, importer, version in [(UX, 'directory', '1.2.0'), (UX / 'attack.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path) + '.meta')
        if not meta.exists():
            meta.write_text(json.dumps({'ver': version, 'importer': importer, 'imported': True,
                'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
    report = {'frames': len(rects), 'releaseIndex': RELEASE, 'atlas': list(atlas.size),
              'atlasBytes': (UX / 'attack.png').stat().st_size,
              'displayHeight': idle['displayHeight'], 'groundAnchor': list(GROUND),
              'resource': 'assets/resources/ux/sniper_attack_v1', 'source': SOURCE.name,
              'review': 'Approved cleaned source; packaged effect will be manually reviewed by user in game.'}
    (ROOT / 'packaging.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
