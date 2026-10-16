"""Copy built-in ImageGen deliverables unchanged and prepare Cocos sprite metadata."""
from pathlib import Path
import json
import shutil
import struct
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
GENERATED = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3')
ASSETS = [
    ('sniper_range', '远距校准', 'exec-9bead2a5-48d0-45cc-a17a-866fb8f2c6ec.png'),
    ('sniper_pierce', '贯颅弩矢', 'exec-1a9fb8d3-79c9-4d07-925c-1aa88f5852e3.png'),
    ('sniper_mark', '死亡准星', 'exec-4ab518f4-28d2-4bfa-b44b-5c2bd3d3c8de.png'),
]
template = json.loads((GAME/'assets/resources/ux/ui_card_execute.png.meta').read_text(encoding='utf-8-sig'))
manifest = []
for key, name, source_name in ASSETS:
    source = GENERATED/source_name
    destination = GAME/'assets/resources/ux'/('ui_card_' + key + '_v1.png')
    if destination.exists():
        raise RuntimeError(f'Preserve existing asset: {destination}')
    shutil.copy2(source, destination)
    width, height = struct.unpack('>II', source.read_bytes()[16:24])
    uid = str(uuid.uuid4())
    meta = json.loads(json.dumps(template).replace(template['uuid'], uid).replace('ui_card_execute', destination.stem))
    frame = meta['subMetas']['f9941']['userData']
    frame.update(offsetX=0, offsetY=0, trimX=0, trimY=0, width=width, height=height,
        rawWidth=width, rawHeight=height)
    frame['vertices'] = {
        'rawPosition': [-width/2, -height/2, 0, width/2, -height/2, 0,
            -width/2, height/2, 0, width/2, height/2, 0],
        'indexes': [0, 1, 2, 2, 1, 3],
        'uv': [0, height, width, height, 0, 0, width, 0],
        'nuv': [0, 0, 1, 0, 0, 1, 1, 1],
        'minPos': [-width/2, -height/2, 0], 'maxPos': [width/2, height/2, 0],
    }
    destination.with_suffix('.png.meta').write_text(json.dumps(meta, indent=2), encoding='utf-8')
    manifest.append(dict(card=key, name=name, source=str(source), asset=str(destination),
        resource=destination.stem, width=width, height=height, uuid=uid,
        mode='built-in image_gen', pixels='unchanged; generated alpha preserved'))
(OUT/'art-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(copied=len(manifest), assets=[item['asset'] for item in manifest])))
