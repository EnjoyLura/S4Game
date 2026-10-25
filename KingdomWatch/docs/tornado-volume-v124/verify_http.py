"""Read-only deployed main/procedural effect verification; never opens game/browser."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1];package=project/'build/github-pages-tornado-volume-v124'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf8'));audit=json.loads((out/'package-static-verification.json').read_text('utf8'))
paths=[next(package.glob('assets/main/index.*.js'))]+[package/p for p in audit['compiledEffectFiles']];samples=[]
for path in paths:
    relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
    req=urllib.request.Request(receipt['url']+relative+'?verify=tornado-volume-v124',headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=45) as response:
        data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
    samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))
