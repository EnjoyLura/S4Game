"""Package all fire-mage source frames with one green key, uniform scale and fixed foot."""
from pathlib import Path
import hashlib
import json
import sys
import uuid
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
from prepare_source import key_green

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
DEST = GAME / 'assets/resources/ux/pyro_attack_user_v1'
sys.path.insert(0, str(GAME / 'docs/hero-stance-rebuild-v1'))
from package_frames import boot_pivot
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import bounds, draw_frame
sys.path.insert(0, str(GAME / 'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from hero_frame_bounds import require_source_margin

CELL, GROUND, COLS = (512, 512), (256, 496), 8
PAINTED_HEIGHT, DISPLAY_HEIGHT, RELEASE = 468.0, 146, 14
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    reader = imageio_ffmpeg.read_frames(str(ROOT / 'source.mp4'), pix_fmt='rgb24')
    info = next(reader)
    original = [Image.frombytes('RGB', info['size'], raw) for raw in reader]
    keyed, fields = [], []
    rgba_dir = ROOT / 'rgba-frames'
    rgba_dir.mkdir(exist_ok=True)
    for i, image in enumerate(original):
        rgba, background = key_green(image)
        rgba.save(rgba_dir / f'frame-{i:02d}.png')
        keyed.append(rgba)
        fields.append(background)
    framing = require_source_margin(keyed, list(range(len(keyed))))
    boxes = [bounds(frame) for frame in keyed]
    foot = boot_pivot(keyed[0], boxes[0])
    scale = PAINTED_HEIGHT / (foot[1] - boxes[0][1])
    crop = [max(0, min(b[0] for b in boxes)-4), max(0, min(b[1] for b in boxes)-4),
            min(info['size'][0], max(b[2] for b in boxes)+4),
            min(info['size'][1], max(b[3] for b in boxes)+4)]
    left, top, right, bottom = crop
    dw, dh = round((right-left)*scale), round((bottom-top)*scale)
    tx, ty = round(GROUND[0]-(foot[0]-left)*scale), round(GROUND[1]-(foot[1]-top)*scale)
    if tx < 0 or ty < 0 or tx+dw > CELL[0] or ty+dh > CELL[1]:
        raise RuntimeError('The full shared-scale source exceeds its cell; do not crop the character')
    atlas = Image.new('RGBA', (COLS*CELL[0], ((len(keyed)+COLS-1)//COLS)*CELL[1]))
    frame_dir = ROOT / 'frames'
    frame_dir.mkdir(exist_ok=True)
    cells, rects = [], {}
    for i, source in enumerate(keyed):
        cell = Image.new('RGBA', CELL)
        cell.alpha_composite(source.crop(crop).resize((dw, dh), Image.Resampling.LANCZOS), (tx, ty))
        cell.save(frame_dir / f'attack-{i:02d}.png')
        x, y = i % COLS*CELL[0], i // COLS*CELL[1]
        atlas.paste(cell, (x, y))
        rects[f'attack{i}'] = [x, y, *CELL]
        cells.append(cell)
    duration = 1/info['fps']
    manifest = {'hero': 'pyro', 'frames': rects,
        'animation': {'frames': [f'attack{i}' for i in range(len(cells))],
            'seconds': len(cells)*duration, 'frameDurations': [duration]*len(cells), 'loop': False,
            'releaseIndex': RELEASE, 'readyIndex': len(cells)-1,
            'recoverySeconds': (len(cells)-RELEASE)*duration},
        'groundAnchor': list(GROUND), 'cellSize': list(CELL), 'readyHeightPx': PAINTED_HEIGHT,
        'displayHeight': DISPLAY_HEIGHT, 'sourceOrder': list(range(len(cells))),
        'source': {'file': 'source.mp4', 'sha256': hashlib.sha256((ROOT/'source.mp4').read_bytes()).hexdigest(),
            'videoSize': list(info['size']), 'fps': info['fps'], 'frameCount': len(cells),
            'indices': list(range(len(cells))), 'omittedEffectsFrames': [], 'jointCrop': crop,
            'fixedScale': scale, 'fixedFootSource': foot, 'greenFieldPerFrame': fields,
            'releaseFrame': RELEASE},
        'sourceFraming': framing, 'userProvidedVideo': True, 'fullSourceRequired': True,
        'allSourceFramesRetained': True, 'reversePlayback': False,
        'gameIntegrated': False, 'previewOnly': True, 'animationAcceptedByUser': False,
        'staticMasterAcceptedByUser': False,
        'processing': {'matte': 'Green dominance coverage, screen decontamination, mixed-edge green spill suppression; red/gold surfaces and dark ink retained',
            'spatial': 'One crop, one uniform scale, one boot pivot spanning the complete source; no per-frame normalization or part deformation',
            'temporal': 'All source frames in chronological order; no omissions, reversal, crossfade or synthetic holds'},
        'blend': 'straight RGBA; single full-opacity sprite',
        'actionPhases': [{'name': 'prepare', 'sourceFrames': [0, 9]},
            {'name': 'staff-forward', 'sourceFrames': [10, 16]},
            {'name': 'forward-pose', 'sourceFrames': [17, 29]},
            {'name': 'return', 'sourceFrames': [30, 42]},
            {'name': 'settle', 'sourceFrames': [43, len(cells)-1]}]}
    DEST.mkdir(parents=True, exist_ok=True)
    for directory in [ROOT, DEST]:
        atlas.save(directory / 'attack.png', optimize=True)
        write(directory / 'attack.frames.json', manifest)
    for path, importer, version in [(DEST, 'directory', '1.2.0'), (DEST/'attack.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path)+'.meta')
        if not meta.exists():
            write(meta, {'ver': version, 'importer': importer, 'imported': True, 'uuid': str(uuid.uuid4()),
                'files': ['.json'] if importer == 'json' else [], 'subMetas': {}, 'userData': {}})
    cells[0].save(ROOT / 'ready.png')
    ready = {'hero': 'pyro', 'frames': {'ready': [0, 0, *CELL]},
        'animation': {'frames': ['ready'], 'seconds': 1, 'loop': True},
        'groundAnchor': list(GROUND), 'cellSize': list(CELL),
        'readyHeightPx': PAINTED_HEIGHT, 'displayHeight': DISPLAY_HEIGHT,
        'source': {'file': 'source.mp4', 'sourceFrame': 0},
        'isStaticReference': True, 'isIdleAnimation': False, 'gameIntegrated': False}
    write(ROOT / 'ready.frames.json', ready)
    timeline = [(cells[0], .6)] + [(cell, duration) for cell in cells] + [(cells[0], .6)]
    images, durations = [], []
    for cell, seconds in timeline:
        canvas = Image.new('RGBA', (840, 510), '#293c3b')
        draw = ImageDraw.Draw(canvas)
        draw.text((20, 10), '火法师 · 站姿与攻击 / 镜像', font=FONT, fill='#eef1e4')
        for x, mirrored in [(210, False), (630, True)]:
            draw.line((x-195, 486, x+195, 486), fill='#4a6158', width=1)
            draw_frame(canvas, cell, manifest, x, 486, 380, mirrored)
        images.append(canvas.convert('RGB'))
        durations.append(seconds)
    save_gif(images, ROOT/'attack-mirror.gif', sum(durations), durations)
    sheet = Image.new('RGB', (7*128, 36+((len(cells)+6)//7)*148), '#e8ddc4')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), '火法师 · 完整攻击序列', font=FONT, fill='#293c3b')
    for i, cell in enumerate(cells):
        x, y = i % 7*128, 36+i // 7*148
        thumb = cell.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y), thumb)
        draw.text((x+6, y+128), f'{i:02d}', font=FONT, fill='#47565a')
    sheet.save(ROOT/'contact-sheet.jpg', quality=94)
    report = {'hero': 'pyro', 'resource': DEST.name, 'frames': len(cells), 'sourceFrames': len(original),
        'seconds': len(cells)*duration, 'fps': info['fps'], 'atlas': list(atlas.size),
        'atlasBytes': (ROOT/'attack.png').stat().st_size, 'paintedHeight': PAINTED_HEIGHT,
        'displayHeight': DISPLAY_HEIGHT, 'groundAnchor': list(GROUND),
        'allSourceFramesRetained': True, 'reversePlayback': False, 'gameIntegrated': False,
        'previewOnly': True, 'userVisualAccepted': False, 'paidTaskSubmitted': False,
        'idleVideoReceived': False, 'readyReference': 'Static first attack frame, explicitly not an idle animation',
        'review': 'Source material production only; user reviews effects; no tests, gameplay, browser or online QA'}
    write(ROOT/'packaging.json', report)
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    main()
