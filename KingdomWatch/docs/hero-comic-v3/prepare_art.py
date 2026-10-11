"""Import generated hero hall and controls, retaining alpha and natural proportions."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import importlib.util
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME/'assets/resources/ux/hero_comic_v3'
spec = importlib.util.spec_from_file_location('shop_import',OUT.parent/'shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shop)


def main():
    generation = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    DEST.mkdir(parents=True,exist_ok=True)
    raw_dir = OUT/'sources'
    raw_dir.mkdir(exist_ok=True)
    records = []
    for entry in generation['sources']:
        key = entry['key']
        record = json.loads((OUT/(key+'.generation.json')).read_text(encoding='utf-8'))
        source_path = Path(record['path'])
        entry['path'] = str(source_path)
        edit_file = OUT/(key+'.edit.generation.json')
        if edit_file.exists():
            edit = json.loads(edit_file.read_text(encoding='utf-8'))
            shutil.copy2(source_path,raw_dir/(key+'-initial.png'))
            entry.update(initialPath=str(source_path),edit=edit,path=edit['path'])
            source_path = Path(edit['path'])
        raw = raw_dir/(key+'.png')
        shutil.copy2(source_path,raw)
        image = Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            image = image.convert('RGB')
            output = GAME/'assets/resources/scenes'/(key+'.jpg')
            image.save(output,quality=93,optimize=True)
        else:
            alpha = image.getchannel('A')
            assert alpha.getextrema()[0]==0,key+' requires genuine alpha'
            bounds = alpha.point(lambda a:255 if a>=8 else 0).getbbox()
            assert bounds
            subject = image.crop(bounds)
            if 'power_plate' in key:
                width = 608
                height = round(subject.height*width/subject.width)
                subject = subject.resize((width,height),Image.Resampling.LANCZOS)
                image = Image.new('RGBA',(640,height+32))
                image.alpha_composite(subject,(16,16))
            else:
                subject.thumbnail((230,230),Image.Resampling.LANCZOS)
                image = Image.new('RGBA',(256,256))
                image.alpha_composite(subject,((256-subject.width)//2,(256-subject.height)//2))
            output = DEST/(key+'.png')
            image.save(output,optimize=True)
        shop.metadata(output,image.width,image.height)
        records.append({'key':key,'file':str(output),'width':image.width,'height':image.height,
                        'bytes':output.stat().st_size,'source':str(raw)})
    meta_path = DEST.with_suffix('.meta')
    if not meta_path.exists():
        meta = json.loads((GAME/'assets/resources/ux/shop_comic_v1.meta').read_text(encoding='utf-8'))
        meta['uuid'] = str(uuid.uuid4())
        meta_path.write_text(json.dumps(meta,indent=2),encoding='utf-8')
    generation['import'] = 'Alpha-aware bounds and proportional resize only. Originals preserved, generated imagery is not painted or warped during production import.'
    (OUT/'generation.json').write_text(json.dumps(generation,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    sheet = Image.new('RGB',(950,290),'#F3E9D2')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
    draw = ImageDraw.Draw(sheet)
    for i,record in enumerate([r for r in records if not r['key'].startswith('bg_')]):
        art = Image.open(record['file']).convert('RGBA')
        art.thumbnail((200 if i==0 else 600,190),Image.Resampling.LANCZOS)
        x = 35 if i==0 else 290
        sheet.paste(art,(x,25+(190-art.height)//2),art)
        draw.text((x,240),record['key'],fill='#29313B',font=font)
    sheet.save(OUT/'asset-contact-sheet.jpg',quality=93)
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records)}))


if __name__=='__main__':
    main()
