"""Read-only HTTP checks for changed/new runtime media and manifests, never the game."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import gzip, hashlib, json, shutil, urllib.request

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
PACKAGE=PROJECT/'build/github-pages-mora-idle-v97'
URL='https://enjoylura.github.io/kingdom-watch-play/'


def main():
    release=json.loads((PACKAGE/'hosting-release.json').read_text())
    inventory=json.loads((PACKAGE/release['inventory']).read_text())['files'];uuids=[]
    atlas_paths=[PROJECT/'assets/resources/ux/hero_lobby_idle_v96/mora']
    for base in atlas_paths:
        for suffix in ['.png.meta','.frames.json.meta']:
            uuids.append(json.loads(Path(str(base)+suffix).read_text())['uuid'])
    targets=[name for name in inventory if any(uuid in name for uuid in uuids)]
    def check(name):
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({'http':'http://127.0.0.1:7897','https':'http://127.0.0.1:7897'}))
        request=urllib.request.Request(URL+name,headers={'Accept-Encoding':'gzip','User-Agent':'KingdomWatch-static-asset-check'})
        with opener.open(request,timeout=45) as response:
            raw=response.read();encoding=response.headers.get('Content-Encoding')
            data=gzip.decompress(raw) if encoding=='gzip' else raw;digest=hashlib.sha256(data).hexdigest()
            if digest!=inventory[name]['sha256'] or len(data)!=inventory[name]['bytes']:raise ValueError('Online mismatch: '+name)
            if name.endswith('.webp') and response.headers.get_content_type()!='image/webp':raise ValueError('Wrong WebP MIME')
            return {'path':name,'bytes':len(data),'sha256':digest,'status':response.status,
              'contentType':response.headers.get('Content-Type'),'contentEncoding':encoding}
    with ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(check,targets))
    (ROOT/'new-assets-hosting.json').write_text(json.dumps({'release':release['id'],'newOrUpdatedAssets':checks,
      'gameOrBrowserExecuted':False},indent=2)+'\n')
    shutil.copyfile(PROJECT/'docs/github-pages-publishing/deployment.json',ROOT/'deployment.json')
    deployment=json.loads((ROOT/'deployment.json').read_text())
    if not deployment['complete'] or not deployment['source_head_unchanged'] or not deployment['source_index_unchanged']:
        raise ValueError('Deployment not complete/clean')
    print(json.dumps({'release':release['id'],'commit':deployment['publication_commit'],
      'pages':deployment['deployment_status'],'newAssetChecks':len(checks),
      'standardChecks':len(deployment['online_verification']['live_checksum_samples'])}))


if __name__=='__main__':main()
