"""Read-only deployed main script and existing flight-atlas checks; no runtime or browser."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1];package=project/'build/github-pages-flight-v118'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'))
uid=json.loads((project/'assets/resources/ux/forest_mob_walk_v87.png.meta').read_text('utf-8'))['uuid']
paths=[next(package.glob('assets/main/index.*.js'))]+[p for p in package.rglob('*') if p.is_file() and '/native/' in p.as_posix() and uid in p.name]
assert len(paths)==2
samples=[]
for path in paths:
 relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
 req=urllib.request.Request(receipt['url']+relative+'?verify=flight-v118',headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=45) as response:
  data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
 if path.suffix=='.js':assert all(s.encode() in data for s in ['targetLayer','groundProjectionY','flightLift','hitY'])
 samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))

