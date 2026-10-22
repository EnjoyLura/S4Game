from pathlib import Path
import hashlib, json, shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
folders = ['assets/scripts', 'assets/resources', 'build-templates', 'tools']
hashes = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
          for folder in folders for p in (ROOT / folder).rglob('*') if p.is_file()}
assert not (HERE / 'before.json').exists(), 'Do not overwrite the original snapshot'
(HERE / 'before.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
for name in ['assets/scripts/config/Cards.ts', 'assets/scripts/battle/Hero.ts',
             'assets/scripts/battle/Projectile.ts', 'assets/scripts/battle/Monster.ts',
             'assets/scripts/ui/Panels.ts', 'assets/scripts/ui/PickArt.ts']:
    dst = HERE / 'before' / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / name, dst)
print('Original files snapshotted:', len(hashes))
