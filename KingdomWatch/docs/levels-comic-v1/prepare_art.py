"""Preserve generated alpha and aspect ratio; import complete illustrated level art into Creator."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import importlib.util
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME/'assets/resources/ux/levels_comic_v1'
spec = importlib.util.spec_from_file_location('shop_import', OUT.parent/'shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shop)

def main():
    generation = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    if not any(s['key']=='comic_chest_open_v1' for s in generation['sources']):
        generation['sources'].append(json.loads((OUT/'open-chest-spec.json').read_text(encoding='utf-8')))
    DEST.mkdir(parents=True, exist_ok=True)
    raw_dir = OUT/'sources'
    raw_dir.mkdir(exist_ok=True)
    records = []
    for entry in generation['sources']:
        key = entry['key']
        record = json.loads((OUT/(key+'.generation.json')).read_text(encoding='utf-8'))
        original = Path(record['path'])
        entry['path'] = str(original)
        raw = raw_dir/(key+'.png')
        shutil.copy2(original, raw)
        source = Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            source = source.convert('RGB')
            output = GAME/'assets/resources/scenes'/(key+'.jpg')
            source.save(output, quality=93, optimize=True)
        else:
            assert source.getchannel('A').getextrema()[0] == 0, key+' requires genuine transparency'
            source.putalpha(source.getchannel('A').point(lambda a: 0 if a<8 else a))
            bounds = source.getchannel('A').getbbox()
            assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<source.width and bounds[3]<source.height, key+' clipped at source edge'
            subject = source.crop(bounds)
            size = 768 if 'terrain_' in key else 256
            subject.thumbnail((round(size*.94), round(size*.94)), Image.Resampling.LANCZOS)
            if 'terrain_' in key:
                # Exact 24px foot margin lets the runtime align a subtle contact shadow.
                source = Image.new('RGBA', (subject.width+48,subject.height+48))
                source.alpha_composite(subject, (24,24))
            else:
                source = Image.new('RGBA', (size,size))
                source.alpha_composite(subject, ((size-subject.width)//2,(size-subject.height)//2))
            output = DEST/(key+'.png')
            source.save(output, optimize=True)
        shop.metadata(output, source.width, source.height)
        records.append({'key':key,'file':str(output),'width':source.width,'height':source.height,
                        'bytes':output.stat().st_size,'source':str(raw)})
    meta_path = DEST.with_suffix('.meta')
    if not meta_path.exists():
        value = json.loads((GAME/'assets/resources/ux/shop_comic_v1.meta').read_text(encoding='utf-8'))
        value['uuid'] = str(uuid.uuid4())
        meta_path.write_text(json.dumps(value,indent=2),encoding='utf-8')
    generation['import'] = 'Genuine alpha preserved; original images archived; trim transparent padding and resize proportionally only. No painting, warping or sprite-sheet generation.'
    (OUT/'generation.json').write_text(json.dumps(generation,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    sheet = Image.new('RGB',(1100,730),'#F5E8CD')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    arts = [r for r in records if not r['key'].startswith('bg_')]
    for i,r in enumerate(arts):
        art=Image.open(r['file']).convert('RGBA')
        art.thumbnail((240,260),Image.Resampling.LANCZOS)
        x,y=(i%4)*275,(i//4)*240
        sheet.paste(art,(x+(275-art.width)//2,y+10),art)
        draw.text((x+12,y+218),r['key'].replace('comic_',''),fill='#29313B',font=font)
    sheet.save(OUT/'asset-contact-sheet.jpg',quality=93)
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records)}))

if __name__=='__main__':
    main()
