"""Produce complete red-screen attack frames aligned to the current idle's painted scale."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import uuid

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
DEST = GAME / 'assets/resources/ux/sniper_attack_forward_v2'
sys.path.insert(0, str(GAME / 'docs/sniper-idle-forward-v2'))
from package_idle import key_red, bounds, foot, draw_frame
sys.path.insert(0, str(GAME / 'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif

CELL, COLS, GROUND = (512, 576), 8, (256, 560)
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
sys.stdout.reconfigure(encoding='utf-8')


def decode():
    reader = imageio_ffmpeg.read_frames(str(ROOT / 'source.mp4'), pix_fmt='rgb24')
    info = next(reader)
    return info, [Image.frombytes('RGB', info['size'], data) for data in reader]


def extract(info, frames):
    """Source material for choosing the single shot's range and release frame."""
    directory = ROOT / 'source-frames'
    directory.mkdir(exist_ok=True)
    first, _ = key_red(frames[0])
    box = bounds(first)
    region = (max(0, box[0] - 8), max(0, box[1] - 8),
              min(info['size'][0], box[2] + 8),
              min(info['size'][1], box[1] + round((box[3] - box[1]) * .48)))
    columns, width, height = 7, 256, 224
    sheet = Image.new('RGB', (columns * width, ((len(frames) + columns - 1) // columns) * height), '#e8ddc4')
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        frame.save(directory / f'source-{index:02d}.jpg', quality=97)
        part = frame.crop(region)
        part.thumbnail((width - 8, height - 28), Image.Resampling.LANCZOS)
        x, y = index % columns * width, index // columns * height
        sheet.paste(part, (x + (width - part.width) // 2, y + 2))
        draw.text((x + 8, y + height - 26), f'{index:02d}  {index / info["fps"]:.2f}s', font=FONT, fill='#263c3b')
    sheet.save(ROOT / 'weapon-contact.jpg', quality=96)
    print(json.dumps({'sourceFrames': len(frames), 'fps': info['fps'],
                      'size': info['size'], 'annotationSheet': 'weapon-contact.jpg'}, ensure_ascii=False), flush=True)


def previews(cells, manifest, idle):
    idle_atlas = Image.open(GAME / 'assets/resources/ux/sniper_idle_forward_v2/idle.png').convert('RGBA')
    x, y, w, h = idle['frames'][idle['animation']['frames'][0]]
    idle_cell = idle_atlas.crop((x, y, x + w, y + h))
    archer = json.loads((GAME / 'assets/resources/ux/archer_idle_v1/idle.frames.json').read_text(encoding='utf-8'))
    archer_atlas = Image.open(GAME / 'assets/resources/ux/archer_idle_v1/idle.png').convert('RGBA')
    floor = Image.open(GAME / 'assets/resources/scenes/scene_1_1.png').convert('RGBA').resize((750, 500))
    wall = Image.open(GAME / 'assets/resources/ux/defense_wall.png').convert('RGBA').resize((750, 321))
    timeline = [(idle_cell, idle, .25)] + [(cell, manifest, duration) for cell, duration in
                zip(cells, manifest['animation']['frameDurations'])] + [(idle_cell, idle, .6)]
    mirrored, battle, durations = [], [], []
    elapsed = 0
    for cell, meta, duration in timeline:
        canvas = Image.new('RGBA', (840, 510), '#293c3b')
        draw = ImageDraw.Draw(canvas)
        draw.text((20, 10), '重弩手 · 单次攻击 / 镜像', font=FONT, fill='#eef1e4')
        draw_frame(canvas, cell, meta, 210, 486, 380)
        draw_frame(canvas, cell, meta, 630, 486, 380, True)
        mirrored.append(canvas.convert('RGB'))
        scene = floor.copy()
        scene.alpha_composite(wall, (0, 210))
        order = archer['animation']['frames']
        i = int(elapsed % archer['animation']['seconds'] / archer['animation']['seconds'] * len(order))
        x, y, w, h = archer['frames'][order[i]]
        draw_frame(scene, archer_atlas.crop((x, y, x + w, y + h)), archer, 210, 440, archer['displayHeight'])
        draw_frame(scene, cell, meta, 540, 440, meta['displayHeight'])
        battle.append(scene.convert('RGB'))
        durations.append(duration)
        elapsed += duration
    save_gif(mirrored, ROOT / 'attack-mirror.gif', elapsed, durations)
    save_gif(battle, ROOT / 'battle-composite.gif', elapsed, durations)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--extract-only', action='store_true')
    ap.add_argument('--start', type=int, default=0)
    ap.add_argument('--end', type=int)
    ap.add_argument('--release', type=int, help='Actual source frame of the one mechanical release')
    args = ap.parse_args()
    info, original = decode()
    if args.extract_only:
        extract(info, original)
        return
    end = len(original) - 1 if args.end is None else args.end
    if args.release is None or not 0 <= args.start <= args.release <= end < len(original):
        raise RuntimeError('Choose a valid single attack range and its source release frame')
    idle = json.loads((GAME / 'assets/resources/ux/sniper_idle_forward_v2/idle.frames.json').read_text(encoding='utf-8'))
    first, _ = key_red(original[0])
    first_box = bounds(first)
    source_foot = foot(first, first_box)
    scale = idle['readyHeightPx'] / (source_foot[1] - first_box[1])
    indices = list(range(args.start, end + 1))
    frames, backgrounds = [], []
    for index in indices:
        frame, background = key_red(original[index])
        frames.append(frame)
        backgrounds.append(background)
    boxes = [bounds(frame) for frame in frames]
    left = max(0, min(box[0] for box in boxes) - 4)
    top = max(0, min(box[1] for box in boxes) - 4)
    right = min(info['size'][0], max(box[2] for box in boxes) + 4)
    bottom = min(info['size'][1], max(box[3] for box in boxes) + 4)
    dw, dh = round((right - left) * scale), round((bottom - top) * scale)
    tx = round(GROUND[0] - (source_foot[0] - left) * scale)
    ty = round(GROUND[1] - (source_foot[1] - top) * scale)
    if tx < 0 or ty < 0 or tx + dw > CELL[0] or ty + dh > CELL[1]:
        raise RuntimeError('Complete action exceeds the cell at the idle-matched scale; preserve the source and increase layout space')
    atlas = Image.new('RGBA', (CELL[0] * COLS, ((len(frames) + COLS - 1) // COLS) * CELL[1]))
    if max(atlas.size) > 4096:
        raise RuntimeError('Too many source frames for this atlas layout')
    directory = ROOT / 'frames'
    directory.mkdir(exist_ok=True)
    cells, rects = [], {}
    for i, frame in enumerate(frames):
        cell = Image.new('RGBA', CELL)
        cell.alpha_composite(frame.crop((left, top, right, bottom)).resize((dw, dh), Image.Resampling.LANCZOS), (tx, ty))
        cell.save(directory / f'attack-{i:02d}.png')
        x, y = i % COLS * CELL[0], i // COLS * CELL[1]
        atlas.paste(cell, (x, y))
        cells.append(cell)
        rects[f'attack{i}'] = [x, y, *CELL]
    release = args.release - args.start
    durations = [1 / info['fps']] * len(frames)
    manifest = {
        'frames': rects,
        'animation': {'frames': list(rects), 'seconds': sum(durations), 'frameDurations': durations,
                      'loop': False, 'releaseIndex': release, 'readyIndex': len(frames) - 1,
                      'recoverySeconds': sum(durations[release:])},
        'hero': 'sniper', 'groundAnchor': list(GROUND), 'cellSize': list(CELL),
        'readyHeightPx': idle['readyHeightPx'], 'displayHeight': idle['displayHeight'],
        'source': {'file': 'source.mp4', 'sha256': hashlib.sha256((ROOT / 'source.mp4').read_bytes()).hexdigest(),
                   'videoSize': list(info['size']), 'fps': info['fps'], 'frameCount': len(original),
                   'seconds': len(original) / info['fps'], 'indices': indices, 'releaseFrame': args.release,
                   'jointCrop': [left, top, right, bottom], 'fixedFootSource': source_foot,
                   'fixedScale': scale, 'referenceReadyHeightSource': source_foot[1] - first_box[1],
                   'redFieldPerFrame': backgrounds},
        'processing': {'matte': 'Whole red field and enclosed bow gaps; decontaminated edges',
                       'spatial': 'Complete frames, single fixed crop/foot/scale; painted scale matches current idle',
                       'temporal': 'One forward attack range; actual release frame annotation; no reverse playback'},
        'idleReference': 'ux/sniper_idle_forward_v2/idle.frames',
        'blend': 'straight RGBA; SRC_ALPHA / ONE_MINUS_SRC_ALPHA',
    }
    DEST.mkdir(parents=True, exist_ok=True)
    atlas.save(DEST / 'attack.png', optimize=True)
    atlas.save(ROOT / 'attack.png', optimize=True)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
    (DEST / 'attack.frames.json').write_text(encoded, encoding='utf-8')
    (ROOT / 'attack.frames.json').write_text(encoded, encoding='utf-8')
    for path, importer, version in [(DEST, 'directory', '1.2.0'), (DEST / 'attack.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path) + '.meta')
        if not meta.exists():
            meta.write_text(json.dumps({'ver': version, 'importer': importer, 'imported': True,
                'uuid': str(uuid.uuid4()), 'files': ['.json'] if importer == 'json' else [],
                'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
    sheet = Image.new('RGB', (7 * 128, 36 + ((len(cells) + 6) // 7) * 164), '#e8ddc4')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), '重弩手 · 完整攻击帧', font=FONT, fill='#293d3e')
    for i, cell in enumerate(cells):
        x, y = i % 7 * 128, 36 + i // 7 * 164
        thumb = cell.resize((128, 144), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y), thumb)
        draw.text((x + 6, y + 144), f'{i:02d}' + (' RELEASE' if i == release else ''), font=FONT, fill='#47565a')
    sheet.save(ROOT / 'contact-sheet.jpg', quality=94)
    previews(cells, manifest, idle)
    report = {'frames': len(cells), 'releaseIndex': release, 'sourceReleaseFrame': args.release,
              'sourceSize': info['size'], 'sourceFps': info['fps'], 'sourceSeconds': len(original) / info['fps'],
              'atlas': list(atlas.size), 'atlasBytes': (DEST / 'attack.png').stat().st_size,
              'displayHeight': manifest['displayHeight'], 'paintedHeight': manifest['readyHeightPx'],
              'groundAnchor': list(GROUND), 'resource': str(DEST.relative_to(GAME)),
              'review': 'Source frame annotation for production; effect acceptance by user; no tests, browser, game or online QA'}
    (ROOT / 'packaging.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
