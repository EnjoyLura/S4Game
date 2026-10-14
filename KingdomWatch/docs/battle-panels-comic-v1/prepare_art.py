"""Import the two generated comic emblems, preserving alpha and source images."""
from pathlib import Path
from PIL import Image
import importlib.util
import json
import shutil
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/battle_comic_v1'
module = importlib.util.spec_from_file_location('shop_art', GAME / 'docs/shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(module)
module.loader.exec_module(shop)

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    (OUT / 'sources').mkdir(exist_ok=True)
    folder = DEST.with_suffix('.meta')
    if not folder.exists():
        value = json.loads((DEST.parent / 'shop_comic_v1.meta').read_text(encoding='utf-8'))
        value['uuid'] = str(uuid.uuid4())
        folder.write_text(json.dumps(value, indent=2), encoding='utf-8')
    spec = json.loads((OUT / 'generation.json').read_text(encoding='utf-8'))
    records = []
    for entry in spec['sources']:
        key = entry['key']
        raw = OUT / 'sources' / (key + '.png')
        if not raw.exists():
            shutil.copy2(entry['path'], raw)
        source = Image.open(raw).convert('RGBA')
        assert source.getchannel('A').getextrema()[0] == 0, 'Actual alpha required'
        source.putalpha(source.getchannel('A').point(lambda a: 0 if a < 8 else a))
        bounds = source.getchannel('A').getbbox()
        assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < source.width and bounds[3] < source.height
        subject = source.crop(bounds)
        subject.thumbnail((224, 224), Image.Resampling.LANCZOS)
        image = Image.new('RGBA', (256, 256))
        image.alpha_composite(subject, ((256 - subject.width) // 2, (256 - subject.height) // 2))
        output = DEST / (key + '.png')
        image.save(output, optimize=True)
        shop.metadata(output, image.width, image.height)
        records.append({'key': key, 'file': str(output), 'width': image.width, 'height': image.height, 'bytes': output.stat().st_size})
    (OUT / 'assets.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'imported': len(records), 'bytes': sum(r['bytes'] for r in records)}))

if __name__ == '__main__':
    main()
