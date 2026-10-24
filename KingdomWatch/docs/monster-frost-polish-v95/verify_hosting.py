"""HTTP and SHA checks for the changed monster resources; no game or browser."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import gzip
import hashlib
import json
import shutil
import urllib.request

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
PACKAGE=PROJECT/'build/github-pages-monster-frost-v95'
URL='https://enjoylura.github.io/kingdom-watch-play/'


def main():
    release=json.loads((PACKAGE/'hosting-release.json').read_text())
    inventory=json.loads((PACKAGE/release['inventory']).read_text())['files']
    uuids=[]
    for atlas in ['chapter1_mob_walk_v94','chapter1_mob_walk_v95','chapter1_cart_walk_v95']:
        for suffix in ['.png.meta','.frames.json.meta']:
            meta=PROJECT/'assets/resources/ux'/(atlas+suffix)
            uuids.append(json.loads(meta.read_text())['uuid'])
    targets=[name for name in inventory if any(uuid in name for uuid in uuids)]

    def check(name):
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({'http':'http://127.0.0.1:7897','https':'http://127.0.0.1:7897'}))
        request=urllib.request.Request(URL+name,headers={'Accept-Encoding':'gzip','User-Agent':'KingdomWatch-static-asset-check'})
        with opener.open(request,timeout=45) as response:
            raw=response.read();encoding=response.headers.get('Content-Encoding')
            data=gzip.decompress(raw) if encoding=='gzip' else raw
            digest=hashlib.sha256(data).hexdigest()
            if digest!=inventory[name]['sha256'] or len(data)!=inventory[name]['bytes']:raise ValueError('Online file differs: '+name)
            if name.endswith('.webp') and response.headers.get_content_type()!='image/webp':raise ValueError('Wrong WebP MIME')
            return {'path':name,'bytes':len(data),'sha256':digest,'status':response.status,
                    'contentType':response.headers.get('Content-Type'),'contentEncoding':encoding}
    with ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(check,targets))
    report={'release':release['id'],'newOrUpdatedAssets':checks,'gameOrBrowserExecuted':False}
    (ROOT/'new-assets-hosting.json').write_text(json.dumps(report,indent=2)+'\n')
    shutil.copyfile(PROJECT/'docs/github-pages-publishing/deployment.json',ROOT/'deployment.json')
    deployment=json.loads((ROOT/'deployment.json').read_text())
    if not deployment['complete'] or not deployment['source_head_unchanged'] or not deployment['source_index_unchanged']:
        raise ValueError('Deployment did not complete cleanly')
    print(json.dumps({'release':release['id'],'commit':deployment['publication_commit'],'pages':deployment['deployment_status'],
                      'newAssetChecks':len(checks),'standardChecks':len(deployment['online_verification']['live_checksum_samples'])}))


if __name__=='__main__':main()
