"""Read-only live byte checks for all five active lobby animations, without a browser."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import gzip,hashlib,json,shutil,sys,urllib.request

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
sys.path.insert(0,str(PROJECT/'tools'))
from prune_lobby_trials import active_paths


def main():
    deployment=json.loads((PROJECT/'docs/github-pages-publishing/deployment.json').read_text())
    assert deployment['complete'] and deployment['remote_commit_verified']
    package=Path(deployment['stage']);release=json.loads((package/'hosting-release.json').read_text())
    inventory=json.loads((package/release['inventory']).read_text())['files']
    active=active_paths(PROJECT);uuids=[]
    for root in active:
        base=PROJECT/'assets/resources'/root
        for suffix in ['.png.meta','.frames.json.meta']:uuids.append(json.loads(Path(str(base)+suffix).read_text())['uuid'])
    targets=sorted(name for name in inventory if any(uuid in name for uuid in uuids))
    assert len([p for p in targets if p.endswith('.webp')])==5
    def check(name):
        req=urllib.request.Request(deployment['url']+name+'?release='+release['id'],headers={'Accept-Encoding':'gzip','Cache-Control':'no-cache','User-Agent':'KingdomWatch-asset-byte-audit'})
        with urllib.request.urlopen(req,timeout=45) as response:
            raw=response.read();encoding=response.headers.get('Content-Encoding');data=gzip.decompress(raw) if encoding=='gzip' else raw
            assert len(data)==inventory[name]['bytes'] and hashlib.sha256(data).hexdigest()==inventory[name]['sha256'],name
            if name.endswith('.webp'):assert response.headers.get_content_type()=='image/webp'
            return {'path':name,'bytes':len(data),'sha256':'matches','status':response.status,'mime':response.headers.get_content_type()}
    with ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(check,targets))
    for filename in ['source-assets-before.json','web-build-before.json']:
        before=json.loads((ROOT/filename).read_text())
        assert all(hashlib.sha256((PROJECT/p).read_bytes()).hexdigest()==h for p,h in before.items())
    config_path,=(package/'assets/resources').glob('config.*.json');config=json.loads(config_path.read_text())
    image_paths={v[0] for v in config['paths'].values() if v[0].startswith('ux/hero_lobby_idle_v') and not v[0].endswith(('/texture','/spriteFrame','.frames'))}
    assert image_paths==active
    report={'release':release['id'],'runtimeCommit':deployment['publication_commit'],'activeLobbyArt':sorted(active),'liveFiles':checks,
      'allSourceAssetsAndNormalBuildByteIdentical':True,'onlyActiveLobbyResourceAliasesPresent':True,'sourceRepositoryPushed':False,
      'gameBrowserAudioWasmStarted':False}
    (ROOT/'online-assets.json').write_text(json.dumps(report,indent=2)+'\n')
    shutil.copyfile(PROJECT/'docs/github-pages-publishing/deployment.json',ROOT/'deployment.json')
    print(json.dumps({'release':release['id'],'runtimeCommit':deployment['publication_commit'],'pages':deployment['deployment_status']['build_status'],'activeHeroHTTPChecks':len(checks),'standardHTTPChecks':len(deployment['online_verification']['live_checksum_samples']),'sourceAndNormalBuildKept':True}))


if __name__=='__main__':main()
