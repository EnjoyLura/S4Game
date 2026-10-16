"""Copy complete imagegen outputs, preserving every pixel and original transparency."""
from pathlib import Path
import hashlib
import json
import shutil
import uuid
from PIL import Image

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/weapons_v1'

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

sources = json.loads((OUT / 'generation.json').read_text(encoding='utf-8-sig'))
DEST.mkdir(exist_ok=True)
if not DEST.with_suffix('.meta').exists():
    meta = json.loads((GAME / 'assets/resources/ux/battle_entry_v3.meta').read_text(encoding='utf-8-sig'))
    meta['uuid'] = str(uuid.uuid4())
    write(DEST.with_suffix('.meta'), meta)
receipts = []
for row in sources:
    name, source = row['name'], Path(row['source'])
    dest = DEST / (name + '.png')
    shutil.copy2(source, dest)
    with Image.open(dest) as im:
        w, h = im.size
        alpha = im.getchannel('A')
        bounds, alpha_range = alpha.getbbox(), alpha.getextrema()
    meta_path = Path(str(dest) + '.meta')
    if not meta_path.exists():
        meta = json.loads((GAME / 'assets/resources/ux/battle_entry_v3/outpost_gate.png.meta').read_text(encoding='utf-8-sig'))
        uid = str(uuid.uuid4())
        meta['uuid'] = uid
        texture, frame = meta['subMetas']['6c48a'], meta['subMetas']['f9941']
        for sub, suffix in [(texture, '@6c48a'), (frame, '@f9941')]:
            sub['uuid'], sub['displayName'] = uid + suffix, name
        texture['userData']['imageUuidOrDatabaseUri'] = uid
        data = frame['userData']
        data.update(width=w, height=h, rawWidth=w, rawHeight=h, imageUuidOrDatabaseUri=uid + '@6c48a')
        data['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
                                uv=[0,h,w,h,0,0,w,0], minPos=[-w/2,-h/2,0], maxPos=[w/2,h/2,0])
        meta['userData'].update(hasAlpha=True, redirect=uid + '@6c48a')
        write(meta_path, meta)
    receipts.append(dict(name=name, source=str(source), saved=str(dest), dimensions=[w,h],
                         alphaBounds=bounds, alphaRange=alpha_range,
                         sha256=hashlib.sha256(dest.read_bytes()).hexdigest(), pixelEdits=False))
write(OUT / 'imagegen-assets.json', dict(tool='image_gen.imagegen (built-in)', assets=receipts))
print(json.dumps(receipts))
