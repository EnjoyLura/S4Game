"""Prepare a scoped publication script and source delta from this turn's snapshots."""
from pathlib import Path
import difflib
import hashlib
import json

out = Path(__file__).resolve().parent
game = out.parents[1]
paths = ['assets/scripts/ui/HeroComic.ts', 'assets/scripts/config/Weapons.ts',
         'assets/scripts/ui/GearQuality.ts', 'assets/scripts/ui/pages/ShopPage.ts',
         'assets/scripts/ui/pages/HeroPage.ts', 'assets/scripts/ui/LevelLootPreview.ts']
diffs = []
hashes = {}
for rel in paths:
    path = game / rel
    before = (out / (path.name + '.before.txt')).read_text(encoding='utf-8-sig')
    current = path.read_text(encoding='utf-8-sig')
    diffs.extend(difflib.unified_diff(before.splitlines(True), current.splitlines(True), fromfile=rel+' (before)', tofile=rel))
    hashes[rel] = hashlib.sha256(path.read_bytes()).hexdigest()
(out / 'source-review.diff').write_text(''.join(diffs), encoding='utf-8')
(out / 'source-hashes.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
script = (game / 'docs/equipment-quality-v1/publish.ps1').read_text(encoding='utf-8-sig')
script = script.replace('docs/training-weapon-float-v1/deployment-stage.json', 'docs/equipment-quality-v1/deployment-stage.json')
script = script.replace('equipment-settlement-v1', 'archer-art-quality-v2')
script = script.replace('equipment rarity; clickable drop previews; locked monster silhouettes; battle-exit gates; animated reward-only settlement; durable defeat floor and revival deduplication; brighter blue sniper aim',
                        'new front archer standing illustration and two simplified bows; neutral equipment panels with rarity only on circular wells and upper-left tags')
(out / 'publish.ps1').write_text(script, encoding='utf-8')
print(json.dumps({'sources': len(paths), 'diffLines': len(diffs), 'publisher': str(out / 'publish.ps1')}))
