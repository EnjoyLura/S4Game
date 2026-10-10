"""Pack generated artwork and composite an offline review; no game edits.

ImageGen provides all painted frames. This script only extracts, registers,
packs, and alpha-composites them. No procedural replacement VFX are drawn.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
source = Image.open(OUT / 'sequence-draft-1.png').convert('RGBA')
cuts = [round(i * source.width / 4) for i in range(5)]
# Ground-plane registration, independent of changing vapor/shard extents.
# Coordinates use the source cell, top-left origin. No per-frame resizing.
pivots = [(173, 200), (160, 199), (163, 205), (152, 197),
          (177, 188), (171, 188), (160, 188), (156, 188),
          (177, 188), (167, 188), (160, 188), (158, 188),
          (178, 165), (168, 165), (162, 165), (155, 165)]
CELL = 384
ANCHOR = (192, 220)
scale = 1.0
frames = []
(OUT / 'frames').mkdir(exist_ok=True)
entries = []
for k in range(16):
    x, y = k % 4, k // 4
    box = (cuts[x], cuts[y], cuts[x+1], cuts[y+1])
    frame = source.crop(box)
    # First-row neighboring chips overlap the generator's nominal gutters.
    # Exclude that narrow shared gutter during frame extraction.
    if k == 2:
        frame = frame.crop((0, 0, 307, frame.height))
    if k == 3:
        frame = frame.crop((12, 0, frame.width, frame.height))
    pivot = pivots[k]
    shift_x = 12 if k == 3 else 0
    canvas = Image.new('RGBA', (CELL, CELL))
    if k != 15:  # End cel is explicitly empty, discarding sub-visible matte noise.
        offset = (ANCHOR[0] - pivot[0] + shift_x, ANCHOR[1] - pivot[1])
        canvas.alpha_composite(frame, offset)
    canvas.save(OUT / 'frames' / f'frost-{k+1:02d}.png')
    frames.append(canvas)
    entries.append({'name': f'frost-{k+1:02d}',
                    'rect': [x*CELL, y*CELL, CELL, CELL],
                    'sourceRect': list(box), 'sourceGroundPivot': list(pivot)})

atlas = Image.new('RGBA', (CELL*4, CELL*4))
for k, frame in enumerate(frames):
    atlas.alpha_composite(frame, (k % 4 * CELL, k // 4 * CELL))
atlas.save(OUT / 'frost-domain-sequence.png')

# Open in 0.20 s; animate the persistent geometry through 1.50 s;
# then fracture and dissipate. Two actual wind cycles are used in the hold.
timeline = [(k, .05) for k in range(4)]
timeline += [(k, .10) for _ in range(2) for k in range(4, 10)]
timeline += [(4, .10)]
timeline += list(zip(range(10, 16), (.08, .08, .10, .12, .12, .18)))
metadata = {'version': 5, 'status': 'preview-awaiting-user-review',
            'generator': 'built-in imagegen', 'frameCount': 16,
            'atlas': 'frost-domain-sequence.png', 'grid': [4, 4],
            'cellSize': [CELL, CELL], 'alpha': 'straight/native generated alpha',
            'anchorTopLeft': [ANCHOR[0]/CELL, ANCHOR[1]/CELL],
            'anchorCocos': [ANCHOR[0]/CELL, 1-ANCHOR[1]/CELL],
            'freezeSeconds': 1.5, 'thawSeconds': .68,
            'blendSeconds': .04,
            'timeline': [{'frame': k+1, 'duration': t} for k,t in timeline],
            'frames': entries}
(OUT / 'frost-domain-sequence.json').write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')

font_path = 'C:/Windows/Fonts/msyh.ttc'
font = ImageFont.truetype(font_path, 17)
small = ImageFont.truetype(font_path, 14)
sheet = Image.new('RGB', (4*256, 4*280+56), '#232f36')
draw = ImageDraw.Draw(sheet)
draw.text((18, 12), '冰领域 · 16 帧序列  /  结冰 → 寒气流动 → 碎裂消散', font=font, fill='#d9eef4')
labels = ['中心闪光', '冰霜扩散', '冰晶生长', '冻结爆发',
          '持续 01', '持续 02', '持续 03', '持续 04',
          '持续 05', '持续 06', '开始碎裂', '冰晶破碎',
          '碎冰散开', '寒气消退', '余光', '完全消失']
for k, frame in enumerate(frames):
    tile = Image.new('RGBA', (256, 256), '#34434a')
    tile.alpha_composite(frame.resize((256, 256), Image.Resampling.LANCZOS))
    tx, ty = k%4*256, 56+k//4*280
    sheet.paste(tile.convert('RGB'), (tx, ty))
    draw.text((tx+12, ty+258), f'{k+1:02d}  {labels[k]}', font=small, fill='#d9eef4')
sheet.save(OUT / 'contact-sheet.jpg', quality=94)

# Use a cropped ground texture, with no browser or live battle capture.
floor = Image.open(ROOT / 'assets/resources/scenes/scene_1_1.png').convert('RGB')
floor = floor.crop((90, 600, 1060, 1376)).resize((640, 512), Image.Resampling.LANCZOS)
preview_scale = 1.12
preview_frames = [im.resize((round(CELL*preview_scale),)*2, Image.Resampling.LANCZOS)
                  for im in frames]
center = (320, 282)
offset = (round(center[0]-ANCHOR[0]*preview_scale),
          round(center[1]-ANCHOR[1]*preview_scale))

def compose(frame):
    canvas = floor.convert('RGBA')
    canvas.alpha_composite(frame, offset)
    return canvas.convert('RGB')

def animated(sample):
    age = sample - .26
    if age < 0 or age >= 2.18:
        return floor.copy()
    end = 0
    previous = Image.new('RGBA', preview_frames[0].size)
    for idx, duration in timeline:
        start, end = end, end+duration
        if age < end:
            current = preview_frames[idx]
            # A brief adjacent-cel alpha blend is part of the proposed playback.
            blend = min(1, (age-start)/min(.04, duration))
            return compose(Image.blend(previous, current, blend))
        previous = preview_frames[idx]
    return floor.copy()

samples = [animated(k*.02) for k in range(148)]
# Shared palette avoids palette flicker; JPEG/PNG keyframes retain full color.
palette_source = Image.new('RGB', (1280, 1024))
for k, t in enumerate((.40, .65, 1.84, 2.16)):
    palette_source.paste(animated(t), (k%2*640, k//2*512))
palette = palette_source.quantize(colors=256)
gif_frames = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in samples]
gif_frames[0].save(OUT / 'frost-domain-preview.gif', save_all=True,
                   append_images=gif_frames[1:], duration=20, loop=0, optimize=True)
compose(preview_frames[4]).save(OUT / 'frost-domain-preview.png')

review = Image.new('RGB', (1280, 1080), '#232f36')
d = ImageDraw.Draw(review)
for k, (t, title) in enumerate(((.44, '冻结爆发'), (.90, '持续寒气'),
                               (1.90, '碎冰消散'), (2.42, '效果结束'))):
    x,y = k%2*640, k//2*540
    review.paste(animated(t), (x,y))
    d.text((x+15,y+516), title, font=font, fill='#d9eef4')
review.save(OUT / 'preview-keyframes.jpg', quality=94)

checks = {'sourceSize': list(source.size), 'atlasSize': list(atlas.size),
          'nativeAlphaPreserved': True, 'frameCount': len(frames),
          'lastFrameEmpty': frames[-1].getbbox() is None,
          'allFramesInsidePadding': all(
              not f.getchannel('A').crop((0,0,CELL,1)).getbbox() and
              not f.getchannel('A').crop((0,CELL-1,CELL,CELL)).getbbox() and
              not f.getchannel('A').crop((0,0,1,CELL)).getbbox() and
              not f.getchannel('A').crop((CELL-1,0,CELL,CELL)).getbbox()
              for f in frames),
          'previewKind': 'offline art composite; no live battle inspection',
          'gameIntegrated': False}
(OUT / 'validation.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
assert checks['lastFrameEmpty'] and checks['allFramesInsidePadding']
print(json.dumps(checks))
print(OUT / 'frost-domain-preview.gif')
