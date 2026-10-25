"""Read-only verification of the published selected cards and extended fonts."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1]
package=project/'build/github-pages-hero-cards-v116'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'));samples=[]
cards=json.loads((out/'card-check.json').read_text('utf-8'))['newCards']
for path in [next(package.glob('assets/main/index.*.js')),next(package.rglob('UIBody.ttf')),next(package.rglob('UIHeading.ttf'))]:
    relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
    req=urllib.request.Request(receipt['url']+relative+'?verify=hero-cards-v116',headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as response:
        data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
    if path.suffix=='.js':assert all(c['id'].encode() in data for c in cards)
    samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples),'newCards':len(cards)}))
