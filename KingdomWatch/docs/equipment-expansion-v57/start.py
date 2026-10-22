from pathlib import Path
import hashlib, json, shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before={p.relative_to(ROOT).as_posix():sha(p) for folder in ['assets/scripts','assets/resources','build-templates','tools'] for p in (ROOT/folder).rglob('*') if p.is_file()}
assert not (HERE/'before.json').exists(), 'Snapshot already exists'
(HERE/'before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
for n in ['core/GameData.ts','ui/HeroComic.ts','ui/pages/ShopPage.ts','config/Weapons.ts']:
    dst=HERE/'before/assets/scripts'/n
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'assets/scripts'/n,dst)
shutil.copy2(ROOT/'docs/weapon-expansion-v56/types-after.log',HERE/'types-before.log')
print('Snapshot saved:',len(before),'files; existing work preserved.')
