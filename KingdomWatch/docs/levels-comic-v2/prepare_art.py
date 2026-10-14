"""Import three continuous scenes without changing their composition or proportions."""
from pathlib import Path
from PIL import Image
import importlib.util
import json
import shutil

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location('shop_art', OUT.parent/'shop-comic-v1/prepare_art.py')
shop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shop)

def main():
    generation = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    (OUT/'sources').mkdir(exist_ok=True)
    assets = []
    for i, source in enumerate(generation['sources']):
        source = json.loads((OUT/(source['key']+'.generation.json')).read_text(encoding='utf-8'))
        original = Path(source['path'])
        assert original.is_file(), original
        raw = OUT/'sources'/(source['key']+'.png')
        shutil.copy2(original, raw)
        image = Image.open(raw).convert('RGB')
        assert .65 < image.width/image.height < .85, 'Portrait scene required'
        output = GAME/'assets/resources/scenes'/(source['key']+'.jpg')
        image.save(output, quality=93, optimize=True)
        shop.metadata(output, image.width, image.height)
        generation['sources'][i] = source
        assets.append({'key':source['key'],'file':str(output),'width':image.width,
                       'height':image.height,'bytes':output.stat().st_size})
    (OUT/'generation.json').write_text(json.dumps(generation,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'imported':len(assets),'bytes':sum(a['bytes'] for a in assets)}))

if __name__ == '__main__':
    main()
