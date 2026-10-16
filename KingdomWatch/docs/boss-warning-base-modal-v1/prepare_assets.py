"""Copy complete imagegen originals and author full-rect Cocos metadata; no pixel edits."""
from pathlib import Path
import hashlib
import json
import shutil
import uuid
from PIL import Image

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/boss_warning_v1'
SOURCE = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3')


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


DEST.mkdir(exist_ok=True)
folder_meta = DEST.with_suffix('.meta')
if not folder_meta.exists():
    meta = json.loads((GAME / 'assets/resources/ux/battle_entry_v3.meta').read_text(encoding='utf-8-sig'))
    meta['uuid'] = str(uuid.uuid4())
    write(folder_meta, meta)
receipts = []
for name, filename in [('banner', 'exec-aaa57368-c641-4758-9d18-c1b98bfeeb37.png'),
                       ('crest', 'exec-d3f27faf-f8ad-46dd-8908-79431afda282.png')]:
    source, dest = SOURCE / filename, DEST / (name + '.png')
    shutil.copy2(source, dest)
    with Image.open(dest) as image:
        w, h = image.size
        alpha = image.getchannel('A')
        bounds = alpha.getbbox()
        alpha_range = alpha.getextrema()
    path = Path(str(dest) + '.meta')
    if not path.exists():
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
        write(path, meta)
    receipts.append(dict(name=name, source=str(source), saved=str(dest), dimensions=[w,h],
                         alphaBounds=bounds, alphaRange=alpha_range,
                         sha256=hashlib.sha256(dest.read_bytes()).hexdigest(), pixelEdits=False))
write(OUT / 'imagegen-assets.json', dict(tool='image_gen.imagegen (built-in)', assets=receipts))
print(json.dumps(receipts))
