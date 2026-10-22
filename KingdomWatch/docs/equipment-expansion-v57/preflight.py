from pathlib import Path
import difflib,hashlib,json,re
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
before=json.loads(read(HERE/'before.json'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
changed=sorted(n for n,h in before.items() if sha(ROOT/n)!=h)
assert changed==['assets/scripts/core/GameData.ts','assets/scripts/ui/HeroComic.ts','assets/scripts/ui/pages/ShopPage.ts'],changed
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log'))==norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS')==10
diff=''.join(''.join(difflib.unified_diff(read(HERE/'before'/n).splitlines(True),read(ROOT/n).splitlines(True),fromfile='before/'+n,tofile='after/'+n))for n in changed)
(HERE/'review.diff').write_text(diff,encoding='utf-8')
print(diff)
print('1932-file snapshot: only 3 intended scripts changed; type diagnostics unchanged.')
