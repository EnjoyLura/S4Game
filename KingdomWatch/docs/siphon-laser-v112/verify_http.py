"""Read-only checks of this release's laser shader and two updated font files."""
import hashlib
import json
import urllib.request
from pathlib import Path

out = Path(__file__).resolve().parent
package = out.parents[1] / 'build/github-pages-siphon-laser-v112'
receipt = json.loads((out.parents[1] / 'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release = json.loads((package / 'hosting-release.json').read_text('utf-8'))
assert release['id'] == 'a3c14e8af1cdc0dc'
files = [next(package.rglob('e00b3255-79ee-4875-932b-058c0d37b905.*.json')),
         next(package.rglob('UIBody.ttf')), next(package.rglob('UIHeading.ttf'))]
checks = []
for path in files:
    relative = path.relative_to(package).as_posix()
    request = urllib.request.Request(receipt['url'] + relative + '?verify=siphon-laser-v112',
                                     headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
        expected = hashlib.sha256(path.read_bytes()).hexdigest()
        assert response.status == 200 and hashlib.sha256(data).hexdigest() == expected, relative
        checks.append({'path': relative, 'status': response.status, 'bytes': len(data), 'sha256': expected})
report = {'release': release['id'], 'samples': checks, 'gameBrowserOrWasmStarted': False}
(out / 'additional-http-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
print(json.dumps({'release': release['id'], 'additionalHttpShaChecks': len(checks)}))
