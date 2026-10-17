"""Copy original generated pixels unchanged and describe the sprite crop in Cocos metadata."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import shutil
import uuid

out = Path(__file__).resolve().parent
game = out.parents[1]
source = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-8674bc34-9feb-43f0-b7b9-69edaa09878f.png')
folder = game / 'assets/resources/ux/campaign_chrome_v1'
target = folder / 'chapter_banner_v1.png'
folder.mkdir(exist_ok=True)
if target.exists():
    raise RuntimeError('Do not overwrite a versioned source asset.')
shutil.copyfile(source, target)
original = Image.open(source)
alpha = original.getchannel('A')
# Exclude only the empty canvas; alpha >=4 bounds are (19,217,2080,512).
# The PNG itself is never cropped, resampled, repainted, or recompressed.
x, y, width, height = 16, 216, 2068, 298
raw_width, raw_height = original.size
asset_uuid = str(uuid.uuid4())
directory_meta = {'ver': '1.2.0', 'importer': 'directory', 'imported': True,
    'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}}
folder.with_suffix('.meta').write_text(json.dumps(directory_meta, indent=2), encoding='utf-8')
meta = json.loads((game / 'assets/resources/ux/levels_comic_v1/comic_star_v1.png.meta').read_text(encoding='utf-8-sig'))
old_uuid = meta['uuid']
meta = json.loads(json.dumps(meta).replace(old_uuid, asset_uuid).replace('comic_star_v1', 'chapter_banner_v1'))
data = meta['subMetas']['f9941']['userData']
data.update(trimX=x, trimY=y, width=width, height=height, rawWidth=raw_width, rawHeight=raw_height,
    offsetX=x+width/2-raw_width/2, offsetY=raw_height/2-y-height/2, packable=False, trimType='custom')
data['vertices'].update(
    rawPosition=[-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
    uv=[x,y+height,x+width,y+height,x,y,x+width,y],
    nuv=[x/raw_width,1-(y+height)/raw_height,(x+width)/raw_width,1-(y+height)/raw_height,
         x/raw_width,1-y/raw_height,(x+width)/raw_width,1-y/raw_height],
    minPos=[-width/2,-height/2,0], maxPos=[width/2,height/2,0])
target.with_suffix('.png.meta').write_text(json.dumps(meta, indent=2), encoding='utf-8')
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
report = {'tool': 'built-in image_gen', 'source': str(source), 'asset': target.relative_to(game).as_posix(),
    'prompt': 'banner-prompt.txt', 'reference': 'C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-e239edc5-b7f6-4583-ba68-26880618a363.png',
    'mode': original.mode, 'sourceSize': original.size, 'spriteRect': [x,y,width,height],
    'alphaRange': alpha.getextrema(), 'alphaBBoxAt4': alpha.point(lambda v:255 if v>=4 else 0).getbbox(),
    'sourceSha256': sha(source), 'assetSha256': sha(target), 'originalPixelsUnchanged': sha(source)==sha(target),
    'assetUuid': asset_uuid, 'bytes': target.stat().st_size, 'acceptance': 'pending user manual review'}
(out / 'art-provenance.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
