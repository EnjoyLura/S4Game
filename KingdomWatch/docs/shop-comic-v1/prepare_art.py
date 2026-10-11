"""Import generated production illustrations: preserve alpha, normalize canvas, write Creator metadata."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import copy
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/shop_comic_v1'
TEMPLATE = json.loads((GAME / 'assets/resources/ux/ui_item_wpn_bow.png.meta').read_text(encoding='utf-8'))


def metadata(path, width, height):
    target = path.with_suffix(path.suffix + '.meta')
    if target.exists():
        value = json.loads(target.read_text(encoding='utf-8'))
    else:
        value = json.loads(json.dumps(TEMPLATE).replace(TEMPLATE['uuid'], str(uuid.uuid4())))
    for sub in value['subMetas'].values():
        sub['displayName'] = path.stem
        data = sub.get('userData', {})
        if sub['importer'] != 'sprite-frame':
            continue
        data.update(width=width, height=height, rawWidth=width, rawHeight=height,
                    trimX=0, trimY=0, offsetX=0, offsetY=0, trimType='custom', packable=True)
        data['vertices'] = {
            'rawPosition': [-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
            'indexes': [0,1,2,2,1,3], 'uv': [0,height,width,height,0,0,width,0],
            'nuv': [0,0,1,0,0,1,1,1], 'minPos': [-width/2,-height/2,0], 'maxPos': [width/2,height/2,0],
        }
    value['files'] = [path.suffix, '.json']
    value['userData']['hasAlpha'] = path.suffix == '.png'
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    spec = json.loads((OUT / 'generation.json').read_text(encoding='utf-8'))
    DEST.mkdir(parents=True, exist_ok=True)
    (OUT / 'sources').mkdir(exist_ok=True)
    records = []
    for entry in spec['sources']:
        key, original = entry['key'], Path(entry['path'])
        raw = OUT / 'sources' / (key + '.png')
        if not raw.exists():
            shutil.copy2(original, raw)
        source = Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            output = GAME / 'assets/resources/scenes' / (key + '.jpg')
            source.convert('RGB').save(output, quality=93, optimize=True)
            assert source.width / source.height > 1.7, 'Header must be a wide illustration'
        else:
            assert source.getchannel('A').getextrema()[0] == 0, key + ' must have actual transparency'
            # The generator sometimes leaves alpha 1-7 dust across the canvas; it is not part of the artwork.
            source.putalpha(source.getchannel('A').point(lambda a: 0 if a < 8 else a))
            bounds = source.getchannel('A').getbbox()
            assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < source.width and bounds[3] < source.height, key + ' clipped'
            subject = source.crop(bounds)
            size = 384 if '_hero_' in key else 256
            subject.thumbnail((round(size * .88), round(size * .88)), Image.Resampling.LANCZOS)
            source = Image.new('RGBA', (size, size))
            source.alpha_composite(subject, ((size-subject.width)//2, (size-subject.height)//2))
            output = DEST / (key + '.png')
            source.save(output, optimize=True)
        metadata(output, source.width, source.height)
        records.append({'key':key,'file':str(output),'width':source.width,'height':source.height,'bytes':output.stat().st_size})
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
    icons = [r for r in records if not r['key'].startswith('bg_')]
    sheet = Image.new('RGB', (1000, ((len(icons)+4)//5) * 226), '#f2e9d7')
    draw = ImageDraw.Draw(sheet)
    for i, record in enumerate(icons):
        icon = Image.open(record['file']).convert('RGBA')
        icon.thumbnail((156,156), Image.Resampling.LANCZOS)
        x,y = (i%5)*200,(i//5)*226
        sheet.paste(icon,(x+(200-icon.width)//2,y+12),icon)
        draw.text((x+8,y+176),record['key'].replace('comic_','').replace('_v1',''),fill='#302c29',font=font)
        # Real target-size sample beside the label verifies silhouette and stroke weight.
        small = Image.open(record['file']).convert('RGBA').resize((48,48),Image.Resampling.LANCZOS)
        sheet.paste(small,(x+145,y+172),small)
    sheet.save(OUT/'asset-contact-sheet.jpg',quality=92)
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records),'sheet':str(OUT/'asset-contact-sheet.jpg')}))


if __name__ == '__main__':
    main()
