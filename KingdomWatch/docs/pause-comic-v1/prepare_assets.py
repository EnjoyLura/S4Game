"""Extract intact generated UI sprites; preserve their original RGB and alpha pixels."""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import uuid
from PIL import Image

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
DEST = GAME / 'assets/resources/ux/pause_comic_v1'
ORIGINAL = Path('C:/Users/user/.codex/generated_images/01a12e7c-9e87-72e0-b3ff-bca4a58686b3/exec-fc1138f2-85d3-4a10-b50c-614aa3996a82.png')
REGIONS = {
    'title_ribbon': (100, 15, 1160, 195),
    'button_gold': (20, 195, 625, 405),
    'button_green': (625, 195, 1235, 405),
    'tab_neutral': (15, 410, 1240, 565),
    'tab_gold': (15, 570, 1240, 725),
    'settings_row': (15, 730, 1240, 880),
    'switch_on': (100, 880, 450, 1028),
    'switch_off': (460, 880, 800, 1028),
    'switch_disabled': (810, 880, 1150, 1028),
    'reward_socket': (295, 1028, 540, 1250),
    'button_muted': (570, 1060, 995, 1220),
}

def main():
    OUT.mkdir(exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ORIGINAL, OUT / 'source-atlas.png')
    source = Image.open(ORIGINAL).convert('RGBA')
    if source.size != (1254, 1254):
        raise ValueError('Source dimensions changed; annotate new extraction regions first')
    if source.getchannel('A').getextrema()[0] != 0:
        raise ValueError('Expected generated true transparency')
    spec = importlib.util.spec_from_file_location('shop_meta', GAME / 'docs/shop-comic-v1/prepare_art.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    records = []
    for key, region in REGIONS.items():
        section = source.crop(region)
        bbox = section.getchannel('A').point(lambda a: 255 if a >= 24 else 0).getbbox()
        if not bbox:
            raise ValueError('Missing sprite: ' + key)
        # Include the antialiased fringe, without recoloring, redrawing or resampling.
        bounds = (max(0, bbox[0]-2), max(0, bbox[1]-2), min(section.width, bbox[2]+2), min(section.height, bbox[3]+2))
        sprite = section.crop(bounds)
        target = DEST / (key + '.png')
        sprite.save(target, optimize=True)
        module.metadata(target, *sprite.size)
        absolute = [region[0]+bounds[0], region[1]+bounds[1], region[0]+bounds[2], region[1]+bounds[3]]
        records.append({'key': key, 'file': str(target), 'width': sprite.width, 'height': sprite.height,
                        'sourceRect': absolute, 'bytes': target.stat().st_size,
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    folder_meta = DEST.with_suffix('.meta')
    if not folder_meta.exists():
        folder_meta.write_text(json.dumps({'ver': '1.2.0', 'importer': 'directory', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
    code_meta = GAME / 'assets/scripts/ui/PausePanelSkin.ts.meta'
    if not code_meta.exists():
        code_meta.write_text(json.dumps({'ver': '4.0.24', 'importer': 'typescript', 'imported': True,
            'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
    (OUT / 'assets.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'generation.json').write_text(json.dumps({'tool': 'built-in image_gen', 'original': str(ORIGINAL),
        'source': str(OUT / 'source-atlas.png'), 'transparentBackground': True,
        'references': ['docs/shop-comic-v1/style-reference.png', 'user pause screenshot'],
        'prompt': 'image-prompt.txt', 'spriteCount': len(records),
        'processing': 'Fixed-region crop only; original color and alpha pixels preserved'}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(records, ensure_ascii=False))

if __name__ == '__main__':
    main()
