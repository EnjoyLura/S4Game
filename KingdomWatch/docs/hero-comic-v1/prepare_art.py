"""Normalize generated hero illustrations, preserve alpha, and import Creator assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import importlib.util
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/hero_comic_v1'
GENERATED = Path('C:/Users/user/.codex/generated_images/01a11c03-afa8-7ef0-834a-a47cbda4a411')
CLEANED = {
    'archer': 'exec-e07c1784-f1ac-4a4b-80d4-53681530d299.png',
    'sniper': 'exec-984442a9-954d-421a-ab38-0e62990df8c0.png',
    'pyro': 'exec-61b053c7-87de-4686-8221-2940661779da.png',
    'volt': 'exec-2215e433-f5d6-4b17-9df7-dd0ab2a4e059.png',
    'mora': 'exec-bee96785-aedc-49e1-ace4-bebcfa3d48c5.png',
}
spec = importlib.util.spec_from_file_location('shop_import', OUT.parent/'shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shop)


def unique_meta(template, dest):
    if dest.exists():
        return
    value = json.loads(template.read_text(encoding='utf-8'))
    value['uuid'] = str(uuid.uuid4())
    dest.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    generation = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    DEST.mkdir(parents=True, exist_ok=True)
    raw_dir = OUT/'sources'
    raw_dir.mkdir(exist_ok=True)
    records = []
    for entry in generation['sources']:
        key = entry['key']
        original = Path(entry.get('initialPath', entry['path']))
        source_path = original
        if key.startswith('comic_figure_'):
            source_path = GENERATED / CLEANED[key.removeprefix('comic_figure_').removesuffix('_v1')]
            entry.update(initialPath=str(original), path=str(source_path),
                         cleanup={'tool': 'built-in imagegen',
                                  'purpose': 'Edit the initial full-body illustration to reduce external glow and haze while preserving identity, pose and genuine transparency.'})
            shutil.copy2(original, raw_dir/(key+'-initial.png'))
        raw = raw_dir/(key+'.png')
        shutil.copy2(source_path, raw)
        source = Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            output = GAME/'assets/resources/scenes'/(key+'.jpg')
            source = source.convert('RGB')
            source.save(output, quality=93, optimize=True)
        else:
            assert source.getchannel('A').getextrema()[0] == 0, 'Missing transparent background: '+key
            # Ignore only nearly invisible alpha dust when choosing canvas bounds; keep source pixels unchanged.
            bounds = source.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox()
            assert bounds
            subject = source.crop(bounds)
            if key.startswith('comic_figure_'):
                h = 736
                w = round(subject.width*h/subject.height)
                subject = subject.resize((w,h), Image.Resampling.LANCZOS)
                source = Image.new('RGBA', (w+32,768))
                source.alpha_composite(subject,(16,16))
            else:
                subject.thumbnail((338,338), Image.Resampling.LANCZOS)
                source = Image.new('RGBA',(384,384))
                source.alpha_composite(subject,((384-subject.width)//2,(384-subject.height)//2))
            output = DEST/(key+'.png')
            source.save(output,optimize=True)
        shop.metadata(output,source.width,source.height)
        records.append({'key':key,'file':str(output),'width':source.width,'height':source.height,
                        'bytes':output.stat().st_size,'source':str(raw)})
    unique_meta(GAME/'assets/resources/ux/shop_comic_v1.meta',DEST.with_suffix('.meta'))
    unique_meta(GAME/'assets/scripts/ui/ComicUI.ts.meta',GAME/'assets/scripts/ui/HeroComic.ts.meta')
    generation['import'] = 'Proportional resizing only. Figures have a 768px canvas and 16px foot margin. Background, figures and portrait retain their generated visual design.'
    (OUT/'generation.json').write_text(json.dumps(generation,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
    sheet = Image.new('RGB',(1300,670),'#F3E9D2')
    draw = ImageDraw.Draw(sheet)
    for i,entry in enumerate([r for r in records if 'figure' in r['key']]):
        art = Image.open(entry['file']).convert('RGBA')
        art.thumbnail((240,550),Image.Resampling.LANCZOS)
        sheet.paste(art,(i*260+(260-art.width)//2,30+(550-art.height)),art)
        draw.text((i*260+65,605),entry['key'].split('_')[2],fill='#292D34',font=font)
    sheet.save(OUT/'asset-contact-sheet.jpg',quality=93)
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records),'sheet':str(OUT/'asset-contact-sheet.jpg')}))


if __name__ == '__main__':
    main()
