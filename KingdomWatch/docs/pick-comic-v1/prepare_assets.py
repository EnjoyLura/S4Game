"""Import individually generated original paper UI assets, preserving their artwork and alpha."""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import uuid
from PIL import Image

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME/'assets/resources/ux/pick_comic_v1'
SOURCES = {
    'card_base': 'C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-db5658b7-ad9e-4a2b-a22b-f56195d8efc2.png',
    'title_plate': 'C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-a9eabb95-5782-41c3-b489-20f163bb2940.png',
    'header_strip': 'C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-087dff79-cd31-4306-8037-5ca302eeb568.png',
}

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    (OUT/'sources').mkdir(exist_ok=True)
    spec = importlib.util.spec_from_file_location('shop_metadata', GAME/'docs/shop-comic-v1/prepare_art.py')
    meta = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(meta)
    records = []
    for key, path in SOURCES.items():
        source = Path(path)
        saved = OUT/'sources'/f'{key}.png'
        shutil.copy2(source, saved)
        image = Image.open(saved).convert('RGBA')
        if image.getchannel('A').getextrema()[0] != 0:
            raise RuntimeError('Real exterior transparency required: '+key)
        image.putalpha(image.getchannel('A').point(lambda a: 0 if a<8 else a))
        box = image.getchannel('A').getbbox()
        if not box or min(box[:2]) <= 0 or box[2] >= image.width or box[3] >= image.height:
            raise RuntimeError('Asset lacks a complete transparent margin: '+key)
        cropped = image.crop(box)
        output = DEST/f'{key}.png'
        cropped.save(output, optimize=True)
        meta.metadata(output, *cropped.size)
        records.append({'key': key, 'file': str(output), 'size': list(cropped.size),
            'source': str(saved), 'sourceRect': list(box), 'bytes': output.stat().st_size,
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'prompt': f'prompts/{key}.txt'})
    directory_meta = Path(str(DEST)+'.meta')
    if not directory_meta.exists():
        directory_meta.write_text(json.dumps({'ver': '1.2.0', 'importer': 'directory', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}},indent=2),encoding='utf-8')
    (OUT/'assets.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'generation.json').write_text(json.dumps({'mode': 'built-in imagegen', 'individualCalls': 3,
        'referencesSentToImageTool': [], 'copiedExternalGameAssets': False, 'sources': SOURCES,
        'processing': 'Trim transparent margins and alpha<8 dust only; preserve source artwork with no redraw or resampling',
        'userVisualAccepted': False},ensure_ascii=False,indent=2),encoding='utf-8')
    shutil.copy2('C:/Users/user/AppData/Local/Temp/codex-clipboard-972124fc-dff7-4dd4-af6c-b32773274823.png', OUT/'before-pick.png')
    print(json.dumps(records,ensure_ascii=True))

if __name__ == '__main__':
    main()
