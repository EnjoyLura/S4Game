"""Read-only HTTP/SHA verification of the three icon atlases and compiled UI/shot paths."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1]
package=project/'build/github-pages-hero-icons-v117'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'));samples=[]
audit=json.loads((out/'package-static-verification.json').read_text('utf-8'))
paths=[next(package.glob('assets/main/index.*.js'))]+[package/p for p in audit['newNativeAtlases']]
for path in paths:
 relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
 req=urllib.request.Request(receipt['url']+relative+'?verify=hero-icons-v117',headers={'Cache-Control':'no-cache'})
 with urllib.request.urlopen(req,timeout=45) as response:
  data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
 if path.suffix=='.js':
  assert all(s.encode() in data for s in ['heroIconViewport','new_hero_icons_v117','excludeLifeId'])
 samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples),'icons':37}))

