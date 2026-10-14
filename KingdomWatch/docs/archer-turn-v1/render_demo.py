"""Render an animated comparison from complete poses; original PNG assets stay untouched."""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
WIDTH, HEIGHT = 900, 740
STEP_MS, SECONDS = 40, 5.6
TURN_SECONDS, CONFIRM_SECONDS, DEAD_ZONE = .24, .12, 28

font_path = Path('C:/Windows/Fonts/msyh.ttc')
def font(size):
    return ImageFont.truetype(str(font_path), size) if font_path.exists() else ImageFont.load_default()
TITLE, LABEL, SMALL = font(25), font(20), font(16)

base = Image.open(GAME / 'assets/resources/ux/archer_combat_rebuild_v1/archer-ready-up-left.png').convert('RGBA')
sheet = Image.open(ROOT / 'turn-poses.png').convert('RGBA')
near = sheet.crop((0, 0, sheet.width // 2, sheet.height))
center = Image.open(ROOT / 'center-pose.png').convert('RGBA')
# One fixed import alignment for each whole pose; no per-frame recentering or limb deformation.
poses = {
    'left': (base, (576, 1430), 1306),
    'near_left': (near, (450, 986), 956),
    'center': (center, (516, 1457), 1397),
}
for source, name in [('left', 'right'), ('near_left', 'near_right')]:
    image, (x, y), height = poses[source]
    poses[name] = (ImageOps.mirror(image), (image.width - x, y), height)

sprites = {}
for name, (image, (x, y), height) in poses.items():
    for display_height in [300, 146]:
        scale = display_height / height
        sprite = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        sprites[name, display_height] = (sprite, round(x * scale), round(y * scale))

def target_x(t):
    if t < 1.0: return -105
    if t < 1.4: return -105 + (t - 1.0) / .4 * 210
    if t < 2.3: return 105
    if t < 2.7: return 105 - (t - 2.3) / .4 * 210
    if t < 3.6: return -105
    if t < 3.9: return -105 + (t - 3.6) / .3 * 105
    if t < 4.9: return 15 * math.sin((t - 3.9) * math.tau * 5)
    if t < 5.2: return -(t - 4.9) / .3 * 105
    return -105

def draw_pose(image, name, cx, ground, display_height):
    sprite, x, y = sprites[name, display_height]
    image.alpha_composite(sprite, (round(cx - x), round(ground - y)))

def render(t, tx, direct, smooth, turning):
    image = Image.new('RGBA', (WIDTH, HEIGHT), '#15262d')
    d = ImageDraw.Draw(image)
    d.text((26, 16), '弓箭手转身 · 两种方式对比', font=TITLE, fill='#f0f1e7')
    for i, (name, color) in enumerate([('直接左右镜像', '#edaa9d'), ('5 姿态短转身 + 朝向防抖', '#c5df9b')]):
        left = 16 + i * 450
        d.rounded_rectangle((left, 62, left + 418, 500), radius=14, fill='#2a3e40', outline='#41595b', width=1)
        d.text((left + 18, 77), name, font=LABEL, fill=color)
        cx = 225 + i * 450
        d.line((cx - 136, 125, cx + 136, 125), fill='#647a74', width=1)
        d.line((cx, 115, cx, 135), fill='#829389', width=2)
        if i:
            d.rectangle((cx - DEAD_ZONE, 119, cx + DEAD_ZONE, 131), fill='#476155')
        d.ellipse((cx + tx - 5, 120, cx + tx + 5, 130), fill='#ffba77')
        d.line((left + 15, 468, left + 402, 468), fill='#5e766b', width=1)
        d.ellipse((cx - 38, 462, cx + 38, 478), fill='#203335')
    direct_name = 'left' if direct == 1 else 'right'
    draw_pose(image, direct_name, 225, 468, 300)
    draw_pose(image, smooth, 675, 468, 300)
    d.text((37, 474), '过中线立即翻面', font=SMALL, fill='#c7d3cb')
    d.text((487, 474), '转身中' if turning else '保持当前朝向', font=SMALL, fill='#c7d3cb')
    d.text((28, 521), '战场显示尺寸（人物高度 146）', font=LABEL, fill='#d1ddca')
    for cx in [225, 675]:
        d.line((cx - 150, 705, cx + 150, 705), fill='#536c65', width=1)
        d.ellipse((cx - 19, 702, cx + 19, 710), fill='#203335')
    draw_pose(image, direct_name, 225, 705, 146)
    draw_pose(image, smooth, 675, 705, 146)
    d.text((28, 716), '目标先跨过左右两侧，再在中线附近抖动；右侧保留原朝向。', font=SMALL, fill='#aebfb7')
    return image.convert('RGB')

state = 1
candidate, candidate_since = None, 0
turn_start, turn_from, turn_to = None, 1, -1
frames = []
palette = None
for k in range(round(SECONDS * 1000 / STEP_MS)):
    t = k * STEP_MS / 1000
    tx = target_x(t)
    if turn_start is not None and t - turn_start >= TURN_SECONDS - 1e-6:
        state = turn_to
        turn_start = None
        candidate = None
    if turn_start is None:
        desired = 1 if tx < -DEAD_ZONE else -1 if tx > DEAD_ZONE else state
        if desired != state:
            if candidate != desired:
                candidate, candidate_since = desired, t
            elif t - candidate_since >= CONFIRM_SECONDS - 1e-6:
                turn_start, turn_from, turn_to = t, state, desired
                candidate = None
        else:
            candidate = None
    smooth = 'left' if state == 1 else 'right'
    if turn_start is not None:
        age = t - turn_start
        sequence = ['left', 'near_left', 'center', 'near_right', 'right']
        if turn_from == -1: sequence.reverse()
        index = 0 if age < .04 else 1 if age < .08 else 2 if age < .16 else 3 if age < .20 else 4
        smooth = sequence[index]
    frame = render(t, tx, 1 if tx < 0 else -1, smooth, turn_start is not None)
    if palette is None:
        # Include all poses to share one stable GIF palette without frame-to-frame color shifts.
        samples = [render(0, -105, 1, name, False) for name in ['left', 'near_left', 'center', 'near_right', 'right']]
        atlas = Image.new('RGB', (WIDTH, HEIGHT * len(samples)))
        for i, sample in enumerate(samples): atlas.paste(sample, (0, HEIGHT * i))
        palette = atlas.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    frames.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))

output = ROOT / 'archer-turn-comparison.gif'
frames[0].save(output, save_all=True, append_images=frames[1:], duration=STEP_MS, loop=0, optimize=True, disposal=1)
(ROOT / 'demo.json').write_text(json.dumps({
    'file': output.name, 'size': [WIDTH, HEIGHT], 'frames': len(frames), 'seconds': SECONDS,
    'frameMs': STEP_MS, 'turnSeconds': TURN_SECONDS, 'confirmSeconds': CONFIRM_SECONDS,
    'deadZonePx': DEAD_ZONE, 'poses': ['left', 'near_left', 'center', 'near_right', 'right'],
    'poseAlignment': {name: {'root': list(root), 'height': height} for name, (_, root, height) in poses.items()},
    'scope': 'Demonstration only; no battle code changed.',
    'bytes': output.stat().st_size,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'gif': str(output), 'bytes': output.stat().st_size, 'seconds': SECONDS, 'frames': len(frames)}, ensure_ascii=False))
