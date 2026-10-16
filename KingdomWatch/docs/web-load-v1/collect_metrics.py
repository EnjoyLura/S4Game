"""Offline build inventory, not a startup benchmark."""
from pathlib import Path
import gzip
import json
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game / 'build/web-mobile'
rows = []
for path in build.rglob('*'):
    if not path.is_file() or 'previews' in path.relative_to(build).parts:
        continue
    rel = path.relative_to(build).as_posix()
    if path.suffix in ['.js', '.json', '.css', '.html']:
        data = path.read_bytes()
        compressed = len(gzip.compress(data, compresslevel=9, mtime=0))
    else:
        compressed = None
    rows.append({'path': rel, 'bytes': path.stat().st_size, 'offlineGzipBytes': compressed})
scripts = [r for r in rows if r['path'].endswith('.js') and not r['path'].endswith('.map')]
startup = [r for r in scripts if r['path'].startswith(('cocos-js/', 'assets/main/', 'src/')) or '/' not in r['path']]
record = {'mode': 'offline size inventory; no measured network or startup time',
    'totalFiles': len(rows), 'totalBytes': sum(r['bytes'] for r in rows),
    'scriptsBytes': sum(r['bytes'] for r in scripts), 'scriptsGzipEstimateBytes': sum(r['offlineGzipBytes'] for r in scripts),
    'startupScripts': startup, 'files': rows}
target = out / (sys.argv[1] + '-metrics.json')
target.write_text(json.dumps(record, indent=2), encoding='utf-8')
print(json.dumps({k: record[k] for k in ['totalFiles', 'totalBytes', 'scriptsBytes', 'scriptsGzipEstimateBytes']}))
