"""Lay out the unchanged approved image as a video first-frame input with red overscan."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import key_red, bounds
master = GAME / 'docs/sniper-stance-idle-v3/ready-red.png'
for name in ['ready-red.png', 'image-prompt.txt']:
    shutil.copy2(master.parent / name, ROOT / name)
original = Image.open(master).convert('RGB')
alpha, _ = key_red(original)
box = bounds(alpha)
# This is source transport framing, with one uniform placement of the existing
# image; no generative edit, redrawing, pose change, or separate body-part motion.
width, height = 768, 1344
max_width, max_height = 470, 870
scale = min(max_width/(box[2]-box[0]), max_height/(box[3]-box[1]))
size = (round(original.width*scale), round(original.height*scale))
placed = original.resize(size, Image.Resampling.LANCZOS)
content_width = (box[2]-box[0])*scale
content_height = (box[3]-box[1])*scale
x = round((width-content_width)/2-box[0]*scale)
y = round((height-content_height)/2-box[1]*scale)
canvas = Image.new('RGB', (width, height), '#FF0000')
canvas.paste(placed, (x, y))
filename = 'hero_sniper_idle_full_v4_20261014_ff.png'
canvas.save(ROOT / 'video-first-frame.png', optimize=True)
host = GAME.parent / '美术/vfx_host'
shutil.copy2(ROOT / 'video-first-frame.png', host / filename)
record = {'approvedMaster': str(master), 'masterSha256': hashlib.sha256(master.read_bytes()).hexdigest(),
          'videoFirstFrame': 'video-first-frame.png', 'hostFilename': filename,
          'canvasSize': [width, height], 'uniformScale': scale, 'placement': [x, y],
          'contentBounds': [round(x+box[0]*scale), round(y+box[1]*scale),
                            round(x+box[2]*scale), round(y+box[3]*scale)],
          'purpose': 'Video input overscan from the unchanged approved master; game display height stays 153',
          'imageRegenerated': False, 'masterChanged': False}
(ROOT / 'first-frame-layout.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(record, ensure_ascii=False))
