"""Inspect saved source and built files without executing game code."""
from pathlib import Path
import hashlib
import json

out = Path(__file__).resolve().parent
game = out.parents[1]
web = game / 'build/web-mobile'
source_path = game / 'assets/scripts/ui/pages/HeroPage.ts'
source = source_path.read_text(encoding='utf-8-sig')
before = (out / 'HeroPage.before.ts.txt').read_text(encoding='utf-8-sig')
start, end = 'function drawSlot(', 'function equipIcon('
if before.split(start)[0] != source.split(start)[0] or before.split(end)[1] != source.split(end)[1]:
    raise RuntimeError('Unexpected source edits outside drawSlot')
release = json.loads((web / 'web-release.json').read_text(encoding='utf-8'))
if not release['production'] or not release['md5Cache'] or not (web / '_headers').is_file():
    raise RuntimeError('Prepared production build required')
main, = (web / 'assets/main').glob('index.*.js')
compiled = main.read_text(encoding='utf-8')
at = compiled.index('heroEquipped:')
fragment = compiled[at:compiled.index('function ', at)]
if fragment.count('align:"center"') != 2 or 'heroGearSocket' not in fragment:
    raise RuntimeError('Centered weapon labels missing from bundle')
record = {
    'mode': 'source and local artifact review only; no game execution',
    'sourceScope': 'drawSlot only; square slots retain their existing branch',
    'socket': {'width': 252, 'height': 104, 'halfWidth': 126,
        'artCenter': [-63, 0], 'artBounds': [-118, -8, -45, 45],
        'textCenterX': 63, 'textBoundsX': [8, 118], 'nameBoundsY': [-1, 29],
        'metadataBoundsY': [-32, -6], 'labelOverflow': 'existing SHRINK'},
    'mainBundle': main.relative_to(web).as_posix(),
    'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
    'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
    'compiledSlot': fragment,
    'production': release['production'], 'md5Cache': release['md5Cache'],
    'DPRPatch': 'completed by tools/build-web.ps1',
    'visualAcceptance': 'pending user manual review',
}
(out / 'bundle-inspection.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'mainBundle': record['mainBundle'], 'scope': 'drawSlot only', 'production': True}))
