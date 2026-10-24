"""Verify changed game code and new hero images over HTTP; no browser or runtime."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import gzip,hashlib,json,shutil,urllib.request

OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
deployment=json.loads((PROJECT/'docs/github-pages-publishing/deployment.json').read_text('utf-8'))
assert deployment['complete'] and deployment['remote_commit_verified']
package=Path(deployment['stage'])
release=json.loads((package/'hosting-release.json').read_text('utf-8'))
files=json.loads((package/release['inventory']).read_text('utf-8'))['files']
uuids=[json.loads(path.read_text('utf-8'))['uuid'] for path in (PROJECT/'assets/resources/ux/new_heroes_v105').glob('*.png.meta')]
targets=sorted(name for name in files if name.startswith('assets/main/index.') or any(uid in name for uid in uuids))
assert len([name for name in targets if name.endswith('.webp')])==4
def check(name):
    request=urllib.request.Request(deployment['url']+name+'?verify='+release['id'],headers={
        'User-Agent':'KingdomWatch-ui-prewarm-audit','Accept-Encoding':'gzip','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=45) as response:
        payload=response.read()
        if response.headers.get('Content-Encoding')=='gzip':payload=gzip.decompress(payload)
        assert len(payload)==files[name]['bytes'] and hashlib.sha256(payload).hexdigest()==files[name]['sha256'],name
        return {'file':name,'bytes':len(payload),'status':response.status,'sha256':'matches','mime':response.headers.get_content_type()}
with ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(check,targets))
report={'release':release['id'],'runtimeCommit':deployment['publication_commit'],
        'pageBuildStatus':deployment['deployment_status'],'files':checks,
        'standardHTTPSamples':len(deployment['online_verification']['live_checksum_samples']),
        'sourcePushed':False,'gameBrowserAudioOrWasmStarted':False}
(OUT/'online-assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
shutil.copyfile(PROJECT/'docs/github-pages-publishing/deployment.json',OUT/'deployment.json')
print(json.dumps({'release':release['id'],'runtimeCommit':deployment['publication_commit'],
                  'changedCodeAndHeroAssetHTTPChecks':len(checks),'standardHTTPChecks':report['standardHTTPSamples']}))
