"""Read-only HTTP/hash verification; does not start a browser, game or WASM."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


report = json.loads((ROOT / 'release.json').read_text(encoding='utf-8-sig'))
stage = Path(report['stage'])
old = json.loads((ROOT / 'before/docs/github-pages-publishing/deployment.json').read_text(encoding='utf-8-sig'))
previous = Path(old['stage'])
uuids = [json.loads((PROJECT / ('assets/resources/ux/' + name + '.png.meta')).read_text(encoding='utf-8'))['uuid']
         for name in ['chapter1_mob_walk_v81', 'chapter1_mob_walk_v84']]
native = [p for p in (previous / 'assets').rglob('native/**/*') if p.is_file()]
untargeted = [p for p in native if not any(p.name.startswith(uuid) for uuid in uuids)]
changed = [p.relative_to(previous).as_posix() for p in untargeted
           if not (stage / p.relative_to(previous)).is_file() or sha(p) != sha(stage / p.relative_to(previous))]
assert not changed, changed
opener = urllib.request.build_opener(urllib.request.ProxyHandler({'https': 'http://127.0.0.1:7897'}))
checks = []
for uuid in uuids:
    files = list(stage.glob('assets/resources/native/' + uuid[:2] + '/' + uuid + '*.webp'))
    assert len(files) == 1, files
    path = files[0]
    relative = path.relative_to(stage).as_posix()
    request = urllib.request.Request(report['url'] + relative + '?verify=monster-polish-v86',
                                     headers={'Cache-Control': 'no-cache'})
    with opener.open(request, timeout=40) as response:
        body = response.read()
        mime = response.headers.get('Content-Type', '')
        status = response.status
    assert hashlib.sha256(body).hexdigest() == sha(path)
    assert mime.split(';')[0] == 'image/webp'
    checks.append({'path': relative, 'bytes': len(body), 'sha256': sha(path),
                   'contentType': mime, 'status': status, 'verified': True})
result = {'stage': str(stage), 'atlases': checks, 'previousNativeFiles': len(native),
          'untargetedNativeFilesExactlyUnchanged': len(untargeted), 'unexpectedChanges': changed,
          'gameOrBrowserStarted': False, 'wasmExecuted': False}
(ROOT / 'changed-atlases-hosting.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
