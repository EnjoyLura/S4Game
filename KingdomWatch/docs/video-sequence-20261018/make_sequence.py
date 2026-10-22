"""Extract the supplied king video. Asset preparation only; no game integration."""
from pathlib import Path
import json, hashlib, shutil, zipfile
import numpy as np
import imageio.v2 as imageio
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = Path('C:/Users/user/Downloads/lens-api-task_n2IefTfJ6jnffKf4AJJr3xDlznfuBVD0.mp4')
FPS = 24
SIZE = (512, 576)
SELECTED = list(range(23, 53))  # 53 closely matches 23; omit the repeated phase.
reader = imageio.get_reader(SOURCE)
frames = [f for f in reader]
reader.close()
assert len(frames) == 56
(ROOT / 'source').mkdir(exist_ok=True)
shutil.copy2(SOURCE, ROOT / 'source' / 'goblin-king-walk-original.mp4')


def matte(f):
    # Remove edge-connected black, preserving dark armour, pupils and outlines.
    dark = np.max(f, axis=2) <= 12
    mask = Image.fromarray((dark * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(mask, (0, 0), 128, thresh=0)
    exterior = np.asarray(mask) == 128
    alpha = Image.fromarray((~exterior * 255).astype(np.uint8))
    # Close narrow leaks along black ink lines; restore one source pixel of edge.
    alpha = alpha.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(.4))
    out = Image.fromarray(f).convert('RGBA')
    out.putalpha(alpha)
    return out


cutouts = [matte(f) for f in frames]
boxes = [im.getchannel('A').point(lambda x: 255 if x > 128 else 0).getbbox() for im in cutouts]
bounds = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
l, t, r, b = bounds
pad = 16
scale = min((SIZE[0] - 2 * pad) / (r - l), (SIZE[1] - 2 * pad) / (b - t))
newsize = (round((r - l) * scale), round((b - t) * scale))
xy = ((SIZE[0] - newsize[0]) // 2, SIZE[1] - pad - newsize[1])
full = ROOT / 'full-56-frames'
loop = ROOT / 'loop-30-frames'
full.mkdir(exist_ok=True)
loop.mkdir(exist_ok=True)
processed = []
for n, im in enumerate(cutouts):
    # Same source rectangle, scale and origin. No pose warping or stabilization.
    canvas = Image.new('RGBA', SIZE)
    canvas.alpha_composite(im.crop(bounds).resize(newsize, Image.Resampling.LANCZOS), xy)
    canvas.save(full / f'goblin_king_source_{n:03d}.png')
    processed.append(canvas)
selected = [processed[n] for n in SELECTED]
atlas = Image.new('RGBA', (SIZE[0] * 6, SIZE[1] * 5))
rects = {}
for k, im in enumerate(selected):
    name = f'goblin_king_w{k:03d}'
    im.save(loop / (name + '.png'))
    x, y = k % 6 * SIZE[0], k // 6 * SIZE[1]
    atlas.alpha_composite(im, (x, y))
    rects[name] = [x, y, *SIZE]
atlas.save(ROOT / 'goblin_king_walk.png')
manifest = {
    'frames': rects,
    'animation': {'name': 'goblin_king_walk', 'loop': True, 'fps': FPS, 'seconds': len(SELECTED) / FPS, 'frameOrder': list(rects), 'frameDurations': [1 / FPS] * len(SELECTED)},
    'cycle': {'seconds': len(SELECTED) / FPS, 'cells': len(SELECTED)},
    'source': {'name': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'size': [1344, 768], 'fps': FPS, 'frameCount': len(frames), 'selectedFramesZeroBased': SELECTED, 'excludedMatchingPhase': 53},
    'layout': {'cellSize': list(SIZE), 'columns': 6, 'rows': 5, 'sourceUnionBounds': list(bounds), 'scale': scale, 'imageOffset': list(xy), 'pivotNormalized': [.5, (SIZE[1] - pad) / SIZE[1]]},
    'processing': {'key': 'edge-connected black <=12 RGB max', 'matteClosingFilterPx': 7, 'matteEdgeExpansionPx': 1, 'matteFeatherSourcePx': .4, 'fixedCropAndScale': True, 'reverse': False, 'interpolation': False, 'crossfade': False}
}
(ROOT / 'goblin_king_walk.frames.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

# Preview uses the exported frames against a light checkerboard.
w, h = SIZE
checker = Image.new('RGB', SIZE)
d = ImageDraw.Draw(checker)
for y in range(0, h, 24):
    for x in range(0, w, 24):
        d.rectangle((x, y, x + 23, y + 23), fill=('#d8d0be' if (x // 24 + y // 24) % 2 == 0 else '#eee6d3'))
preview = [Image.alpha_composite(checker.convert('RGBA'), im).convert('RGB') for im in selected]
pal = Image.fromarray(np.concatenate([np.asarray(im.resize((128, 144))) for im in preview], axis=1)).quantize(colors=255)
gifs = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in preview]
durations = [round((k + 1) * 100 / FPS) * 10 - round(k * 100 / FPS) * 10 for k in range(len(preview))]
gifs[0].save(ROOT / 'goblin-king-walk-preview.gif', save_all=True, append_images=gifs[1:], duration=durations, loop=0, disposal=2, optimize=False)
contact = Image.new('RGB', (6 * 192, 5 * 240), '#e6dece')
d = ImageDraw.Draw(contact)
for k, im in enumerate(selected):
    thumb = im.resize((192, 216), Image.Resampling.LANCZOS)
    x, y = k % 6 * 192, k // 6 * 240
    contact.paste(thumb, (x, y), thumb)
    d.text((x + 6, y + 218), f'{k:02d} / source {SELECTED[k]:02d}', fill='#222222')
contact.save(ROOT / 'loop-contact-sheet.jpg', quality=94)
seam = Image.new('RGB', (4 * 256, 310), '#e6dece')
d = ImageDraw.Draw(seam)
for k, idx in enumerate([51, 52, 23, 24]):
    thumb = processed[idx].resize((256, 288), Image.Resampling.LANCZOS)
    seam.paste(thumb, (k * 256, 0), thumb)
    d.text((k * 256 + 8, 290), f'source {idx}', fill='#222222')
seam.save(ROOT / 'loop-seam.jpg', quality=94)
readme = '''# 哥布林王行走序列帧

用户视频：1344×768，24fps，56帧，约2.33秒。

推荐循环：原视频第23–52帧（从0计数，第24–53张），共30帧，24fps，1.25秒；对应约0.9583–2.2083秒。第53帧与第23帧姿态接近，作为端点参考而不重复导出到循环。按连续原始时间前进，不倒放、不补画、不混合首尾。

- `loop-30-frames/`：30张RGBA透明PNG，每张512×576。
- `goblin_king_walk.png`：6列5行图集，3072×2880，格子512×576。
- `goblin_king_walk.frames.json`：帧坐标、顺序、24fps、源帧索引、共同裁剪与锚点。
- `goblin-king-walk-preview.gif`：按相同PNG制作的循环预览，浅色棋盘背景；GIF计时精度10ms，游戏使用JSON中的24fps。
- `loop-seam.jpg`：循环前后四帧对照（源51、52、23、24）。
- `full-56-frames/`：保留整段56张透明帧，源顺序，方便另选片段；整段不保证首尾循环。
- `source/goblin-king-walk-original.mp4`：原视频副本。
- `make_sequence.py`：本次处理脚本。

抠除与画面外边缘连通的黑色背景（RGB最大通道≤12），用7像素闭运算补回深色描边的细缝，再扩边1像素和羽化0.4像素；这些参数作用于原视频尺寸，仅处理透明度，保留角色内部暗部。统一联合裁剪、固定缩放及位置，不逐帧缩放、移动或拉伸；脚步和披风保留原视频运动。AI视频自身仍有轻微形变和步态差异，挑选相近相位只能减少硬跳，不能保证完全无缝。未替换游戏资源，未构建发布；先由用户查看素材。
'''
(ROOT / 'README.md').write_text(readme, encoding='utf-8')
with zipfile.ZipFile(ROOT / 'goblin-king-walk-30f.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(loop.glob('*.png')):
        z.write(p, p.relative_to(ROOT))
    for name in ['README.md', 'goblin_king_walk.png', 'goblin_king_walk.frames.json', 'goblin-king-walk-preview.gif', 'loop-contact-sheet.jpg', 'loop-seam.jpg']:
        z.write(ROOT / name, name)
print(json.dumps({'frames': len(selected), 'seconds': len(selected) / FPS, 'sourceBounds': bounds, 'scale': scale, 'zipBytes': (ROOT / 'goblin-king-walk-30f.zip').stat().st_size}, indent=2))
