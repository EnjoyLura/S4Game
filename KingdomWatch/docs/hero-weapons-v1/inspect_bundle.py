"""Offline file inspection only; does not execute game code."""
from pathlib import Path
import hashlib
import json

out = Path(__file__).resolve().parent
game = out.parents[1]
bundle = game / 'build/web-mobile'
resource = bundle / 'assets/resources'
config = json.loads((resource / 'config.json').read_text(encoding='utf-8'))
assets = json.loads((out / 'imagegen-assets.json').read_text(encoding='utf-8'))['assets']
rows = []
for item in assets:
    name = item['name']
    source = game / 'assets/resources/ux/weapons_v1' / (name + '.png')
    meta = json.loads(source.with_suffix('.png.meta').read_text(encoding='utf-8'))
    uuid = meta['uuid']
    native = resource / 'native' / uuid[:2] / (uuid + '.png')
    path = 'ux/weapons_v1/' + name + '/spriteFrame'
    frame = meta['subMetas']['f9941']['uuid']
    if config['paths'].get(frame, [None])[0] != path:
        raise RuntimeError('Missing resource path: ' + path)
    digest = hashlib.sha256(native.read_bytes()).hexdigest()
    if digest != item['sha256']:
        raise RuntimeError('Native image changed: ' + name)
    rows.append({'name': name, 'spriteFrame': path, 'uuid': uuid,
        'nativeBytes': native.stat().st_size, 'sha256': digest})
main_bytes = (bundle / 'assets/main/index.js').read_bytes()
main = main_bytes.decode('utf-8')
snippets = [
    'var CRATER_R = 88 * 1.3 * 1.2;',
    'var CLOSED_HOLD_SECONDS = 1.5;',
    "var FROST_ULT_RAIN_COUNT = exports('FROST_ULT_RAIN_COUNT', 256);",
    "RAIN_CAP = FROST_ULT_RAIN_COUNT,",
    "var uid = 'starter_weapon_' + hid;",
]
for snippet in snippets:
    if snippet not in main:
        raise RuntimeError('Missing compiled source: ' + snippet)
record = {'mode': 'offline file inspection; game code not executed',
    'assets': rows, 'compiledSnippets': snippets,
    'mainBundleSha256': hashlib.sha256(main_bytes).hexdigest()}
(out / 'bundle-inspection.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'weaponImagesPresent': len(rows), 'compiledSnippetsPresent': len(snippets)}))
