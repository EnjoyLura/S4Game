"""Import vector-produced skin PNGs without changing their dimensions."""
from pathlib import Path
import importlib.util
import json
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location('shop_art_meta', GAME / 'docs/shop-comic-v1/prepare_art.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for row in json.loads((OUT / 'assets.json').read_text()):
    module.metadata(Path(row['file']), row['width'], row['height'])
folder = GAME / 'assets/resources/ux/battle_skin_v2.meta'
if not folder.exists():
    folder.write_text(json.dumps({'ver': '1.2.0', 'importer': 'directory', 'imported': True,
                                 'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}}, indent=2))
print('Imported 14 skin assets')
