"""Lossless source archiving, review thumbnails and source-coordinate monster crops."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import hashlib
import json
import math
import sys
from crop_plan import LABELS, layout, theme

ROOT = Path(__file__).resolve().parent
SOURCE = Path('C:/Users/user/Pictures/KingdomWatch')

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inventory():
    for sub in ('sources', 'inspection', 'monsters', 'thumbs'):
        (ROOT / sub).mkdir(exist_ok=True)
    sources, by_hash = [], {}
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        digest = sha256(path)
        if digest in by_hash:
            by_hash[digest]['aliases'].append(str(path))
            continue
        sid = f'S{len(sources)+1:02d}'
        dest = ROOT / 'sources' / (sid + path.suffix.lower())
        dest.write_bytes(path.read_bytes())
        with Image.open(path) as im:
            info = dict(id=sid, filename=path.name, original=str(path), aliases=[],
                        path=dest.relative_to(ROOT).as_posix(), sha256=digest,
                        width=im.width, height=im.height, mode=im.mode)
        by_hash[digest] = info
        sources.append(info)
    (ROOT / 'sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 19)
    for offset in range(0, len(sources), 12):
        subset = sources[offset:offset+12]
        sheet = Image.new('RGB', (1280, 3*405), '#ddddda')
        draw = ImageDraw.Draw(sheet)
        for j, source in enumerate(subset):
            x, y = (j % 4)*320, (j//4)*405
            with Image.open(ROOT/source['path']) as im:
                thumb = ImageOps.contain(im.convert('RGB'), (310, 365))
                sheet.paste(thumb, (x+(320-thumb.width)//2, y+30+(365-thumb.height)//2))
            draw.text((x+8, y+4), f"{source['id']}  {source['width']}x{source['height']}", fill='#111111', font=font)
        sheet.save(ROOT / 'inspection' / f'sources-{offset//12+1:02d}.jpg', quality=93)
    print(json.dumps(dict(files=sum(1+len(s['aliases']) for s in sources), unique=len(sources),
                          duplicates=sum(len(s['aliases']) for s in sources),
                          dimensions=sorted(set((s['width'],s['height']) for s in sources))), ensure_ascii=False))

def crop_all():
    sources = json.loads((ROOT / 'sources.json').read_text(encoding='utf-8'))
    monsters = []
    for source in sources:
        sid = source['id']
        tiles = layout(sid)
        names = LABELS[sid].split()
        if len(tiles) != len(names):
            raise ValueError(f'{sid}: {len(tiles)} crops but {len(names)} labels')
        with Image.open(ROOT / source['path']) as im:
            for number, ((row, col, box), name) in enumerate(zip(tiles,names), 1):
                if not (0 <= box[0] < box[2] <= im.width and 0 <= box[1] < box[3] <= im.height):
                    raise ValueError((sid, box))
                mid = f'{sid}-{number:02d}'
                cropped = im.crop(box)
                target = ROOT / 'monsters' / (mid + '.png')
                cropped.save(target, optimize=True, icc_profile=im.info.get('icc_profile'))
                with Image.open(target) as saved:
                    if saved.mode != cropped.mode or saved.tobytes() != cropped.tobytes():
                        raise ValueError('Pixel identity failed for '+mid)
                thumb = ImageOps.contain(cropped.convert('RGB'), (260,260), Image.Resampling.LANCZOS)
                thumb_path = ROOT / 'thumbs' / (mid + '.webp')
                thumb.save(thumb_path, quality=88, method=4)
                monsters.append(dict(id=mid, name=name, source=sid, row=row, column=col,
                                     theme=theme(sid), image=target.relative_to(ROOT).as_posix(),
                                     thumb=thumb_path.relative_to(ROOT).as_posix(),
                                     width=cropped.width, height=cropped.height, box=box,
                                     sha256=sha256(target), pixelSha256=hashlib.sha256(cropped.tobytes()).hexdigest()))
        source['count'] = len(tiles)
        source['theme'] = theme(sid)
    chapters = json.loads((ROOT.parent / 'campaign-expansion-v66/chapters.json').read_text(encoding='utf-8'))['chapters']
    public = dict(version=1, title='怪物形象候选图鉴',
                  sourceFiles=sum(1+len(s['aliases']) for s in sources),
                  sources=sources, monsters=monsters,
                  chapters=[dict(number=c['number'], name=c['name']) for c in chapters])
    serialized = json.dumps(public, ensure_ascii=False, separators=(',',':'))
    (ROOT / 'catalog-data.js').write_text('window.MONSTER_CATALOG='+serialized+';\n', encoding='utf-8')
    (ROOT / 'catalog.json').write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
    # Separate audit contact sheets for the nonstandard layouts; not used by the gallery.
    for sid in ('S01','S02','S03','S04','S05','S06','S07','S08','S48','S58'):
        items = [m for m in monsters if m['source']==sid]
        cols=4
        sheet=Image.new('RGB', (cols*270, math.ceil(len(items)/cols)*300), '#dddcd5')
        draw=ImageDraw.Draw(sheet)
        for j,m in enumerate(items):
            x,y=(j%cols)*270,(j//cols)*300
            with Image.open(ROOT/m['image']) as im:
                preview=ImageOps.contain(im.convert('RGB'), (262,268))
                sheet.paste(preview,(x+(270-preview.width)//2,y+25+(268-preview.height)//2))
            draw.text((x+5,y+3),m['id']+' '+m['name'],font=font,fill='#252722')
        sheet.save(ROOT/'inspection'/f'crops-{sid}.jpg',quality=94)
    report=dict(sourceFiles=public['sourceFiles'], uniqueSources=len(sources),
                duplicateFiles=public['sourceFiles']-len(sources), monsters=len(monsters),
                losslessCropsVerified=len(monsters), originalFilesModified=0,
                totalCropBytes=sum((ROOT/m['image']).stat().st_size for m in monsters))
    (ROOT/'crop-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))

if __name__ == '__main__':
    if '--crop' in sys.argv:
        crop_all()
    else:
        inventory()
