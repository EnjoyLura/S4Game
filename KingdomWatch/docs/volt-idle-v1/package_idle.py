"""Package the red-screen H3 idle with complete frames and one fixed foot pivot."""
from pathlib import Path
import hashlib
import json
import sys
import uuid

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
DEST = GAME / 'assets/resources/ux/volt_idle_v1'
sys.path.insert(0, str(GAME / 'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif, smooth_loop

CELL = (512, 512)
COLS = 8
GROUND = (256, 496)
DISPLAY_HEIGHT = 146
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)


def key_red(image):
    """Key the red field globally, including bow gaps, preserving dark ink/clothes.

    Use red dominance to estimate edge coverage and undo the red background mix
    on the partially covered contour pixels. Neutral/blue/brown opaque surfaces
    remain opaque. The opaque red master and original video are kept separately.
    """
    rgb = np.asarray(image.convert('RGB')).astype(np.float32)
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                             rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    background = np.median(border, axis=0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    other = np.maximum(g, b)
    score = r - 2.4 * other
    screen_score = float(background[0] - 2.4 * max(background[1], background[2]))
    if screen_score < 100:
        raise RuntimeError('The source border is not a red field; preserve the video and inspect its input format')
    coverage = np.clip((screen_score - score) / max(screen_score - 24, 1), 0, 1)
    coverage[other >= r * .30] = 1
    coverage[(r >= 160) & (other <= r * .25)] = 0
    coverage = np.asarray(Image.fromarray(np.round(coverage * 255).astype(np.uint8))
                          .filter(ImageFilter.GaussianBlur(.35)), dtype=np.float32) / 255
    clean = np.clip((rgb - (1 - coverage[..., None]) * background)
                    / np.maximum(coverage[..., None], 1 / 255), 0, 255)
    clean[coverage == 0] = 0
    out = np.dstack([np.round(clean).astype(np.uint8), np.round(coverage * 255).astype(np.uint8)])
    return Image.fromarray(out), background.tolist()


def bounds(image):
    alpha = np.asarray(image.getchannel('A'))
    ys, xs = np.where(alpha > 32)
    if not len(xs):
        raise RuntimeError('No character remains in the input')
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]


def foot(image, box):
    alpha = np.asarray(image.getchannel('A'))
    # The staff tip is above the boots; measure only the lowest boot band.
    start = box[3] - round((box[3] - box[1]) * .08)
    ys, xs = np.where(alpha[start:] > 90)
    return [(float(xs.min()) + float(xs.max())) / 2, box[3]]


def draw_frame(canvas, image, manifest, x, y, height, mirror=False):
    scale = height / manifest['readyHeightPx']
    w, h = image.size
    sprite = image.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    anchor_x = manifest['groundAnchor'][0]
    if mirror:
        sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        anchor_x = w - anchor_x
    canvas.alpha_composite(sprite, (round(x - anchor_x * scale),
                                   round(y - manifest['groundAnchor'][1] * scale)))


def save_previews(cells, manifest):
    mirror_frames = []
    battle_frames = []
    archer_data = json.loads((GAME / 'assets/resources/ux/archer_idle_v1/idle.frames.json').read_text(encoding='utf-8'))
    archer_atlas = Image.open(GAME / 'assets/resources/ux/archer_idle_v1/idle.png').convert('RGBA')
    sniper_data = json.loads((GAME / 'assets/resources/ux/sniper_idle_forward_v2/idle.frames.json').read_text(encoding='utf-8'))
    sniper_atlas = Image.open(GAME / 'assets/resources/ux/sniper_idle_forward_v2/idle.png').convert('RGBA')
    floor = Image.open(GAME / 'assets/resources/scenes/scene_1_1.png').convert('RGBA').resize((750, 500))
    wall = Image.open(GAME / 'assets/resources/ux/defense_wall.png').convert('RGBA').resize((750, 321))
    elapsed = 0
    for index, duration in zip(manifest['sourceOrder'], manifest['animation']['frameDurations']):
        canvas = Image.new('RGBA', (840, 510), '#293c3b')
        draw = ImageDraw.Draw(canvas)
        draw.text((20, 10), '雷法师 · 轻微待机 / 镜像', font=FONT, fill='#eef1e4')
        draw_frame(canvas, cells[index], manifest, 210, 486, 380)
        draw_frame(canvas, cells[index], manifest, 630, 486, 380, True)
        mirror_frames.append(canvas.convert('RGB'))
        battle = floor.copy()
        battle.alpha_composite(wall, (0, 210))
        order = archer_data['animation']['frames']
        ai = int(elapsed % archer_data['animation']['seconds'] / archer_data['animation']['seconds'] * len(order))
        x, y, w, h = archer_data['frames'][order[ai]]
        draw_frame(battle, archer_atlas.crop((x, y, x + w, y + h)), archer_data,
                   140, 440, archer_data['displayHeight'])
        phase, si = elapsed % sniper_data['animation']['seconds'], 0
        for si, frame_duration in enumerate(sniper_data['animation']['frameDurations']):
            if phase < frame_duration:
                break
            phase -= frame_duration
        sx, sy, sw, sh = sniper_data['frames'][sniper_data['animation']['frames'][si]]
        draw_frame(battle, sniper_atlas.crop((sx, sy, sx + sw, sy + sh)), sniper_data,
                   370, 440, sniper_data['displayHeight'])
        draw_frame(battle, cells[index], manifest, 600, 440, DISPLAY_HEIGHT)
        battle_frames.append(battle.convert('RGB'))
        elapsed += duration
    save_gif(mirror_frames, ROOT / 'idle-mirror.gif', manifest['animation']['seconds'],
             manifest['animation']['frameDurations'])
    save_gif(battle_frames, ROOT / 'battle-composite.gif', manifest['animation']['seconds'],
             manifest['animation']['frameDurations'])


def main():
    ready = Image.open(ROOT / 'ready-red.png')
    ready_alpha, ready_bg = key_red(ready)
    ready_alpha.save(ROOT / 'ready-transparent.png', optimize=True)
    ready_box = bounds(ready_alpha)
    ready_foot = foot(ready_alpha, ready_box)
    art = {'image': 'ready-red.png', 'transparentImage': 'ready-transparent.png',
           'size': list(ready.size), 'bounds': ready_box, 'groundAnchor': ready_foot,
           'readyHeightPx': ready_foot[1] - ready_box[1], 'displayHeight': DISPLAY_HEIGHT,
           'backgroundRGB': ready_bg, 'direction': 'rear view, slightly left; purple-robed thunder mage holding the same rigid crystal staff in the ready pose',
           'imageTool': 'built-in imagegen', 'prompt': 'image-prompt.txt',
           'approvedStaticMaster': '../volt-combat-rebuild-v1/ready-red.png'}
    (ROOT / 'art.json').write_text(json.dumps(art, ensure_ascii=False, indent=2), encoding='utf-8')

    reader = imageio_ffmpeg.read_frames(str(ROOT / 'source.mp4'), pix_fmt='rgb24')
    info = next(reader)
    frames, backgrounds = [], []
    for data in reader:
        image = Image.frombytes('RGB', info['size'], data)
        keyed, background = key_red(image)
        frames.append(keyed)
        backgrounds.append(background)
    if len(frames) < 2:
        raise RuntimeError('The source does not contain an animation')
    first = bounds(frames[0])
    source_foot = foot(frames[0], first)
    boxes = [bounds(frame) for frame in frames]
    left = max(0, min(box[0] for box in boxes) - 4)
    top = max(0, min(box[1] for box in boxes) - 4)
    right = min(info['size'][0], max(box[2] for box in boxes) + 4)
    bottom = min(info['size'][1], max(box[3] for box in boxes) + 4)
    extent = max(source_foot[0] - left, right - source_foot[0])
    scale = min((CELL[0] - 32) / (2 * extent), (CELL[1] - 40) / (bottom - top))
    dw, dh = round((right - left) * scale), round((bottom - top) * scale)
    tx = round(GROUND[0] - (source_foot[0] - left) * scale)
    ty = round(GROUND[1] - (source_foot[1] - top) * scale)
    if tx < 0 or ty < 0 or tx + dw > CELL[0] or ty + dh > CELL[1]:
        raise RuntimeError('The complete fixed crop does not fit the cell')
    atlas = Image.new('RGBA', (CELL[0] * COLS, CELL[1] * ((len(frames) + COLS - 1) // COLS)))
    if max(atlas.size) > 4096:
        raise RuntimeError('Native video exceeds the 4096px atlas limit')
    frame_dir = ROOT / 'frames'
    frame_dir.mkdir(exist_ok=True)
    cells, rects = [], {}
    for i, frame in enumerate(frames):
        cell = Image.new('RGBA', CELL)
        cell.alpha_composite(frame.crop((left, top, right, bottom))
                             .resize((dw, dh), Image.Resampling.LANCZOS), (tx, ty))
        cell.save(frame_dir / f'idle-{i:02d}.png')
        cells.append(cell)
        x, y = i % COLS * CELL[0], i // COLS * CELL[1]
        atlas.paste(cell, (x, y))
        rects[f'idle{i}'] = [x, y, *CELL]
    order, durations = smooth_loop(len(cells), 4.0)
    manifest = {
        'frames': rects, 'animation': {'frames': [f'idle{i}' for i in order],
            'seconds': 4.0, 'frameDurations': durations, 'loop': True},
        'sourceOrder': order, 'hero': 'volt', 'groundAnchor': list(GROUND),
        'cellSize': list(CELL), 'readyHeightPx': round((source_foot[1] - first[1]) * scale, 4),
        'displayHeight': DISPLAY_HEIGHT,
        'source': {'file': 'source.mp4', 'sha256': hashlib.sha256((ROOT / 'source.mp4').read_bytes()).hexdigest(),
            'videoSize': list(info['size']), 'fps': info['fps'], 'frameCount': len(frames),
            'seconds': len(frames) / info['fps'], 'indices': list(range(len(frames))),
            'jointCrop': [left, top, right, bottom], 'fixedScale': scale,
            'fixedFootSource': source_foot, 'redFieldPerFrame': backgrounds},
        'processing': {'matte': 'Global red chroma key, internal bow gaps included; red edge mix removed',
            'spatial': 'One fixed crop, scale and foot pivot from the lowest boot band, excluding staff tip; complete character, one final resize',
            'temporal': 'Every source frame forward/backward; eased endpoint timing; no last-to-first jump'},
        'blend': 'straight RGBA; SRC_ALPHA / ONE_MINUS_SRC_ALPHA',
        'scope': 'New complete thunder-mage idle frames, standalone preview and formal battle integration for user manual review',
    }
    DEST.mkdir(parents=True, exist_ok=True)
    atlas.save(DEST / 'idle.png', optimize=True)
    atlas.save(ROOT / 'idle.png', optimize=True)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
    (DEST / 'idle.frames.json').write_text(encoded, encoding='utf-8')
    (ROOT / 'idle.frames.json').write_text(encoded, encoding='utf-8')
    for path, importer, version in [(DEST, 'directory', '1.2.0'), (DEST / 'idle.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path) + '.meta')
        if not meta.exists():
            meta.write_text(json.dumps({'ver': version, 'importer': importer, 'imported': True,
                'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
    sheet = Image.new('RGB', (7 * 128, 36 + ((len(cells) + 6) // 7) * 148), '#e8ddc4')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), '雷法师 · 轻微待机 · 完整人物帧', font=FONT, fill='#293d3e')
    for i, cell in enumerate(cells):
        x, y = i % 7 * 128, 36 + i // 7 * 148
        thumb = cell.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y), thumb)
        draw.text((x + 8, y + 128), f'{i:02d}', font=FONT, fill='#47565a')
    sheet.save(ROOT / 'contact-sheet.jpg', quality=93)
    save_previews(cells, manifest)
    report = {'uniqueFrames': len(cells), 'timelineFrames': len(order), 'loopSeconds': 4,
              'sourceVideo': info, 'atlas': list(atlas.size), 'cell': list(CELL),
              'atlasBytes': (DEST / 'idle.png').stat().st_size, 'resource': str(DEST.relative_to(GAME)),
              'displayHeight': DISPLAY_HEIGHT, 'gameIntegrated': False,
              'review': 'User manual review; no browser, game or automated visual QA'}
    (ROOT / 'packaging.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
