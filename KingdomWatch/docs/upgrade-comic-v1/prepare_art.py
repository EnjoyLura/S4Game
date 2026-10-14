"""Normalize production canvases and write Creator import metadata; retain generated sources."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import importlib.util
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/upgrade_comic_v1'
module = importlib.util.spec_from_file_location('shop_art', GAME / 'docs/shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(module)
module.loader.exec_module(shop)

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    (OUT / 'sources').mkdir(exist_ok=True)
    folder_meta = DEST.with_suffix('.meta')
    if not folder_meta.exists():
        value = json.loads((DEST.parent / 'shop_comic_v1.meta').read_text(encoding='utf-8'))
        value['uuid'] = str(uuid.uuid4())
        folder_meta.write_text(json.dumps(value, indent=2), encoding='utf-8')
    records = []
    for entry in json.loads((OUT/'generation.json').read_text(encoding='utf-8'))['sources']:
        key = entry['key']
        raw = OUT / 'sources' / (key + '.png')
        if not raw.exists(): shutil.copy2(entry['path'], raw)
        source = Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            output = GAME / 'assets/resources/scenes' / (key + '.jpg')
            source.convert('RGB').save(output, quality=93, optimize=True)
        else:
            assert source.getchannel('A').getextrema()[0] == 0, 'Actual alpha required'
            source.putalpha(source.getchannel('A').point(lambda a: 0 if a < 8 else a))
            bounds = source.getchannel('A').getbbox()
            assert bounds and all((bounds[0]>0,bounds[1]>0,bounds[2]<source.width,bounds[3]<source.height)), key+' clipped'
            subject = source.crop(bounds)
            size = (384,640) if '_staff_' in key else (256,256)
            subject.thumbnail((round(size[0]*.92),round(size[1]*.94)),Image.Resampling.LANCZOS)
            source = Image.new('RGBA',size)
            source.alpha_composite(subject,((size[0]-subject.width)//2,(size[1]-subject.height)//2))
            output = DEST / (key+'.png')
            source.save(output,optimize=True)
        shop.metadata(output,source.width,source.height)
        records.append({'key':key,'file':str(output),'width':source.width,'height':source.height,'bytes':output.stat().st_size})
    sheet=Image.new('RGB',(880,400),'#f5e8cd')
    draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    for i,r in enumerate(records[1:]):
        icon=Image.open(r['file']).convert('RGBA');icon.thumbnail((180,320),Image.Resampling.LANCZOS)
        sheet.paste(icon,(i*220+(220-icon.width)//2,12),icon)
        draw.text((i*220+10,350),r['key'].replace('comic_','').replace('_v1',''),font=font,fill='#342d26')
    sheet.save(OUT/'asset-contact-sheet.jpg',quality=92)
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records)}))

if __name__=='__main__':main()
