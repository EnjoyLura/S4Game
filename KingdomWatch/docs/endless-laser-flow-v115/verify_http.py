"""Read the published script and laser material; never instantiate the game or WASM."""
import hashlib,json,urllib.request
from pathlib import Path
out=Path(__file__).resolve().parent;project=out.parents[1]
package=project/'build/github-pages-endless-laser-v115'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
release=json.loads((package/'hosting-release.json').read_text('utf-8'));samples=[]
for path in [next(package.glob('assets/main/index.*.js')),next(package.rglob('e00b3255-79ee-4875-932b-058c0d37b905.*.json'))]:
    relative=path.relative_to(package).as_posix();expected=hashlib.sha256(path.read_bytes()).hexdigest()
    req=urllib.request.Request(receipt['url']+relative+'?verify=endless-laser-v115',headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=60) as response:
        data=response.read();assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
    if path.suffix=='.json':assert b'frontDistance' in data and b'1500.0' in data
    else:assert b'advanceEndlessFloors' in data
    samples.append({'path':relative,'bytes':len(data),'status':200,'sha256':expected})
(out/'additional-http-verification.json').write_text(json.dumps({'release':release['id'],'samples':samples,'gameOrBrowserStarted':False},indent=2)+'\n','utf-8')
print(json.dumps({'release':release['id'],'extraHttpShaChecks':len(samples)}))
