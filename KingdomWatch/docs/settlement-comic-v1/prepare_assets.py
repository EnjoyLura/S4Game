"""Extract separate sprites from the generated atlas, retaining antialiased original pixels."""
from collections import deque
from pathlib import Path
import importlib.util
import hashlib
import json
import shutil
import uuid
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/settlement_comic_v1'
ORIGINAL = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-e3178d7d-de34-4233-8216-a695e3a88e0a.png')

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ORIGINAL, OUT / 'source-atlas.png')
    rgba = np.array(Image.open(ORIGINAL).convert('RGBA'))
    h, w = rgba.shape[:2]
    if (w, h) != (1254, 1254):
        raise ValueError('Annotate changed source dimensions before extracting')
    core = rgba[:, :, 3] >= 24
    labels = np.zeros((h, w), dtype=np.int32)
    components = []
    for sy, sx in np.argwhere(core):
        sy, sx = int(sy), int(sx)
        if labels[sy, sx]:
            continue
        index = len(components) + 1
        labels[sy, sx] = index
        queue = deque([(sy, sx)])
        count, l, t, r, b = 0, sx, sy, sx, sy
        while queue:
            y, x = queue.popleft()
            count += 1
            l, t, r, b = min(l,x), min(t,y), max(r,x), max(b,y)
            for ny in range(max(0,y-1), min(h,y+2)):
                for nx in range(max(0,x-1), min(w,x+2)):
                    if core[ny,nx] and labels[ny,nx] == 0:
                        labels[ny,nx] = index
                        queue.append((ny,nx))
        components.append({'id': index, 'pixels': count, 'rect': [l,t,r+1,b+1]})
    groups = {k: [] for k in ['badge_win','badge_lose','panel_win','panel_lose','button_teal','button_muted','card_win','card_lose']}
    for component in components:
        if component['pixels'] < 64:
            continue
        l,t,r,b = component['rect']
        cx, cy = (l+r)/2, (t+b)/2
        if cy < 320: key = 'badge_win'
        elif cy < 650: key = 'badge_lose'
        elif cy < 930: key = 'panel_win' if cx < w/2 else 'panel_lose'
        elif cy < 1080: key = 'button_teal' if cx < w/2 else 'button_muted'
        else: key = 'card_win' if cx < w/2 else 'card_lose'
        groups[key].append(component['id'])
    spec = importlib.util.spec_from_file_location('shop_meta', GAME / 'docs/shop-comic-v1/prepare_art.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    records = []
    for key, ids in groups.items():
        if not ids:
            raise ValueError('Missing component: ' + key)
        mask = np.isin(labels, ids)
        # Preserve original antialiasing adjacent to the selected sprite, but never include its neighbour.
        for _ in range(2):
            p = np.pad(mask, 1)
            mask = np.logical_or.reduce([p[dy:dy+h,dx:dx+w] for dy in range(3) for dx in range(3)])
        selected = rgba.copy()
        selected[:, :, 3] = np.where(mask, rgba[:, :, 3], 0)
        selected[selected[:, :, 3] == 0, :3] = 0
        image = Image.fromarray(selected)
        box = image.getchannel('A').getbbox()
        if box[0] <= 0 or box[1] <= 0 or box[2] >= w or box[3] >= h:
            raise ValueError('Clipped sprite: ' + key)
        sprite = image.crop(box)
        target = DEST / (key + '.png')
        sprite.save(target, optimize=True)
        module.metadata(target, *sprite.size)
        record = {'key': key, 'file': str(target), 'width': sprite.width, 'height': sprite.height,
                  'sourceRect': list(box), 'componentIds': ids, 'bytes': target.stat().st_size,
                  'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        if key.startswith('badge_'):
            anchor = (627, 253 if key == 'badge_win' else 560)
            record['labelOffset'] = [anchor[0] - box[0] - sprite.width/2, sprite.height/2 - (anchor[1]-box[1])]
        records.append(record)
    for path, importer, ver in [(DEST.with_suffix('.meta'),'directory','1.2.0'),
        (GAME/'assets/scripts/ui/SettlementPanelSkin.ts.meta','typescript','4.0.24')]:
        if not path.exists():
            path.write_text(json.dumps({'ver': ver,'importer': importer,'imported': True,'uuid': str(uuid.uuid4()),'files': [],'subMetas': {},'userData': {}}, indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'generation.json').write_text(json.dumps({'tool':'built-in image_gen','original':str(ORIGINAL),'source':'source-atlas.png',
        'prompt':'image-prompt.txt','transparentBackground':True,'processing':'Connected sprite extraction with 2px antialias retention; no redraw or resampling',
        'references':['docs/shop-comic-v1/style-reference.png','user victory reference','user defeat reference']},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(records,ensure_ascii=False))

if __name__ == '__main__':
    main()
