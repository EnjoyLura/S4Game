from pathlib import Path
import hashlib,json,re,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert not (HERE/'before.json').exists()
files={p.relative_to(ROOT).as_posix():sha(p) for name in ['assets/scripts','assets/resources','build-templates','tools'] for p in (ROOT/name).rglob('*') if p.is_file()}
(HERE/'before.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
shutil.copy2(ROOT/'assets/scripts/battle/Hero.ts',HERE/'Hero.before.ts')
shutil.copy2(ROOT/'docs/equipment-expansion-v57/types-after.log',HERE/'types-before.log')
bundle=next((ROOT/'build/web-mobile/assets/main').glob('index.*.js'))
sections=re.findall(r'.{0,80}key:"ultShowDuration".{0,290}',read(bundle))
assert any('prototype.ultShowDuration' in s for s in sections)
(HERE/'before-bundle-getters.json').write_text(json.dumps(dict(bundle=str(bundle),getters=sections),ensure_ascii=False,indent=2),encoding='utf-8')
print('Snapshot:',len(files),'files; production bundle confirms super getter lowered to prototype access.')
