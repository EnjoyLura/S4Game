"""Capture pre-edit source/media hashes; no game or test execution."""
from pathlib import Path
import hashlib, json, shutil
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
if (HERE/'before.json').exists(): raise ValueError('Snapshot already exists')
files = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
    for directory in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/directory).rglob('*') if p.is_file()}
(HERE/'before.json').write_text(json.dumps(files, indent=2), encoding='utf8')
for n in ['config/LevelDifficulty.ts','ui/pages/LevelsPage.ts']:
    source = ROOT/'assets/scripts'/n
    destination = HERE/'before/assets/scripts'/n
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
shutil.copy2(ROOT/'docs/sixth-level-balance-v47/types-after.log', HERE/'types-before.log')
print('Captured', len(files), 'original files')
