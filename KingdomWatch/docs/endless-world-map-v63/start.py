from pathlib import Path
import hashlib,json,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
assert not (HERE/'before.json').exists()
files={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for name in ['assets/scripts','assets/resources','build-templates','tools'] for p in (ROOT/name).rglob('*') if p.is_file()}
(HERE/'before.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
for p in (ROOT/'assets/scripts').rglob('*.ts'):
    target=HERE/'before'/p.relative_to(ROOT/'assets/scripts')
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(p,target)
shutil.copy2(ROOT/'docs/endless-challenge-v59/types-after.log',HERE/'types-before.log')
print('Snapshot:',len(files),'original files')

