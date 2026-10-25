"""Read the published laser material bytes; never start the game or compile WASM."""
import hashlib, json, urllib.request
from pathlib import Path

out=Path(__file__).resolve().parent
project=out.parents[1]
package=project/'build/github-pages-siphon-laser-v113'
receipt=json.loads((project/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert receipt.get('complete') and receipt['online_verification']['release_matches']
path=next(package.rglob('e00b3255-79ee-4875-932b-058c0d37b905.*.json'))
relative=path.relative_to(package).as_posix()
expected=hashlib.sha256(path.read_bytes()).hexdigest()
req=urllib.request.Request(receipt['url']+relative+'?verify=siphon-laser-v113',headers={'Cache-Control':'no-cache'})
with urllib.request.urlopen(req,timeout=60) as response:
    data=response.read()
    assert response.status==200 and hashlib.sha256(data).hexdigest()==expected
report={'release':json.loads((package/'hosting-release.json').read_text('utf-8'))['id'],
        'samples':[{'path':relative,'status':200,'bytes':len(data),'sha256':expected}],
        'gameBrowserOrWasmStarted':False}
(out/'additional-http-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'release':report['release'],'extraHttpShaChecks':1}))
