"""Import genuine-alpha Imagegen assets with proportional size normalization only."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import importlib.util
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/hero_comic_v2'
spec = importlib.util.spec_from_file_location('shop_import', OUT.parent/'shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shop)


def main():
    generation = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    DEST.mkdir(parents=True, exist_ok=True)
    sources = OUT/'sources'
    sources.mkdir(exist_ok=True)
    records = []
    for entry in generation['sources']:
        key = entry['key']
        record = json.loads((OUT/(key+'.generation.json')).read_text(encoding='utf-8'))
        source_path = Path(record['path'])
        entry['path'] = str(source_path)
        if key.startswith('bg_'):
            edit = json.loads((OUT/(key+'.edit.generation.json')).read_text(encoding='utf-8'))
            shutil.copy2(source_path, sources/(key+'-initial.png'))
            entry.update(initialPath=str(source_path), edit=edit, path=edit['path'])
            source_path = Path(edit['path'])
        raw = sources/(key+'.png')
        shutil.copy2(source_path, raw)
        image = Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            image = image.convert('RGB')
            output = GAME/'assets/resources/scenes'/(key+'.jpg')
            image.save(output, quality=93, optimize=True)
        else:
            assert image.getchannel('A').getextrema()[0] == 0, key+' requires actual alpha'
            bounds = image.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
            assert bounds, key
            subject = image.crop(bounds)
            if 'power_banner' in key:
                width = 608
                height = round(subject.height*width/subject.width)
                subject = subject.resize((width,height),Image.Resampling.LANCZOS)
                image = Image.new('RGBA',(640,height+32))
                image.alpha_composite(subject,(16,16))
            else:
                subject.thumbnail((225,225),Image.Resampling.LANCZOS)
                image = Image.new('RGBA',(256,256))
                image.alpha_composite(subject,((256-subject.width)//2,(256-subject.height)//2))
            output = DEST/(key+'.png')
            image.save(output,optimize=True)
        shop.metadata(output,image.width,image.height)
        records.append({'key':key,'file':str(output),'width':image.width,'height':image.height,
                        'bytes':output.stat().st_size,'source':str(raw)})
    folder_meta = DEST.with_suffix('.meta')
    if not folder_meta.exists():
        meta = json.loads((GAME/'assets/resources/ux/shop_comic_v1.meta').read_text(encoding='utf-8'))
        meta['uuid'] = str(uuid.uuid4())
        folder_meta.write_text(json.dumps(meta,indent=2),encoding='utf-8')
    generation['import'] = 'Proportional resizing and alpha-aware bounds only. Original generated designs and actual transparency preserved. No perspective deformation.'
    generation['platformAnchor'] = {'u':.315,'v':.840,'meaning':'center of the top ellipse, normalized from top left; aligned to character foot anchor at runtime'}
    (OUT/'generation.json').write_text(json.dumps(generation,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    sheet = Image.new('RGB',(1200,420),'#F3E9D2')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
    icons = [r for r in records if not r['key'].startswith('bg_')]
    for i,r in enumerate(icons):
        art = Image.open(r['file']).convert('RGBA')
        art.thumbnail((180,280),Image.Resampling.LANCZOS)
        sheet.paste(art,(i*200+(200-art.width)//2,30+(280-art.height)//2),art)
        draw.text((i*200+8,335),r['key'].removeprefix('comic_'),fill='#292D34',font=font)
    sheet.save(OUT/'asset-contact-sheet.jpg',quality=93)
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records)}))


if __name__ == '__main__':
    main()
