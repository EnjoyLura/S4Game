"""Read-only CDN bytes and SHA256 for new media, import descriptors and compiled main JS."""
import concurrent.futures,gzip,hashlib,json,time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request,urlopen
OUT=Path(__file__).resolve().parent
report=json.loads((OUT/'package-static-verification.json').read_text('utf8'))
deployment=json.loads((OUT/'deployment.json').read_text('utf8'))
assert deployment['complete'] and deployment['online_verification']['release_matches']
version=report['checks']['release']['id']
targets=json.loads((OUT/'changed-runtime-files.json').read_text('utf8'))
def check(item):
 for attempt in range(3):
  try:
   url=deployment['url']+quote(item['path'])+'?kwverify='+version
   with urlopen(Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache'}),timeout=25) as response:
    data=response.read()
    if response.headers.get('Content-Encoding')=='gzip':data=gzip.decompress(data)
    digest=hashlib.sha256(data).hexdigest()
    assert response.status==200 and digest==item['sha256'],item['path']
    return {'path':item['path'],'status':response.status,'bytes':len(data),'sha256':digest}
  except Exception:
   if attempt==2:raise
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:samples=list(pool.map(check,targets))
result={'release':version,'publicationCommit':deployment['publication_commit'],'samples':samples,
 'allHashesMatch':True,'gameOrBrowserStarted':False}
(OUT/'additional-http-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({'release':version,'http200AndSha256':len(samples),'gameOrBrowserStarted':False}))
