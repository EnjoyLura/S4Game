"""Extract the imagegen local repairs into the original video patch coordinate system."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
layout = json.loads((ROOT / 'weapon-repair-layout.json').read_text(encoding='utf-8'))
generated = Image.open(ROOT / 'weapon-repair-generated.png').convert('RGB')
rgb = np.asarray(generated)
cyan = (rgb[..., 0] < 70) & (rgb[..., 1] > 140) & (rgb[..., 2] > 140)
regions = []
for k in range(3):
    binary = Image.fromarray(np.where(cyan, 0, 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(binary, (round(generated.width * ((k+.3)/3)), round(generated.height*.45)), 128, thresh=0)
    selected = np.asarray(binary) == 128
    ys, xs = np.where(selected)
    box = [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]
    if box[2]-box[0] < generated.width*.2 or box[3]-box[1] < generated.height*.3:
        raise RuntimeError('Cannot locate the generated repair panel')
    tile = generated.crop(box).resize(tuple(layout['tile']), Image.Resampling.LANCZOS)
    tile.save(ROOT / f'weapon-repair-{layout["indices"][k]:02d}.png')
    regions.append(box)
contact = Image.new('RGB', (3*430, 2*290+30), '#293c3b')
draw = ImageDraw.Draw(contact)
for k, index in enumerate(layout['indices']):
    original = Image.open(ROOT / 'original-frames' / f'frame-{index:02d}.png').crop(tuple(layout['roi']))
    fixed = Image.open(ROOT / f'weapon-repair-{index:02d}.png')
    contact.paste(original.resize((430,290)), (k*430,30))
    contact.paste(fixed.resize((430,290)), (k*430,320))
    draw.text((k*430+6,6), f'{index:02d} original / imagegen repair', fill='white')
contact.save(ROOT / 'weapon-repair-comparison.png')
layout.update(generatedSize=list(generated.size), generatedPanelRects=regions,
              method='imagegen local effect removal; sheet layout extraction only; one fixed local ROI per original frame')
(ROOT / 'weapon-repair-layout.json').write_text(json.dumps(layout, indent=2), encoding='utf-8')
print(json.dumps({'panels': regions, 'tileSize': layout['tile']}))
