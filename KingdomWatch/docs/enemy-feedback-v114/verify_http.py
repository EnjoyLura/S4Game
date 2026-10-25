"""Read-only verification of the published HTML and compiled gameplay script bytes."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1]
package=project/'build/github-pages-enemy-feedback-v114'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'))
samples=[]
for path in [package/release['entry'],next(package.glob('assets/main/index.*.js'))]:
    relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
    req=urllib.request.Request(receipt['url']+relative+'?verify=enemy-feedback-v114',headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as response:
        data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
    if path.suffix=='.html':assert b'kwNetworkNotice' not in data and b'__KW_NETWORK_FAILURE' in data
    else:assert b'enemyHealingLinks' in data and b'enemyThrownStones' in data
    samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))
