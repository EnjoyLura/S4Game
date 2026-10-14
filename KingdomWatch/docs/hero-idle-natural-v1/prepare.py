"""Reuse approved art and provide generous fixed red overscan for video input."""
from pathlib import Path
import hashlib
import json
import shutil
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
HOST = GAME.parent / '美术/vfx_host'
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import key_red, bounds

sys.stdout.reconfigure(encoding='utf-8')
for hero, origin_name in [('sniper', 'sniper-idle-full-v6'), ('volt', 'volt-idle-lively-loop-v2')]:
    origin = GAME / 'docs' / origin_name
    folder = GAME / 'docs' / f'{hero}-idle-natural-v1'
    folder.mkdir(exist_ok=True)
    for name in ['ready-red.png', 'ready-transparent.png', 'art.json', 'image-prompt.txt']:
        shutil.copy2(origin / name, folder / name)
    filename = f'hero_{hero}_idle_natural_v1_20261014_ff.png'
    if hero == 'sniper':
        shutil.copy2(origin / 'video-first-frame.png', folder / 'video-first-frame.png')
        layout = json.loads((origin / 'first-frame-layout.json').read_text(encoding='utf-8-sig'))
        layout['reusedFrom'] = '../sniper-idle-full-v6/video-first-frame.png'
    else:
        master = GAME / 'docs/volt-stance-idle-v2/ready-red.png'
        keyed, background = key_red(Image.open(master))
        box = bounds(keyed)
        scale = min(470 / (box[2] - box[0]), 790 / (box[3] - box[1]))
        crop = keyed.crop(box)
        size = (round(crop.width * scale), round(crop.height * scale))
        image = Image.new('RGBA', (768, 1344), tuple(round(c) for c in background) + (255,))
        placement = ((768 - size[0]) // 2, 1067 - size[1])
        image.alpha_composite(crop.resize(size, Image.Resampling.LANCZOS), placement)
        image.convert('RGB').save(folder / 'video-first-frame.png')
        layout = {'approvedMaster': str(master),
                  'masterSha256': hashlib.sha256(master.read_bytes()).hexdigest(),
                  'canvasSize': [768, 1344], 'uniformScale': scale,
                  'placement': list(placement),
                  'contentBounds': [*placement, placement[0] + size[0], placement[1] + size[1]],
                  'imageRegenerated': False, 'masterChanged': False}
    layout.update({'videoFirstFrame': 'video-first-frame.png', 'hostFilename': filename,
                   'purpose': 'Unchanged approved master with fixed generous margins for a new natural forward idle cycle'})
    (folder / 'first-frame-layout.json').write_text(json.dumps(layout, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copy2(folder / 'video-first-frame.png', HOST / filename)
    print(json.dumps({'hero': hero, 'folder': str(folder), 'hostFilename': filename}, ensure_ascii=False))
