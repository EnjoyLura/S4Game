"""Copy complete generated PNGs unchanged; write fresh Cocos sprite metadata."""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import uuid
from PIL import Image

out = Path(__file__).resolve().parent
game = out.parents[1]
generated = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3')
items = [
    ('archer-standing-v2', 'exec-b00ab273-28ae-43a2-949a-8d383caed44e.png',
     'hero_comic_v1/comic_figure_archer_v1', 'hero_comic_v1/comic_figure_archer_v2'),
    ('starter-bow-v2', 'exec-26971005-edbd-45d0-8e98-ac2176606a3e.png',
     'weapons_v1/starter_bow', 'weapons_v1/starter_bow_v2'),
    ('green-bow-v2', 'exec-32f9bc62-8163-4653-9129-9857f5cca89e.png',
     'weapons_v1/green_bow', 'weapons_v1/green_bow_v2'),
]
records = []
for name, filename, previous, current in items:
    source = generated / filename
    dest = game / 'assets/resources/ux' / (current + '.png')
    if dest.exists():
        raise RuntimeError(f'Versioned asset already exists: {dest}')
    shutil.copy2(source, dest)
    with Image.open(dest) as im:
        w, h = im.size
        alpha = im.getchannel('A')
        bbox = alpha.getbbox()
        alpha_range = alpha.getextrema()
        mode = im.mode
    meta = copy.deepcopy(json.loads((game / 'assets/resources/ux' / (previous + '.png.meta')).read_text(encoding='utf-8-sig')))
    uid = str(uuid.uuid4())
    old_uid = meta['uuid']
    meta = json.loads(json.dumps(meta).replace(old_uid, uid))
    for sub in meta['subMetas'].values():
        sub['displayName'] = dest.stem
    data = meta['subMetas']['f9941']['userData']
    data.update(width=w, height=h, rawWidth=w, rawHeight=h, trimX=0, trimY=0,
                offsetX=0, offsetY=0, trimType='custom', packable=False)
    data['vertices'] = {
        'rawPosition': [-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
        'indexes': [0,1,2,2,1,3], 'uv': [0,h,w,h,0,0,w,0],
        'nuv': [0,0,1,0,0,1,1,1],
        'minPos': [-w/2,-h/2,0], 'maxPos': [w/2,h/2,0],
    }
    Path(str(dest) + '.meta').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    digest = hashlib.sha256(dest.read_bytes()).hexdigest()
    records.append({'name': name, 'source': str(source), 'asset': str(dest), 'artKey': current,
                    'uuid': uid, 'size': [w,h], 'mode': mode, 'alphaRange': alpha_range,
                    'alphaBBox': bbox, 'bottomMargin': h-bbox[3], 'sha256': digest,
                    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'pixelEdits': False, 'previousPreserved': previous})
(out / 'imagegen-assets.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(records, ensure_ascii=False))
