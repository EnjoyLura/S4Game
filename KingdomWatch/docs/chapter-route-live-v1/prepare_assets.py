"""Copy selected imagegen originals unchanged and describe Cocos imports."""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import struct
import uuid

out = Path(__file__).resolve().parent
game = out.parents[1]
origin = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3')
selected = {
    'outpost': 'exec-f7a4b0a2-de19-4253-99b3-3c44ac6719f9.png',
    'forest': 'exec-7537bdb4-e93d-468f-bbe4-454c701e92f8.png',
    'lair': 'exec-68f76fcb-d8d1-4f81-ab0f-4ddcc650ac66.png',
}
template = json.loads((game / 'assets/resources/scenes/bg_levels_outpost_comic_v2.jpg.meta').read_text(encoding='utf-8-sig'))
records = []
for chapter, filename in selected.items():
    src = origin / filename
    data = src.read_bytes()
    w, h = struct.unpack('>II', data[16:24])
    dst = game / ('assets/resources/scenes/bg_campaign_' + chapter + '_v1.png')
    if dst.exists() and dst.read_bytes() != data:
        raise RuntimeError('Do not overwrite another selected image: ' + str(dst))
    shutil.copyfile(src, dst)
    meta_path = dst.with_suffix('.png.meta')
    if not meta_path.exists():
        meta = copy.deepcopy(template)
        image_uuid = str(uuid.uuid4())
        old_uuid = meta['uuid']
        meta['uuid'] = image_uuid
        meta['files'] = ['.png', '.json']
        for sub in meta['subMetas'].values():
            sub['uuid'] = sub['uuid'].replace(old_uuid, image_uuid)
            sub['displayName'] = dst.stem
            user = sub['userData']
            user['imageUuidOrDatabaseUri'] = user['imageUuidOrDatabaseUri'].replace(old_uuid, image_uuid)
            if sub['importer'] == 'sprite-frame':
                user.update(width=w, height=h, rawWidth=w, rawHeight=h, trimX=0, trimY=0, offsetX=0, offsetY=0, packable=False)
                user.pop('vertices', None)
        meta['userData']['hasAlpha'] = data[25] in (4, 6)
        meta['userData']['redirect'] = meta['userData']['redirect'].replace(old_uuid, image_uuid)
        meta_path.write_text(json.dumps(meta, indent=2), encoding='utf-8')
    records.append({'chapter': chapter, 'source': str(src), 'path': dst.relative_to(game).as_posix(),
        'width': w, 'height': h, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'pixelEditing': False})
code_meta = game / 'assets/scripts/ui/CampaignRoute.ts.meta'
if not code_meta.exists():
    meta = json.loads((game / 'assets/scripts/ui/pages/LevelsPage.ts.meta').read_text(encoding='utf-8-sig'))
    meta['uuid'] = str(uuid.uuid4())
    code_meta.write_text(json.dumps(meta, indent=2), encoding='utf-8')
(out / 'art.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(records))
