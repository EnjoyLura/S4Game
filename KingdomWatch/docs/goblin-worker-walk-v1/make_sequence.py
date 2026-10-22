"""Prepare the user's front-walking worker clip, without modifying game assets."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile
import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SOURCE = Path('C:/Users/user/Downloads/生成4秒行走视频.mp4')
SIZE = (512, 576)
START, END = 27, 51  # Zero-based, end exclusive; 51 is the matching-phase reference.
reader = imageio.get_reader(SOURCE)
meta = reader.get_meta_data()
frames = [f for f in reader]
reader.close()
FPS = float(meta['fps'])
indices = list(range(START, END))
(ROOT / 'source').mkdir(exist_ok=True)
shutil.copy2(SOURCE, ROOT / 'source' / 'goblin-worker-original.mp4')


def matte(frame):
    rgb = frame.astype(np.float32)
    # Green skin, brown clothing, grey axe and black ink all have low blue excess.
    excess = rgb[:, :, 2] - np.maximum(rgb[:, :, 0], rgb[:, :, 1])
    alpha = np.clip((85.0 - excess) / 70.0, 0, 1)
    # Exclude source overlay in the empty margin, below/outside all character pixels.
    alpha[:35] = 0
    alpha[665:] = 0
    alpha[:, :25] = 0
    alpha[:, 640:] = 0
    # Despill only blue-dominant edge colour; preserve interior grey/black ink.
    rgb[:, :, 2] = np.minimum(rgb[:, :, 2], np.maximum(rgb[:, :, 0], rgb[:, :, 1]) + 10)
    rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.rint(alpha * 255).astype(np.uint8)])
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba)


# Include neighbouring seam frames when computing ONE fixed crop and transform.
needed = sorted(set(indices + [START - 1, END, END + 1]))
cutouts = {idx: matte(frames[idx]) for idx in needed}
boxes = [im.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox() for im in cutouts.values()]
bounds = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
l, t, r, b = bounds
pad = 16
scale = min((SIZE[0] - 2 * pad) / (r - l), (SIZE[1] - 2 * pad) / (b - t))
newsize = (round((r - l) * scale), round((b - t) * scale))
offset = ((SIZE[0] - newsize[0]) // 2, SIZE[1] - pad - newsize[1])
processed = {}
for idx, im in cutouts.items():
    canvas = Image.new('RGBA', SIZE)
    canvas.alpha_composite(im.crop(bounds).resize(newsize, Image.Resampling.LANCZOS), offset)
    processed[idx] = canvas

loop = ROOT / 'loop-24-frames'
loop.mkdir(exist_ok=True)
cols, rows = 6, 4
atlas = Image.new('RGBA', (SIZE[0] * cols, SIZE[1] * rows))
rects = {}
for k, idx in enumerate(indices):
    name = f'goblin_worker_w{k:03d}'
    im = processed[idx]
    im.save(loop / (name + '.png'))
    x, y = k % cols * SIZE[0], k // cols * SIZE[1]
    atlas.alpha_composite(im, (x, y))
    rects[name] = [x, y, *SIZE]
atlas.save(ROOT / 'goblin_worker_walk.png')

manifest = {
    'frames': rects,
    'animation': {'name': 'goblin_worker_walk', 'loop': True, 'fps': FPS, 'seconds': len(indices) / FPS, 'frameOrder': list(rects), 'frameDurations': [1 / FPS] * len(indices)},
    'cycle': {'seconds': len(indices) / FPS, 'cells': len(indices)},
    'source': {'name': SOURCE.name, 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'size': list(meta['size']), 'fps': FPS, 'frameCount': len(frames), 'selectedFramesZeroBased': indices, 'startSeconds': START / FPS, 'endSecondsExclusive': END / FPS, 'matchingPhaseReference': END},
    'layout': {'cellSize': list(SIZE), 'columns': cols, 'rows': rows, 'sourceUnionBounds': list(bounds), 'scale': scale, 'imageOffset': list(offset), 'pivotNormalized': [.5, (SIZE[1] - pad) / SIZE[1]]},
    'processing': {'key': 'blue excess B-max(R,G), soft transition 15..85', 'blueDespillMaxExcess': 10, 'sourceRoi': [25, 35, 640, 665], 'fixedCropAndScale': True, 'reverse': False, 'crossfade': False, 'generatedFrames': False}
}
(ROOT / 'goblin_worker_walk.frames.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

checker = Image.new('RGB', SIZE)
d = ImageDraw.Draw(checker)
for y in range(0, SIZE[1], 24):
    for x in range(0, SIZE[0], 24):
        d.rectangle((x, y, x + 23, y + 23), fill=('#d8d0be' if (x // 24 + y // 24) % 2 == 0 else '#eee6d3'))
preview = [Image.alpha_composite(checker.convert('RGBA'), Image.open(loop / f'goblin_worker_w{k:03d}.png')).convert('RGB') for k in range(len(indices))]
palette = Image.fromarray(np.concatenate([np.asarray(im.resize((128, 144))) for im in preview], axis=1)).quantize(colors=255)
gifs = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in preview]
durations = [round((k + 1) * 100 / FPS) * 10 - round(k * 100 / FPS) * 10 for k in range(len(indices))]
gifs[0].save(ROOT / 'goblin-worker-walk-preview.gif', save_all=True, append_images=gifs[1:], duration=durations, loop=0, disposal=2, optimize=False)

contact = Image.new('RGB', (cols * 192, rows * 240), '#e6dece')
d = ImageDraw.Draw(contact)
for k, idx in enumerate(indices):
    im = processed[idx].resize((192, 216), Image.Resampling.LANCZOS)
    x, y = k % cols * 192, k // cols * 240
    contact.paste(im, (x, y), im)
    d.text((x + 6, y + 218), f'{k:02d} / source {idx:02d}', fill='#222222')
contact.save(ROOT / 'loop-contact-sheet.jpg', quality=94)
seam = Image.new('RGB', (256 * 5, 310), '#e6dece')
d = ImageDraw.Draw(seam)
for k, idx in enumerate([END - 2, END - 1, START, START + 1, END]):
    im = processed[idx].resize((256, 288), Image.Resampling.LANCZOS)
    seam.paste(im, (k * 256, 0), im)
    label = f'source {idx}' + (' (reference)' if idx == END else '')
    d.text((k * 256 + 6, 292), label, fill='#222222')
seam.save(ROOT / 'loop-seam.jpg', quality=94)

(ROOT / 'README.md').write_text('''# 哥布林苦工正面行走序列帧

源视频：用户提供《生成4秒行走视频.mp4》，720×720，24fps，97帧，约4.04秒画面，容器报告约4.06秒。源视频副本保存在 source/。

避开前面的起步/转身段，选取源帧27–50（从0计数）连续24帧，对应约1.125–2.125秒（末时间不含），以原速24fps组成1秒循环。源帧51作为同相位端点参考，不重复放进循环。先比较姿态和相邻帧运动，再选连续正向步态；未倒放、未插帧、未混合首尾，也没有强行把首帧复制为末帧。

- loop-24-frames/：24张RGBA透明PNG，每张512×576。
- goblin_worker_walk.png：6列4行图集，3072×2304。
- goblin_worker_walk.frames.json：帧坐标、24fps、源帧索引与固定取景参数。
- goblin-worker-walk-preview.gif：直接使用导出的PNG制作的1秒循环预览，浅色棋盘是预览底色，PNG本身透明。
- loop-seam.jpg：源49、50、27、28及同相位参考51的对照。
- make_sequence.py：处理脚本。

抠蓝底并处理蓝色边缘；统一裁剪、缩放和位置，不逐帧拉伸或重新居中。空白边缘的源视频平台叠字不进入角色序列。源AI视频仍有轻微体型、五官和衣物变化，选择相近相位可以减轻循环跳变，不能承诺完全无缝。

本次仅准备素材，未替换游戏中的苦工、图鉴或动作，未构建发布；由用户查看预览确认。
''', encoding='utf-8')
with zipfile.ZipFile(ROOT / 'goblin-worker-walk-24f.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(loop.glob('*.png')):
        z.write(p, p.relative_to(ROOT))
    for name in ['README.md', 'goblin_worker_walk.png', 'goblin_worker_walk.frames.json', 'goblin-worker-walk-preview.gif', 'loop-contact-sheet.jpg', 'loop-seam.jpg']:
        z.write(ROOT / name, name)
print(json.dumps({'frames': len(indices), 'fps': FPS, 'seconds': len(indices) / FPS, 'crop': bounds, 'scale': scale, 'zipBytes': (ROOT / 'goblin-worker-walk-24f.zip').stat().st_size}, indent=2))
