"""Import illustrations, retain source alpha, normalize the icon and write Creator metadata."""
from pathlib import Path
from PIL import Image
import importlib.util
import json
import shutil
import uuid

OUT=Path(__file__).resolve().parent
GAME=OUT.parents[1]
DEST=GAME/'assets/resources/ux/base_comic_v1'
module=importlib.util.spec_from_file_location('shop_art',GAME/'docs/shop-comic-v1/prepare_art.py')
shop=importlib.util.module_from_spec(module);module.loader.exec_module(shop)

def main():
    DEST.mkdir(parents=True,exist_ok=True);(OUT/'sources').mkdir(exist_ok=True)
    folder=DEST.with_suffix('.meta')
    if not folder.exists():
        value=json.loads((DEST.parent/'shop_comic_v1.meta').read_text(encoding='utf-8'));value['uuid']=str(uuid.uuid4())
        folder.write_text(json.dumps(value,indent=2),encoding='utf-8')
    spec=json.loads((OUT/'generation.json').read_text(encoding='utf-8'));records=[]
    for entry in spec['sources']:
        key=entry['key'];raw=OUT/'sources'/(key+'.png')
        if not raw.exists():shutil.copy2(entry['path'],raw)
        source=Image.open(raw).convert('RGBA')
        if key.startswith('bg_'):
            output=GAME/'assets/resources/scenes'/(key+'.jpg');source.convert('RGB').save(output,quality=93,optimize=True)
        else:
            assert source.getchannel('A').getextrema()[0]==0,'Actual alpha required'
            source.putalpha(source.getchannel('A').point(lambda a:0 if a<8 else a))
            bounds=source.getchannel('A').getbbox();assert bounds and all((bounds[0]>0,bounds[1]>0,bounds[2]<source.width,bounds[3]<source.height)),'Clipped icon'
            subject=source.crop(bounds);subject.thumbnail((224,224),Image.Resampling.LANCZOS)
            source=Image.new('RGBA',(256,256));source.alpha_composite(subject,((256-subject.width)//2,(256-subject.height)//2))
            output=DEST/(key+'.png');source.save(output,optimize=True)
        shop.metadata(output,source.width,source.height)
        records.append({'key':key,'file':str(output),'width':source.width,'height':source.height,'bytes':output.stat().st_size})
    shutil.copy2(spec['edit']['original'],OUT/'sources/bg_base_comic_v1-initial.png')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'imported':len(records),'bytes':sum(r['bytes'] for r in records)}))

if __name__=='__main__':main()
