"""Read-only HTTP and file-hash checks; does not execute a browser, engine or WASM."""
from pathlib import Path
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parent.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((ROOT/'release.json').read_text(encoding='utf-8-sig'))
stage=Path(report['stage'])
previous=Path(json.loads((ROOT/'before/docs/github-pages-publishing/deployment.json').read_text(encoding='utf-8-sig'))['stage'])
native=[p for p in (previous/'assets').rglob('native/**/*') if p.is_file()]
changed=[p.relative_to(previous).as_posix() for p in native
 if not (stage/p.relative_to(previous)).is_file() or sha(p)!=sha(stage/p.relative_to(previous))]
assert not changed,changed
meta=json.loads((PROJECT/'assets/resources/ux/forest_mob_walk_v87.png.meta').read_text(encoding='utf-8'))
files=list(stage.glob('assets/resources/native/'+meta['uuid'][:2]+'/'+meta['uuid']+'*.webp'))
assert len(files)==1
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':'http://127.0.0.1:7897'}))
checks=[]
for path in files:
 relative=path.relative_to(stage).as_posix()
 request=urllib.request.Request(report['url']+relative+'?verify=monster-video-v87',headers={'Cache-Control':'no-cache'})
 with opener.open(request,timeout=40) as response:
  body=response.read();mime=response.headers.get('Content-Type');status=response.status
 assert hashlib.sha256(body).hexdigest()==sha(path)
 assert mime.split(';')[0]=='image/webp'
 checks.append({'path':relative,'bytes':len(body),'sha256':sha(path),'contentType':mime,'status':status,'verified':True})
result={'stage':str(stage),'atlas':checks,'previousNativeFiles':len(native),'changedPreviousNativeFiles':changed,
        'gameOrBrowserStarted':False,'wasmExecuted':False}
(ROOT/'new-atlas-hosting.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
