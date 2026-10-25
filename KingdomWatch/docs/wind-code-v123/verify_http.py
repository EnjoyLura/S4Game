"""Read-only deployed main and actual procedural shader hashes; no game/browser."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1];package=project/'build/github-pages-wind-code-v123'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'));audit=json.loads((out/'package-static-verification.json').read_text('utf-8'))
paths=[next(package.glob('assets/main/index.*.js'))]+[package/p for p in audit['compiledEffectFiles']];samples=[]
for path in paths:
 relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
 req=urllib.request.Request(receipt['url']+relative+'?verify=wind-code-v123',headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=45) as response:
  data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
 assert b'wind_volume_v122/' not in data and b'wind-volume-v122' not in data
 samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))
