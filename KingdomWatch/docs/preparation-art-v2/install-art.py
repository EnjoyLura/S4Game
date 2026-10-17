"""Install unchanged imagegen PNGs and declare tight display rectangles in Cocos metadata."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
import uuid

out = Path(__file__).resolve().parent
game = out.parents[1]
source_root = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3')
folder = game / 'assets/resources/ux/preparation_art_v2'
sources = {
    'chest_bronze_v2': 'exec-74962002-f8a1-4655-942d-3613755336c9.png',
    'chest_sapphire_v2': 'exec-bcb95e42-a734-4525-a648-5788a0202aa9.png',
    'chest_crimson_v2': 'exec-dfcac415-5065-4b3d-9775-8f4d41fe637e.png',
    'difficulty_normal_v2': 'exec-6f6fa295-836a-4376-a325-594c41fcb6c6.png',
    'difficulty_elite_v2': 'exec-04ec0150-4506-47bd-a567-397b4f25e722.png',
    'difficulty_hell_v2': 'exec-7da196b6-97a5-4f08-bd85-d91a09e5f7ab.png',
    'claim_button_v2': 'exec-770c783b-fcd9-4525-80a0-8172382bc311.png',
}
folder.mkdir(exist_ok=True)
directory_meta = {'ver':'1.2.0','importer':'directory','imported':True,'uuid':str(uuid.uuid4()),
    'files':[],'subMetas':{},'userData':{}}
folder.with_suffix('.meta').write_text(json.dumps(directory_meta, indent=2), encoding='utf-8')
template = json.loads((game/'assets/resources/ux/levels_comic_v1/comic_star_v1.png.meta').read_text(encoding='utf-8-sig'))
prompts = out / 'prompts'
prompts.mkdir(exist_ok=True)
chest_plan = json.loads((out/'chest-prompts.json').read_text())
icon_plan = json.loads((out/'icon-prompts.json').read_text())
records = []
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
for name, source_name in sources.items():
    source, target = source_root/source_name, folder/(name+'.png')
    if target.exists():
        raise RuntimeError('Versioned art already installed: '+name)
    shutil.copyfile(source,target)
    image = Image.open(source)
    alpha = image.getchannel('A')
    left,top,right,bottom = alpha.point(lambda v:255 if v>=4 else 0).getbbox()
    left,top,right,bottom = max(0,left-3),max(0,top-3),min(image.width,right+3),min(image.height,bottom+3)
    width,height = right-left,bottom-top
    asset_uuid = str(uuid.uuid4())
    meta = json.loads(json.dumps(template).replace(template['uuid'],asset_uuid).replace('comic_star_v1',name))
    data = meta['subMetas']['f9941']['userData']
    data.update(trimX=left,trimY=top,width=width,height=height,rawWidth=image.width,rawHeight=image.height,
        offsetX=left+width/2-image.width/2,offsetY=image.height/2-top-height/2,packable=False,trimType='custom')
    data['vertices'].update(rawPosition=[-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
        uv=[left,bottom,right,bottom,left,top,right,top],
        nuv=[left/image.width,1-bottom/image.height,right/image.width,1-bottom/image.height,
             left/image.width,1-top/image.height,right/image.width,1-top/image.height],
        minPos=[-width/2,-height/2,0],maxPos=[width/2,height/2,0])
    if name == 'claim_button_v2':
        data.update(borderLeft=120,borderRight=120,borderTop=55,borderBottom=55)
    target.with_suffix('.png.meta').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    if name.startswith('chest_'):
        spec = next(a for a in chest_plan['assets'] if a['id']==name)
        prompt = chest_plan['base']+spec['detail']
    elif name.startswith('difficulty_'):
        difficulty = next(d for d in icon_plan['difficulty'] if 'difficulty_'+d['id']+'_v2'==name)
        prompt = icon_plan['base']+difficulty['detail']+' '+icon_plan['states'][0]['detail']
    else:
        prompt = (out/'claim-prompt.txt').read_text(encoding='utf-8')
    (prompts/(name+'.txt')).write_text(prompt,encoding='utf-8')
    records.append({'id':name,'tool':'built-in image_gen','source':str(source),'asset':target.relative_to(game).as_posix(),
        'prompt':'prompts/'+name+'.txt','mode':image.mode,'sourceSize':image.size,'spriteRect':[left,top,width,height],
        'sourceSha256':sha(source),'assetSha256':sha(target),'originalPixelsUnchanged':sha(source)==sha(target),
        'alphaRange':alpha.getextrema(),'uuid':asset_uuid,'bytes':target.stat().st_size})
(out/'art-provenance.json').write_text(json.dumps({'reference':str(source_root/'exec-e239edc5-b7f6-4583-ba68-26880618a363.png'),
    'difficultyIconCount':3,'userCorrection':'one icon each for normal, elite and hell; shared selection and lock treatment',
    'assets':records,'acceptance':'pending user manual review'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'id':a['id'],'rect':a['spriteRect'],'unchanged':a['originalPixelsUnchanged']} for a in records]))
