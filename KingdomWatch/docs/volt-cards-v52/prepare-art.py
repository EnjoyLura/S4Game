"""Copy selected generated PNG bytes; metadata/inspection only, no pixel edits."""
from pathlib import Path
import copy, hashlib, json, shutil, uuid
from PIL import Image
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
selected = json.loads(read(HERE / 'image-prompts.json'))['assets']
reference = json.loads(read(ROOT / 'assets/resources/ux/ui_card_pyro_ember.png.meta'))
records = []
for a in selected:
    src = Path(a['source'])
    dst = ROOT / 'assets/resources/ux' / a['filename']
    assert not dst.exists(), 'Do not overwrite an integrated asset'
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    assert w == h
    alpha = np.asarray(im)[:, :, 3]
    yy, xx = np.ogrid[:h, :w]
    radius2 = (xx-(w-1)/2)**2 + (yy-(h-1)/2)**2
    inside = radius2 < (min(w,h)*.43)**2
    outside = radius2 > (min(w,h)*.52)**2
    opaque = float((alpha[inside] >= 250).mean())
    escaped = float((alpha[outside] >= 32).mean())
    assert opaque > .98, (a['id'], 'Hollow interior', opaque)
    assert escaped < .005, (a['id'], 'Outside circular silhouette', escaped)
    shutil.copy2(src, dst)
    meta = copy.deepcopy(reference)
    uid = str(uuid.uuid4())
    meta['uuid'] = uid
    meta['userData']['redirect'] = uid + '@6c48a'
    texture = meta['subMetas']['6c48a']
    texture['uuid'] = uid + '@6c48a'
    texture['displayName'] = dst.stem
    texture['userData']['imageUuidOrDatabaseUri'] = uid
    sprite = meta['subMetas']['f9941']
    sprite['uuid'] = uid + '@f9941'
    sprite['displayName'] = dst.stem
    data = sprite['userData']
    data.update(offsetX=0, offsetY=0, trimX=0, trimY=0, width=w, height=h,
                rawWidth=w, rawHeight=h, trimType='none', imageUuidOrDatabaseUri=uid+'@6c48a')
    data['vertices'] = dict(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
        indexes=[0,1,2,2,1,3], uv=[0,h,w,h,0,0,w,0],
        nuv=[0,0,1,0,0,1,1,1], minPos=[-w/2,-h/2,0], maxPos=[w/2,h/2,0])
    dst.with_suffix('.png.meta').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    records.append(dict(id=a['id'], source=str(src), path=dst.relative_to(ROOT).as_posix(), uuid=uid,
        width=w, height=h, sha256=sha(dst), sourceBytesPreserved=sha(src)==sha(dst),
        opaqueInteriorFraction=opaque, opaqueBeyondCircleFraction=escaped, bytes=dst.stat().st_size))
(HERE / 'art-manifest.json').write_text(json.dumps(dict(mode='built-in image_gen',
    styleReference='assets/resources/ux/ui_icon_skill_archer.png', assets=records),
    ensure_ascii=False, indent=2), encoding='utf-8')
print('Integrated', len(records), 'full circular generated icons; source PNG bytes preserved.')
