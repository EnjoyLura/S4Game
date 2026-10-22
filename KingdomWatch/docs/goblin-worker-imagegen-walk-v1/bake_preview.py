"""Split the image-generated walk sheet. No rigging, warping or generated in-betweens."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median
from zipfile import ZIP_DEFLATED, ZipFile

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
SIZE = 512
BASELINE = 470
DURATION_MS = 100


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def visible_box(image: Image.Image):
    return image.getchannel('A').point(lambda v: 255 if v > 64 else 0).getbbox()


def head_axis(image: Image.Image, box) -> float:
    # The green upper head is a stable horizontal anchor, independent of axe swing.
    rgba = np.asarray(image).astype(np.float32)
    lo = int(box[1] + (box[3] - box[1]) * .08)
    hi = int(box[1] + (box[3] - box[1]) * .36)
    area = rgba[lo:hi]
    red, green, blue, alpha = (area[:, :, i] for i in range(4))
    selected = (alpha > 128) & (green > 45) & (green > red * 1.04) & (green > blue * 1.18)
    _, x = np.nonzero(selected)
    return float(np.mean(x)) if x.size else (box[0] + box[2]) / 2


def composite(image: Image.Image, scale: float, axis: float, bottom: int):
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    offset = (round(SIZE / 2 - axis * scale), round(BASELINE - bottom * scale))
    frame = Image.new('RGBA', (SIZE, SIZE))
    frame.alpha_composite(resized, offset)
    return frame, offset


def backdrop(frame: Image.Image, color=(232, 224, 205)) -> Image.Image:
    bg = Image.new('RGBA', frame.size, color + (255,))
    bg.alpha_composite(frame)
    return bg.convert('RGB')


def gif(images: list[Image.Image], path: Path):
    # One shared palette avoids a changing palette adding artificial flicker.
    board = Image.new('RGB', (images[0].width * 4, images[0].height * 2))
    for i, im in enumerate(images):
        board.paste(im, ((i % 4) * im.width, (i // 4) * im.height))
    palette = board.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    indexed = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]
    indexed[0].save(path, save_all=True, append_images=indexed[1:], duration=DURATION_MS,
                    loop=0, optimize=False, disposal=2)


sheet = Image.open(ROOT / 'generated-sheet-original.png').convert('RGBA')
edges_x = [round(i * sheet.width / 4) for i in range(5)]
edges_y = [round(i * sheet.height / 2) for i in range(3)]
correction_path = ROOT / 'generated-sheet-correction.png'
correction = Image.open(correction_path).convert('RGBA') if correction_path.exists() else None
cells, records = [], []
for i in range(8):
    col, row = i % 4, i // 4
    rect = (edges_x[col], edges_y[row], edges_x[col + 1], edges_y[row + 1])
    source_image = 'generated-sheet-original.png'
    if correction is not None and i in (5, 6):
        rect = (round(col * correction.width / 4), round(row * correction.height / 2),
                round((col + 1) * correction.width / 4), round((row + 1) * correction.height / 2))
        cell = correction.crop(rect)
        source_image = 'generated-sheet-correction.png'
        # Match the original cell dimensions before applying the one shared export scale.
        cell = cell.resize((edges_x[col + 1] - edges_x[col], edges_y[row + 1] - edges_y[row]), Image.Resampling.LANCZOS)
    else:
        cell = sheet.crop(rect)
    box = visible_box(cell)
    if box is None:
        raise ValueError(f'Empty cell {i}')
    cells.append(cell)
    records.append({'index': i, 'sourceImage': source_image, 'sourceRect': list(rect), 'visibleBounds': list(box), 'headAxis': head_axis(cell, box)})

# All frames use exactly the same scale; only whole-frame translation aligns the sheet.
scale = 420 / max(r['visibleBounds'][3] - r['visibleBounds'][1] for r in records)
frames = []
(ROOT / 'frames').mkdir(exist_ok=True)
for cell, rec in zip(cells, records):
    frame, offset = composite(cell, scale, rec['headAxis'], rec['visibleBounds'][3])
    filename = f"frames/goblin_worker_walk_{rec['index']:02d}.png"
    frame.save(ROOT / filename)
    rec.update({'file': filename, 'translation': list(offset), 'outputBounds': list(visible_box(frame))})
    frames.append(frame)

atlas = Image.new('RGBA', (SIZE * 4, SIZE * 2))
contact = Image.new('RGB', (SIZE * 4, SIZE * 2), '#e8e0cd')
for i, frame in enumerate(frames):
    xy = ((i % 4) * SIZE, (i // 4) * SIZE)
    atlas.alpha_composite(frame, xy)
    contact.paste(backdrop(frame), xy)
    ImageDraw.Draw(contact).text((xy[0] + 18, xy[1] + 14), f'{i + 1:02d}', fill='#25323d', font_size=22)
atlas.save(ROOT / 'goblin-worker-walk-8f.png')
contact.save(ROOT / 'contact-sheet.jpg', quality=92)
gif([backdrop(f) for f in frames], ROOT / 'walk-preview.gif')
frames[0].save(ROOT / 'walk-preview.apng', format='PNG', save_all=True, append_images=frames[1:],
               duration=DURATION_MS, loop=0, disposal=0, blend=0)

original = Image.open(ROOT / 'current-game-portrait.png').convert('RGBA')
box = visible_box(original)
original, _ = composite(original, 420 / (box[3] - box[1]), head_axis(original, box), box[3])
comparison = []
for frame in frames:
    panel = Image.new('RGB', (SIZE * 2, SIZE + 44), '#e8e0cd')
    panel.paste(backdrop(original), (0, 44))
    panel.paste(backdrop(frame), (SIZE, 44))
    draw = ImageDraw.Draw(panel)
    draw.text((22, 14), 'CURRENT GAME ART', fill='#25323d', font_size=18)
    draw.text((SIZE + 22, 14), 'AI-GENERATED WALK / 8 FRAMES', fill='#25323d', font_size=18)
    comparison.append(panel)
gif(comparison, ROOT / 'source-and-walk.gif')

manifest = {
    'name': 'goblin_worker_imagegen_walk_v1',
    'status': 'experimental_preview_not_integrated',
    'method': 'builtin_imagegen_reference_to_8_frame_sprite_sheet',
    'reference': {'atlas': 'assets/resources/ux/battle_mobs_v2.png', 'frame': 'goblin_worker', 'rect': [59, 24, 393, 464]},
    'currentRuntime': {'script': 'assets/scripts/battle/MobAnim.ts', 'atlas': 'battle_mob_anim_v1', 'frame': 'goblin_worker_w0'},
    'generatedOriginal': {'file': 'generated-sheet-original.png', 'size': list(sheet.size), 'sha256': digest(ROOT / 'generated-sheet-original.png')},
    'generationCorrection': ({'file': correction_path.name, 'sha256': digest(correction_path), 'selectedFrameIndices': [5, 6],
                              'purpose': 'opposite leading foot in frames 6 and 7'} if correction is not None else None),
    'grid': {'columns': 4, 'rows': 2, 'readOrder': 'row-major'},
    'animation': {'frameCount': 8, 'fps': 10, 'frameDurationMs': DURATION_MS, 'durationMs': 8 * DURATION_MS, 'loop': True,
                  'order': list(range(8)), 'playback': 'forward-only; no ping-pong; no repeated endpoint'},
    'processing': {'sharedScale': scale, 'canvas': [SIZE, SIZE], 'baseline': BASELINE,
                   'horizontalAnchor': 'upper green head centroid', 'alpha': 'original generated alpha preserved',
                   'poseDeformation': False, 'interpolation': False},
    'atlas': {'file': 'goblin-worker-walk-8f.png', 'size': [SIZE * 4, SIZE * 2],
              'frames': {f'goblin_worker_w{i}': [i % 4 * SIZE, i // 4 * SIZE, SIZE, SIZE] for i in range(8)}},
    'frames': records,
    'notes': ['Generated poses are experimental and need user review.',
              'A sprite sheet may retain frame-to-frame drawing or timing differences.',
              'Only grid extraction, common resizing, whole-frame alignment and encoding were applied.'],
}
manifest['originalGameHashes'] = {p: digest(PROJECT / p) for p in [
    'assets/resources/ux/battle_mobs_v2.png', 'assets/resources/ux/battle_mobs_v2.frames.json',
    'assets/resources/ux/battle_mob_anim_v1.png', 'assets/resources/ux/battle_mob_anim_v1.frames.json',
    'assets/scripts/battle/MobAnim.ts']}
(ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

with ZipFile(ROOT / 'goblin-worker-walk-8f.zip', 'w', ZIP_DEFLATED) as pack:
    for name in ['manifest.json', 'prompt.txt', 'goblin-worker-walk-8f.png', 'generated-sheet-original.png',
                 'current-game-portrait.png', 'current-game-frame.png', 'walk-preview.gif', 'walk-preview.apng',
                 'source-and-walk.gif', 'contact-sheet.jpg', 'index.html', 'README.md', 'bake_preview.py']:
        pack.write(ROOT / name, name)
    for name in ['prompt-correction.txt', 'generated-sheet-correction.png']:
        if (ROOT / name).exists():
            pack.write(ROOT / name, name)
    for rec in records:
        pack.write(ROOT / rec['file'], rec['file'])

with Image.open(ROOT / 'walk-preview.gif') as preview:
    gif_check = {'frameCount': preview.n_frames, 'durationMs': sum((preview.seek(i) or preview.info.get('duration', 0)) for i in range(preview.n_frames))}
report = {'frameCount': len(frames), 'uniquePixelHashes': len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames}),
          'sourceAlphaZeroFraction': sheet.getchannel('A').histogram()[0] / (sheet.width * sheet.height),
          'sourceBoundsSafeAtAlpha64': all(r['visibleBounds'][0] > 0 and r['visibleBounds'][1] > 0 and
              r['visibleBounds'][2] < c.width and r['visibleBounds'][3] < c.height for r, c in zip(records, cells)),
          'gif': gif_check, 'medianOriginalHeight': median(r['visibleBounds'][3] - r['visibleBounds'][1] for r in records),
          'browserOrGameStarted': False, 'visualAnimationApproval': 'pending_user_review'}
(ROOT / 'validation-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
