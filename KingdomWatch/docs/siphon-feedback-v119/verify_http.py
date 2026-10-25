"""Read-only deployed main script and Chinese notice font hashes; no runtime."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1];package=project/'build/github-pages-siphon-feedback-v119'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'));samples=[]
paths=[next(package.glob('assets/main/index.*.js')),next(package.rglob('UIBody.ttf'))]
for path in paths:
 relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
 req=urllib.request.Request(receipt['url']+relative+'?verify=siphon-feedback-v119',headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=45) as response:
  data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
 if path.suffix=='.js':assert all(s.encode() in data for s in ['target_blocked','无法对空','暂无目标','no-target'])
 samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))

