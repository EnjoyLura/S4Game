"""Read-only HTTP verification. No game/browser execution."""
import concurrent.futures,gzip,hashlib,json,time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request,urlopen
OUT=Path(__file__).resolve().parent
report=json.loads((OUT/'package-static-verification.json').read_text('utf8'))
deployment=json.loads((OUT/'deployment.json').read_text('utf8'))
assert deployment['complete'] and deployment['online_verification']['release_matches']
version=report['checks']['release']['id']
targets=report['newMedia']+[{'path':report['mainScript'],'sha256':report['mainSha256']}]
package=OUT.parents[1]/'build/github-pages-wind-ground-loop-v130'
manifests=[]
for file in (package/'assets/resources/import').rglob('*.json'):
    raw=file.read_bytes()
    if b'framePrefix' not in raw or not (b'tornado_' in raw or b'eye_' in raw):continue
    data=json.loads(raw)
    def find(value):
        if isinstance(value,dict):
            if value.get('framePrefix') in ['eye_','tornado_']:return value
            for child in value.values():
                hit=find(child)
                if hit:return hit
        if isinstance(value,list):
            for child in value:
                hit=find(child)
                if hit:return hit
        return None
    clip=find(data);assert clip and clip['frameCount']==48 and clip['playbackSpeed']==2
    kind=clip['framePrefix'].rstrip('_')
    source=json.loads((OUT.parents[1]/('assets/resources/fx/wind_'+kind+'_video_v129.frames.json')).read_text('utf8'))
    assert clip==source,'Compiled clip manifest changed'
    manifests.append({'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(raw).hexdigest()})
assert len(manifests)==2
targets+=manifests
def check(item):
    error=None
    for attempt in range(3):
        try:
            url=deployment['url']+quote(item['path'])+'?kwverify='+version
            with urlopen(Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache'}),timeout=20) as response:
                data=response.read()
                if response.headers.get('Content-Encoding')=='gzip':data=gzip.decompress(data)
                digest=hashlib.sha256(data).hexdigest();assert response.status==200 and digest==item['sha256']
                return {'path':item['path'],'status':200,'bytes':len(data),'sha256':digest}
        except Exception as exc:
            error=exc
            if attempt<2:time.sleep(1)
    raise error
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:samples=list(pool.map(check,targets))
result={'release':version,'publicationCommit':deployment['publication_commit'],'samples':samples,'allHashesMatch':True,'gameOrBrowserStarted':False}
(OUT/'additional-http-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({'release':version,'http200AndSha256':len(samples),'gameOrBrowserStarted':False}))
