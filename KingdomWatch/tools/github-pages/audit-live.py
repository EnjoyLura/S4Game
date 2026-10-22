"""Read-only CDN byte audit, including files retained for the previous release.

Downloads every runtime resource. Does not launch a browser or the game.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
import time
from urllib.parse import quote

from export import HERE, PROJECT, sha, write_json
from publish import http_bytes


def main():
    folder=PROJECT/'docs/github-pages-publishing'
    deployed=json.loads((folder/'deployment.json').read_text('utf-8'))
    if not deployed.get('complete'):raise RuntimeError('Wait for deployment to complete before the full audit')
    base=deployed['url'];release=deployed['export']['release'];stamp=str(time.time_ns())
    pointer,_=http_bytes(base+'hosting-release.json?audit='+stamp)
    if json.loads(pointer)!=release:raise RuntimeError('Unexpected live release')
    raw,_=http_bytes(base+release['inventory']+'?audit='+stamp)
    if hashlib.sha256(raw).hexdigest()!=release['inventory_sha256']:raise RuntimeError('Live inventory checksum mismatch')
    records=json.loads(raw)['files']
    config=json.loads((HERE/'config.json').read_text('utf-8'))
    inventories=[p for p in Path(config['checkout']).glob('hosting-files.*.json') if p.name!=release['inventory']]
    if len(inventories)>1:raise RuntimeError('Expected at most one retained previous release')
    previous=None;old={}
    if inventories:
        inventory=inventories[0];previous=inventory.name.split('.')[1]
        old_raw,_=http_bytes(base+inventory.name+'?audit='+stamp)
        if hashlib.sha256(old_raw).hexdigest()!=sha(inventory):raise RuntimeError('Previous inventory is unavailable or changed')
        old=json.loads(old_raw)['files']
    retained={name:meta for name,meta in old.items() if name not in records}
    checks={**records,**retained};errors=[];verified=[];total=0

    def check(item):
        name,meta=item
        for attempt in range(3):
            try:
                body,headers=http_bytes(base+quote(name,safe='/')+'?audit='+stamp)
                digest=hashlib.sha256(body).hexdigest()
                if len(body)!=meta['bytes'] or digest!=meta['sha256']:raise RuntimeError('Byte/hash mismatch')
                return {'path':name,'bytes':len(body),'sha256':digest,'encoding':headers.get('content-encoding'),'previous_only':name in retained}
            except Exception as exc:
                if attempt==2:return {'path':name,'error':str(exc)}
                time.sleep(attempt+1)

    start=time.monotonic()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(check,item) for item in checks.items()]
        for n,future in enumerate(as_completed(futures),1):
            result=future.result()
            if 'error' in result:errors.append(result)
            else:verified.append(result);total+=result['bytes']
            if n%100==0 or n==len(checks):print(f'CDN audit {n}/{len(checks)}; {total/1048576:.1f} MiB verified; failures {len(errors)}',flush=True)
    again,_=http_bytes(base+'hosting-release.json?audit='+str(time.time_ns()))
    stable=json.loads(again)==release
    report={'time':datetime.now(timezone.utc).isoformat(),'fixed_url':base,'release':release['id'],'previous_release':previous,'current_files':len(records),'retained_previous_only_files':len(retained),'checked_files':len(checks),'verified_bytes':total,'elapsed_seconds':round(time.monotonic()-start,2),'complete':not errors and stable,'release_stable':stable,'game_started':False,'browser_started':False,'errors':errors,'files':sorted(verified,key=lambda r:r['path'])}
    write_json(folder/'full-cdn-audit.json',report)
    print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False),flush=True)
    return 0 if report['complete'] else 1


if __name__=='__main__':
    sys.exit(main())
