"""Package generated RGBA artwork for review; never redraw or alter character pixels."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
IMAGES = ROOT / 'images'
FRAMES = ROOT / 'frames'
FRAMES.mkdir(exist_ok=True)
RESAMPLE = Image.Resampling.LANCZOS
FONT = 'C:/Windows/Fonts/msyh.ttc'

def bounds(image):
    # Ignore near-invisible alpha noise only when measuring; preserve source alpha.
    return image.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()

def place(source, size, painted_height, pivot_x, bottom_y):
    box = bounds(source)
    assert box is not None
    crop = source.crop(box)
    scale = painted_height / crop.height
    sprite = crop.resize((round(crop.width * scale), round(crop.height * scale)), RESAMPLE)
    image = Image.new('RGBA', size)
    dx = round(size[0] / 2 - (pivot_x - box[0]) * scale)
    dy = round(bottom_y - painted_height)
    assert dx >= 0 and dx + sprite.width <= size[0]
    assert dy >= 0 and dy + sprite.height <= size[1]
    image.alpha_composite(sprite, (dx, dy))
    return image, box, scale

source = Image.open(IMAGES / 'archer-ready.png').convert('RGBA')
# Contact midpoint between the staggered boots. The front boot is above this plane.
pivot_x = 550
ready, box, scale = place(source, (768, 768), 720, pivot_x, 752)
ready.save(IMAGES / 'archer-ready-review.png')
frame, _, frame_scale = place(source, (256, 256), 146, pivot_x, 251)
frame.save(FRAMES / 'archer-up-ready.png')

lobby_path = PROJECT / 'assets/resources/ux/hero_comic_v1/comic_figure_archer_v1.png'
lobby = Image.open(lobby_path).convert('RGBA')
atlas = Image.open(PROJECT / 'assets/resources/ux/battle_heroes_v2.png').convert('RGBA')
manifest = json.loads((PROJECT / 'assets/resources/ux/battle_heroes_v2.frames.json').read_text())
x, y, w, h = manifest['frames']['archer_attack']
old = atlas.crop((x, y, x + w, y + h))

review = Image.new('RGBA', (1080, 840), '#EEE5D4')
draw = ImageDraw.Draw(review)
font = lambda size: ImageFont.truetype(FONT, size)
draw.text((32, 22), '弓箭手 · 战斗形象审查', font=font(30), fill='#253429')
draw.text((32, 66), '以当前立绘为身份基准 · 静态素材，待确认后制作动作', font=font(18), fill='#596257')
characters = [('当前英雄立绘', lobby), ('游戏中的旧战斗形象', old), ('本次新战斗候选', source)]
for i, (label, art) in enumerate(characters):
    cx = 180 + i * 360
    draw.rounded_rectangle((i * 360 + 16, 112, i * 360 + 344, 622), 12, fill='#D8DDCF')
    draw.text((cx, 132), label, font=font(21), fill='#253429', anchor='mt')
    box = bounds(art)
    crop = art.crop(box)
    k = min(300 / crop.width, 416 / crop.height)
    large = crop.resize((round(crop.width * k), round(crop.height * k)), RESAMPLE)
    review.alpha_composite(large, (round(cx - large.width / 2), 602 - large.height))
    k = 146 / crop.height
    small = crop.resize((round(crop.width * k), 146), RESAMPLE)
    draw.ellipse((cx - 34, 797, cx + 34, 809), fill='#BBC2AE')
    review.alpha_composite(small, (round(cx - small.width / 2), 802 - small.height))
draw.text((32, 634), '下排：人物总高度 146 设计单位的静态可读性对照', font=font(17), fill='#596257')
review.convert('RGB').save(ROOT / 'identity-comparison.jpg', quality=95)

assert source.mode == 'RGBA' and source.getchannel('A').getextrema() == (0, 255)
assert frame.getchannel('A').getbbox() is not None
meta = {
    'status': 'static artwork review only; no runtime replacement or generated video',
    'tool': 'built-in image_gen.imagegen',
    'reference': str(lobby_path.relative_to(PROJECT)).replace('\\', '/'),
    'original': {'path': 'images/archer-ready.png', 'size': source.size, 'mode': source.mode,
                 'visibleBoundsAlpha8': bounds(source),
                 'sha256': hashlib.sha256((IMAGES / 'archer-ready.png').read_bytes()).hexdigest()},
    'review': {'path': 'images/archer-ready-review.png', 'size': [768, 768],
               'groundAnchor': [384, 752], 'paintedHeight': 720},
    'frame': {'path': 'frames/archer-up-ready.png', 'size': [256, 256],
              'groundAnchor': [128, 251], 'paintedHeight': 146,
              'sourceGroundAnchor': [pivot_x, bounds(source)[3]], 'scale': frame_scale},
    'directions': {'up': 'review candidate', 'upperLeft': 'study only', 'upperRight': 'study only'},
    'checks': {'rgba': True, 'sourcePreserved': True, 'transparentMargin': True,
               'reviewFootMargin': 16, 'frameFootMargin': 5, 'runtimeChanged': False},
}
(ROOT / 'asset-validation.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(meta, ensure_ascii=False, indent=2))
