"""Read local compiled files only; never start the game or invoke its code."""
from pathlib import Path
import hashlib
import json

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game / 'build/web-mobile'
main = max((build / 'assets/main').glob('index.*.js'), key=lambda p:p.stat().st_mtime)
code = main.read_text(encoding='utf-8')
resources = max((build / 'assets/resources').glob('config.*.json'), key=lambda p:p.stat().st_mtime)
catalog = resources.read_text(encoding='utf-8')
assets = json.loads((out / 'imagegen-assets.json').read_text(encoding='utf-8'))
image_records = []
for asset in assets:
    sprite = 'ux/' + asset['artKey'] + '/spriteFrame'
    matches = list((build / 'assets/resources/native').rglob(asset['uuid'] + '*.png'))
    image_records.append({'artKey': asset['artKey'], 'spriteFrame': sprite,
                          'inCatalog': sprite in catalog,
                          'nativeImages': [p.relative_to(build).as_posix() for p in matches],
                          'nativeHashes': [hashlib.sha256(p.read_bytes()).hexdigest() for p in matches]})
record = {'mainBundle': main.relative_to(build).as_posix(),
          'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
          'mainBundleBytes': main.stat().st_size,
          'newBowReferences': {s: s in code for s in ['starter_bow_v2', 'green_bow_v2']},
          'neutralPlateMarker': 'gearItemPlate' in code,
          'removedColoredFrameMarker': 'gearQualityFrame' not in code,
          'circularWellAndTag': {s: s in code for s in ['gearQualityHalo', 'gearQualityTag']},
          'images': image_records,
          'inspection': 'read local source, catalog, compiled text and PNG hashes only; no tests/game/browser/online checks',
          'manualAcceptance': 'pending user'}
(out / 'bundle-inspection.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(record, ensure_ascii=False))
