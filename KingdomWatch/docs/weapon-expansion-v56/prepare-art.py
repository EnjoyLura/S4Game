"""Copy generated PNG bytes and author Cocos metadata. Pixels are inspected, never edited."""
from pathlib import Path
import copy, hashlib, json, shutil, uuid
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
selected = [a for p in sorted(HERE.glob('selection-*.json')) for a in json.loads(read(p))]
assert len(selected) == 16 and len({a['key'] for a in selected}) == 16
template = json.loads(read(ROOT / 'assets/resources/ux/weapons_v1/green_bow_v2.png.meta'))
records = []
for a in selected:
    src = Path(a['source'])
    dst = ROOT / 'assets/resources/ux' / (a['art'] + '.png')
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    assert w == h
    alpha = im.getchannel('A')
    box = alpha.point(lambda v: 255 if v >= 24 else 0).getbbox()
    assert box
    margins = [box[0]/w, box[1]/h, (w-box[2])/w, (h-box[3])/h]
    # Read-only inspection confirms complete contours. Require an actual clear border,
    # rather than cropping/resizing the native result to force the aspirational prompt margin.
    assert min(margins) >= .005, (a['key'], 'Item touches frame edge', margins)
    assert alpha.getextrema() == (0,255), (a['key'], 'Not a genuine transparent cutout')
    corners = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
    corner_alpha = [alpha.getpixel(p) for p in corners]
    assert max(corner_alpha) <= 1, (a['key'], corner_alpha)
    meta_path = dst.with_suffix('.png.meta')
    if dst.exists():
        assert sha(src) == sha(dst), 'Do not overwrite an integrated illustration'
        meta = json.loads(read(meta_path))
        uid = meta['uuid']
    else:
        shutil.copy2(src, dst)
        uid = str(uuid.uuid4())
        meta = copy.deepcopy(template)
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
            indexes=[0,1,2,2,1,3], uv=[0,h,w,h,0,0,w,0], nuv=[0,0,1,0,0,1,1,1],
            minPos=[-w/2,-h/2,0], maxPos=[w/2,h/2,0])
        meta_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')
    records.append(dict(id='wpn_'+a['key'], name=a['name'], type=a['type'], quality=a['quality'], source=str(src),
        path=dst.relative_to(ROOT).as_posix(), uuid=uid, width=w, height=h, sha256=sha(dst),
        sourceBytesPreserved=sha(src)==sha(dst), normalizedMargins=margins, cornerAlpha=corner_alpha, bytes=dst.stat().st_size))
(HERE / 'art-manifest.json').write_text(json.dumps(dict(mode='built-in image_gen', assets=records), ensure_ascii=False, indent=2), encoding='utf-8')
# These contact sheets are documentation previews only, never game assets.
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
for cell, name in [(260, 'final-art-contact.png'), (160, 'small-icon-contact.png')]:
    out = Image.new('RGB', (4*cell, 4*(cell+35)), '#F4EBD9')
    draw = ImageDraw.Draw(out)
    for i,a in enumerate(records):
        icon = Image.open(ROOT/a['path']).convert('RGBA')
        icon.thumbnail((cell-16,cell-16))
        x,y = (i%4)*cell, (i//4)*(cell+35)
        out.paste(icon, (x+(cell-icon.width)//2, y+(cell-icon.height)//2), icon)
        draw.text((x+8,y+cell+3), ('蓝 · ' if a['quality']==2 else '紫 · ')+a['name'], font=font, fill='#263440')
    out.save(HERE/name)
print('16 independent transparent illustrations integrated; every source PNG byte preserved.')
