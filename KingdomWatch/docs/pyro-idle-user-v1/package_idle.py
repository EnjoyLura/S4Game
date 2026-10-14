"""Package the complete user idle, paired to the existing fire-mage attack geometry."""
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
DEST = GAME / 'assets/resources/ux/pyro_idle_user_v1'
sys.path.insert(0, str(GAME / 'docs/hero-stance-rebuild-v1'))
from package_frames import boot_pivot
# The current script shares a name with the historical helper: import it by path.
import importlib.util
spec = importlib.util.spec_from_file_location('volt_idle_helpers', GAME/'docs/volt-idle-v1/package_idle.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
bounds, draw_frame = helper.bounds, helper.draw_frame
sys.path.insert(0, str(GAME / 'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from hero_frame_bounds import require_source_margin
from hero_idle_loop import idle_loop_timeline

CELL, GROUND, COLS = (512, 512), (256, 496), 8
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    attack_dir = GAME / 'assets/resources/ux/pyro_attack_user_v1'
    attack = json.loads((attack_dir/'attack.frames.json').read_text(encoding='utf-8'))
    reader = imageio_ffmpeg.read_frames(str(ROOT/'source.mp4'), pix_fmt='rgb24')
    info = next(reader)
    original = [Image.frombytes('RGB', info['size'], data) for data in reader]
    keyed, fields = [], []
    rgba_dir, frame_dir = ROOT/'rgba-frames', ROOT/'frames'
    rgba_dir.mkdir(exist_ok=True)
    frame_dir.mkdir(exist_ok=True)
    for i, image in enumerate(original):
        rgba, background = key_green(image)
        rgba.save(rgba_dir/f'frame-{i:02d}.png')
        keyed.append(rgba)
        fields.append(background)
    framing = require_source_margin(keyed, list(range(len(keyed))))
    boxes = [bounds(frame) for frame in keyed]
    foot = boot_pivot(keyed[0], boxes[0])
    painted = attack['readyHeightPx']
    scale = painted/(foot[1]-boxes[0][1])
    crop = [max(0, min(b[0] for b in boxes)-4), max(0, min(b[1] for b in boxes)-4),
            min(info['size'][0], max(b[2] for b in boxes)+4),
            min(info['size'][1], max(b[3] for b in boxes)+4)]
    left, top, right, bottom = crop
    dw, dh = round((right-left)*scale), round((bottom-top)*scale)
    tx, ty = round(GROUND[0]-(foot[0]-left)*scale), round(GROUND[1]-(foot[1]-top)*scale)
    if tx < 0 or ty < 0 or tx+dw > CELL[0] or ty+dh > CELL[1]:
        raise RuntimeError('Complete shared-scale source does not fit; never clip the hero')
    atlas = Image.new('RGBA', (COLS*CELL[0], ((len(keyed)+COLS-1)//COLS)*CELL[1]))
    if max(atlas.size) > 4096:
        raise RuntimeError('Use pages instead of exceeding the device texture limit')
    cells, rects = [], {}
    for i, source in enumerate(keyed):
        cell = Image.new('RGBA', CELL)
        cell.alpha_composite(source.crop(crop).resize((dw, dh), Image.Resampling.LANCZOS), (tx, ty))
        cell.save(frame_dir/f'idle-{i:02d}.png')
        x, y = i % COLS*CELL[0], i // COLS*CELL[1]
        atlas.paste(cell, (x, y))
        rects[f'idle{i}'] = [x, y, *CELL]
        cells.append(cell)
    seconds = len(cells)/info['fps']
    order, durations, contract = idle_loop_timeline(len(cells), seconds)
    manifest = {'hero': 'pyro', 'frames': rects,
        'animation': {'frames': [f'idle{i}' for i in order], 'seconds': seconds,
                      'frameDurations': durations, 'loop': True},
        'groundAnchor': list(GROUND), 'cellSize': list(CELL), 'readyHeightPx': painted,
        'displayHeight': attack['displayHeight'], 'sourceOrder': order,
        'source': {'file': 'source.mp4', 'sha256': hashlib.sha256((ROOT/'source.mp4').read_bytes()).hexdigest(),
            'videoSize': list(info['size']), 'fps': info['fps'], 'frameCount': len(cells),
            'indices': order, 'jointCrop': crop, 'fixedScale': scale, 'fixedFootSource': foot,
            'greenFieldPerFrame': fields},
        'sourceFraming': framing, 'userProvidedVideo': True, 'fullSourceRequired': True,
        'allSourceFramesRetained': True, 'reversePlayback': False, 'loopContract': contract,
        'gameIntegrated': True, 'previewOnly': False, 'animationAcceptedByUser': False,
        'attackReference': 'ux/pyro_attack_user_v1/attack.frames',
        'processing': {'matte': 'Same green dominance coverage and screen decontamination as the paired attack',
            'spatial': 'One joint crop, one uniform scale, one fixed boot pivot; same canonical height and ground as attack',
            'temporal': 'Complete native forward cycle at 24fps; no reversed cloth, omitted frames, synthetic holds or crossfade'},
        'blend': 'straight RGBA; single full-opacity sprite'}
    DEST.mkdir(parents=True, exist_ok=True)
    for directory in [ROOT, DEST]:
        atlas.save(directory/'idle.png', optimize=True)
        write(directory/'idle.frames.json', manifest)
    for path, importer, version in [(DEST, 'directory', '1.2.0'), (DEST/'idle.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path)+'.meta')
        if not meta.exists():
            write(meta, {'ver': version, 'importer': importer, 'imported': True, 'uuid': str(uuid.uuid4()),
                'files': ['.json'] if importer == 'json' else [], 'subMetas': {}, 'userData': {}})
    previews = []
    for cell in cells:
        canvas = Image.new('RGBA', (840, 510), '#293c3b')
        draw = ImageDraw.Draw(canvas)
        draw.text((20, 10), '火法师 · 完整待机 / 镜像', font=FONT, fill='#eef1e4')
        for x, mirrored in [(210, False), (630, True)]:
            draw.line((x-195, 486, x+195, 486), fill='#4a6158', width=1)
            draw_frame(canvas, cell, manifest, x, 486, 380, mirrored)
        previews.append(canvas.convert('RGB'))
    save_gif(previews, ROOT/'idle-mirror.gif', seconds, durations)
    attack_atlas = Image.open(attack_dir/'attack.png').convert('RGBA')
    phases = [(cells[i], manifest, durations[i]) for i in order]
    for name, duration in zip(attack['animation']['frames'], attack['animation']['frameDurations']):
        x, y, w, h = attack['frames'][name]
        phases.append((attack_atlas.crop((x, y, x+w, y+h)), attack, duration))
    comparison, comparison_durations = [], []
    for cell, meta, duration in phases:
        canvas = Image.new('RGBA', (840, 510), '#293c3b')
        ImageDraw.Draw(canvas).text((20, 10), '火法师 · 待机 → 完整攻击 / 镜像', font=FONT, fill='#eef1e4')
        draw_frame(canvas, cell, meta, 210, 486, 380)
        draw_frame(canvas, cell, meta, 630, 486, 380, True)
        comparison.append(canvas.convert('RGB'))
        comparison_durations.append(duration)
    save_gif(comparison, ROOT/'idle-attack-mirror.gif', sum(comparison_durations), comparison_durations)
    sheet = Image.new('RGB', (7*128, 36+((len(cells)+6)//7)*148), '#e8ddc4')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), '火法师 · 完整正向待机', font=FONT, fill='#293c3b')
    for i, cell in enumerate(cells):
        x, y = i % 7*128, 36+i // 7*148
        thumb = cell.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y), thumb)
        draw.text((x+6, y+128), f'{i:02d}', font=FONT, fill='#47565a')
    sheet.save(ROOT/'contact-sheet.jpg', quality=94)
    report = {'hero': 'pyro', 'resource': DEST.name, 'frames': len(cells), 'sourceFrames': len(original),
        'seconds': seconds, 'fps': info['fps'], 'atlas': list(atlas.size),
        'paintedHeight': painted, 'displayHeight': attack['displayHeight'], 'groundAnchor': list(GROUND),
        'attackResource': 'pyro_attack_user_v1', 'allSourceFramesRetained': True,
        'reversePlayback': False, 'gameIntegrated': True, 'previewOnly': False,
        'userVisualAccepted': False, 'paidTaskSubmitted': False,
        'review': 'Source material preparation; effect review by user; no tests, gameplay, browser or online QA'}
    write(ROOT/'packaging.json', report)
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    main()
