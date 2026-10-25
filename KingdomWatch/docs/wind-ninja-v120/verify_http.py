"""Read-only deployed JS, two fonts and three new atlas hashes. No browser/runtime."""
import hashlib,json,urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1];package=project/'build/github-pages-wind-ninja-v120'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'))
art=json.loads((out/'art-manifest.json').read_text('utf-8'))
paths=[next(package.glob('assets/main/index.*.js'))]+[next(package.rglob(n)) for n in ['UIBody.ttf','UIHeading.ttf']]
for item in art['assets']:
 paths.append(next(p for p in package.rglob('*.webp') if item['uuid'] in p.name))
def check(path):
 relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
 req=urllib.request.Request(receipt['url']+relative+'?verify=wind-ninja-v120',headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=45) as response:
  data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
 if path.suffix=='.js':assert all(s.encode() in data for s in ['赛兰·逐风','胧·影刃','volt_field'])
 return {'path':relative,'bytes':len(data),'status':200,'sha256':expected}
with ThreadPoolExecutor(max_workers=2) as workers:samples=list(workers.map(check,paths))
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))
