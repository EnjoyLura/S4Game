"""Build-package -> isolated Git repository -> branch Pages -> HTTP verification.

Authentication is read in memory from Git Credential Manager. No token is
written to a URL, command line, report, runtime package, or config file.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

from export import HERE,PROJECT,export,sha,write_json,validate_package
from art_resources import MODES, runtime_budget

REPORT=PROJECT/'docs/github-pages-publishing/deployment.json'


def log(value):print(value,flush=True)


def git(folder,*args,check=True,echo=False):
    env=os.environ.copy();env.update(GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never')
    result=subprocess.run(['git','-C',str(folder),*args],capture_output=True,text=True,encoding='utf-8',errors='replace',env=env,timeout=300)
    if echo and result.stdout.strip():log(result.stdout.strip())
    if result.returncode and check:
        raise RuntimeError('Git command failed: '+args[0]+'; '+result.stderr[-1400:])
    return result


class GitHub:
    def __init__(self):
        result=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'never'},timeout=35)
        values=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
        self._token=values.get('password')
        if result.returncode or not self._token:raise RuntimeError('GitHub login is unavailable in Git Credential Manager')

    def call(self,path,method='GET',data=None,missing=False):
        if not path.startswith('/') or '..' in path:raise RuntimeError('Invalid GitHub API path')
        req=urllib.request.Request('https://api.github.com'+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Authorization':'Bearer '+self._token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'KingdomWatch-runtime-publisher','Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=35) as response:
                body=response.read();return json.loads(body) if body else {}
        except urllib.error.HTTPError as err:
            if missing and err.code==404:return None
            try:message=json.loads(err.read()).get('message','')
            except Exception:message=''
            raise RuntimeError(f'GitHub API {method} {path}: HTTP {err.code} {message}') from None


def ensure_repository(api,cfg):
    full=cfg['owner']+'/'+cfg['repository']
    existing=api.call('/repos/'+full,missing=True)
    if existing is None:
        login=api.call('/user')['login']
        if login.lower()!=cfg['owner'].lower():raise RuntimeError('Configured owner differs from authenticated account')
        existing=api.call('/user/repos','POST',{'name':cfg['repository'],'description':'Kingdom Watch browser runtime only. Source project and Cloudflare deployment are maintained separately.','private':False,'auto_init':False})
        log('Created runtime repository: '+existing['html_url'])
    if existing['private'] or existing.get('fork'):raise RuntimeError('Expected a dedicated public runtime repository')
    return existing


def local_checkout(cfg):
    dest=Path(cfg['checkout']).resolve();source_git=Path(git(PROJECT,'rev-parse','--show-toplevel').stdout.strip()).resolve()
    if dest==source_git or dest.is_relative_to(source_git):raise RuntimeError('Publication checkout must be outside the source repository')
    if not (dest/'.git').exists():
        if dest.exists() and any(dest.iterdir()):raise RuntimeError('Publication directory is not empty')
        dest.mkdir(parents=True,exist_ok=True);git(dest,'init','--initial-branch=main')
        git(dest,'remote','add','origin','https://github.com/'+cfg['owner']+'/'+cfg['repository']+'.git')
    actual=Path(git(dest,'rev-parse','--show-toplevel').stdout.strip()).resolve()
    if actual!=dest:raise RuntimeError('Publication directory is not an independent Git repository')
    expected='https://github.com/'+cfg['owner']+'/'+cfg['repository']+'.git'
    if git(dest,'remote','get-url','origin').stdout.strip()!=expected:raise RuntimeError('Unexpected publication remote')
    if git(dest,'branch','--show-current').stdout.strip()!=cfg['branch']:raise RuntimeError('Expected publication main branch')
    if git(dest,'status','--porcelain').stdout.strip():raise RuntimeError('Publication checkout has uncommitted changes; preserve and review them first')
    for name in ('user.name','user.email'):
        current=git(dest,'config','--get',name,check=False).stdout.strip()
        if not current:
            value=git(PROJECT,'config','--get',name,check=False).stdout.strip()
            if not value:raise RuntimeError('Git identity is not configured')
            git(dest,'config',name,value)
    git(dest,'config','core.autocrlf','false')
    remote=git(dest,'ls-remote','--exit-code','--heads','origin',cfg['branch'],check=False)
    if remote.returncode==0:
        git(dest,'fetch','--quiet','origin',cfg['branch'])
        git(dest,'merge','--ff-only','origin/'+cfg['branch'])
    elif remote.returncode!=2:
        raise RuntimeError('Cannot inspect publication branch; checkout preserved')
    return dest


def synchronize(stage,dest,prune_previous_release=False):
    new={p.relative_to(stage).as_posix() for p in stage.rglob('*') if p.is_file()}
    old=set(git(dest,'ls-files').stdout.splitlines())
    retained=set()
    pointer=dest/'hosting-release.json'
    if pointer.exists():
        previous=json.loads(pointer.read_text('utf-8'));previous_inventory=dest/previous['inventory']
        if not previous_inventory.resolve().is_relative_to(dest):raise RuntimeError('Unsafe previous inventory path')
        if sha(previous_inventory)!=previous['inventory_sha256']:raise RuntimeError('Previous inventory was modified')
        records=json.loads(previous_inventory.read_text('utf-8'))['files']
        for name,meta in records.items():
            path=dest/name
            if not path.resolve().is_relative_to(dest) or not path.is_file() or sha(path)!=meta['sha256']:raise RuntimeError('Previous runtime file is not intact: '+name)
            if name not in new:
                if not prune_previous_release:retained.add(name)
            elif sha(stage/name)!=meta['sha256'] and name not in {'index.html','hosting-diagnostics.html','audio-credits.html'}:
                raise RuntimeError('Unversioned runtime collision between releases: '+name)
        if not prune_previous_release:retained.add(previous['inventory'])
        upcoming=json.loads((stage/'hosting-release.json').read_text('utf-8'))
        if previous==upcoming and not prune_previous_release:
            # Retrying an unchanged export must not count as a new release or
            # prune the preceding release that a real update retained.
            retained.update(old-new)
    retained-=new
    for name in retained:
        path=dest/name
        if not path.resolve().is_relative_to(dest) or path.is_symlink():raise RuntimeError('Unsafe retained publication path')
    combined=sum(p.stat().st_size for p in stage.rglob('*') if p.is_file())+sum((dest/n).stat().st_size for n in retained)
    if combined>950*1048576:raise RuntimeError('Current plus previous runtime exceeds the safe Pages size budget')
    release=json.loads((stage/'hosting-release.json').read_text('utf-8'))
    if release.get('texture_mode')=='mixed-webp-q95' and combined>runtime_budget('mixed-webp-q95'):
        raise RuntimeError('Current plus retained runtime exceeds 200MB; use -PrunePreviousRelease to publish only the current package')
    # Delete only previously tracked generated files, after verifying the exact
    # resolved target remains inside this independent checkout. Never recurse.
    for name in sorted(old-new-retained):
        path=dest/name
        if not path.resolve().is_relative_to(dest) or path.is_symlink():raise RuntimeError('Unsafe tracked publication path')
        if path.is_file():path.unlink()
    for name in sorted(new):
        target=dest/name
        if not target.resolve().is_relative_to(dest) or target.is_symlink():raise RuntimeError('Unsafe publication destination')
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists() or sha(stage/name)!=sha(target):shutil.copyfile(stage/name,target)
    for name in new:
        if sha(stage/name)!=sha(dest/name):raise RuntimeError('Publication copy checksum mismatch: '+name)
    return len(new)


def enable_pages(api,cfg):
    path='/repos/'+cfg['owner']+'/'+cfg['repository']+'/pages'
    pages=api.call(path,missing=True)
    desired={'build_type':'legacy','source':{'branch':'main','path':'/'}}
    if pages is None:api.call(path,'POST',desired)
    elif pages.get('build_type')!='legacy' or pages.get('source')!=desired['source']:api.call(path,'PUT',desired)
    return api.call(path)


def http_bytes(url,headers=None):
    req=urllib.request.Request(url,headers={'User-Agent':'KingdomWatch-hosting-diagnostics','Cache-Control':'no-cache','Accept-Encoding':'gzip',**(headers or {})})
    with urllib.request.urlopen(req,timeout=45) as response:
        data=response.read();encoding=response.headers.get('Content-Encoding')
        if encoding=='gzip':data=gzip.decompress(data)
        elif encoding not in (None,'identity'):raise RuntimeError('Unexpected transfer encoding: '+encoding)
        return data,{key.lower():value for key,value in response.headers.items()}


def online_verification(base,stage,release):
    stamp=str(time.time_ns());pointer,headers=http_bytes(base+'hosting-release.json?check='+stamp)
    remote=json.loads(pointer)
    if remote!=release:raise RuntimeError('Live release does not match the publication package')
    payload,_=http_bytes(base+release['inventory']+'?check='+stamp)
    if hashlib.sha256(payload).hexdigest()!=release['inventory_sha256']:raise RuntimeError('Live inventory checksum mismatch')
    inventory=json.loads(payload);files=inventory['files']
    names=['index.html','hosting-diagnostics.html',release['entry'],*release['wasm']]
    art=inventory['runtime'].get('art_resources')
    if art:
        names.append(art['manifest'])
        images=json.loads((stage/art['manifest']).read_text('utf-8'))['images']
        for encoding in ('lossless-webp','webp-q95'):
            candidates=[item['native'] for item in images if item.get('encoding','lossless-webp')==encoding]
            if candidates:
                names.extend([min(candidates,key=lambda n:files[n]['bytes']),max(candidates,key=lambda n:files[n]['bytes'])])
    for prefix,suffix in [('src/','.json'),('assets/main/','.js'),('cocos-js/cc.','.js'),('cocos-js/_virtual_cc-','.js'),('assets/resources/native/','.png'),('assets/resources/native/','.webp'),('assets/resources/native/','.ttf'),('assets/resources/native/','.mp3'),('assets/resources/native/','.wav')]:
        candidates=[n for n in files if n.startswith(prefix) and n.endswith(suffix)]
        if candidates:names.append(min(candidates,key=lambda n:files[n]['bytes']))
        if suffix in ('.webp','.wav') and candidates:names.append(max(candidates,key=lambda n:files[n]['bytes']))
    def check(name):
        data,h=http_bytes(base+name+'?check='+stamp)
        if hashlib.sha256(data).hexdigest()!=files[name]['sha256'] or len(data)!=files[name]['bytes']:raise RuntimeError('Live checksum mismatch: '+name)
        if name.endswith('.webp') and h.get('content-type','').split(';')[0].strip().lower()!='image/webp':
            raise RuntimeError('Incorrect WebP response Content-Type: '+name)
        return {'path':name,'bytes':len(data),'sha256':'matches','content_type':h.get('content-type'),'content_encoding':h.get('content-encoding'),'cache_control':h.get('cache-control')}
    with ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(check,sorted(set(names))))
    second,_=http_bytes(base+'hosting-release.json?check='+str(time.time_ns()))
    if json.loads(second)!=release:raise RuntimeError('Release changed during verification')
    root,_=http_bytes(base+'?check='+stamp)
    if hashlib.sha256(root).hexdigest()!=files['index.html']['sha256']:raise RuntimeError('Fixed root URL does not serve the expected launcher')
    # Revisit with a conditional GET: either a matching 200 or a 304 is valid.
    etag=headers.get('etag');conditional=None
    if etag:
        try:
            again,_=http_bytes(base+'hosting-release.json?check='+stamp,{'If-None-Match':etag})
            conditional=200
            if again!=pointer:raise RuntimeError('Conditional revisit changed the release')
        except urllib.error.HTTPError as err:
            if err.code!=304:raise
            conditional=304
    return {'fixed_url':base,'release_matches':True,'live_checksum_samples':checks,'manifest_revisit_consistent':True,'conditional_revisit_status':conditional,'all_published_files_in_git_and_local_manifest_verified':True,'all_live_media_downloaded':False,'game_or_browser_started':False,'manual_checks_remaining':['Actual first/revisit/update gameplay on the target phone','Optional full CDN byte verification from the hosting diagnostic page']}


def check_status(api,cfg,stage,release,wait_seconds,record):
    full=cfg['owner']+'/'+cfg['repository'];base='https://'+cfg['owner'].lower()+'.github.io/'+cfg['repository']+'/'
    deadline=time.monotonic()+wait_seconds;last=None
    while True:
        pages=api.call('/repos/'+full+'/pages');build=api.call('/repos/'+full+'/pages/builds/latest',missing=True)
        current={'pages_status':pages.get('status'),'build_status':build.get('status') if build else None,'build_commit':build.get('commit') if build else None,'build_error':build.get('error') if build else None}
        if current!=last:log(json.dumps(current,ensure_ascii=False));last=current
        record['deployment_status']=current;record['url']=base;record['phase']='verifying';write_json(REPORT,record)
        try:
            pointer,_=http_bytes(base+'hosting-release.json?check='+str(time.time_ns()))
            if json.loads(pointer).get('id')==release['id']:
                record['online_verification']=online_verification(base,stage,release);record['complete']=True;record['phase']='complete'
                record.pop('pending_reason',None);record.pop('last_probe_error',None);return True
        except (urllib.error.URLError,json.JSONDecodeError,TimeoutError,RuntimeError) as exc:
            record['last_probe_error']=str(exc)
        if build and build.get('status')=='errored' and build.get('commit')==record['publication_commit']:
            raise RuntimeError('GitHub Pages build failed: '+str(build.get('error')))
        if time.monotonic()>=deadline:
            record['complete']=False;record['phase']='pending';record['pending_reason']='GitHub Pages has not served the expected release yet';return False
        time.sleep(min(12,max(0,deadline-time.monotonic())))


def main():
    parser=argparse.ArgumentParser(description='Publish the production runtime to an independent GitHub Pages repository.')
    parser.add_argument('--wait-seconds',type=int,default=240)
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--status-only',action='store_true')
    mode.add_argument('--validate-only',action='store_true')
    parser.add_argument('--prepared',type=Path)
    parser.add_argument('--texture-mode',choices=MODES)
    parser.add_argument('--prune-previous-release',action='store_true',
                        help='After validating the new package, remove previous-only tracked runtime files; keep Git history')
    parser.add_argument('--config',type=Path,default=HERE/'config.json')
    args=parser.parse_args()
    if not 0<=args.wait_seconds<=3600:parser.error('--wait-seconds must be between 0 and 3600')
    if args.prepared and args.status_only:parser.error('--prepared cannot be combined with --status-only')
    if args.texture_mode and (args.prepared or args.status_only):parser.error('--texture-mode is for a new export; prepared/status packages retain their recorded mode')
    if args.prune_previous_release and (args.status_only or args.validate_only):
        parser.error('--prune-previous-release is only available during publication')
    cfg=json.loads(args.config.read_text('utf-8-sig'))
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}',cfg['owner']) or not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}',cfg['repository']):
        raise RuntimeError('Invalid GitHub owner or repository name')
    if cfg['branch']!='main' or cfg['source_path']!='/' or cfg['visibility']!='public':
        raise RuntimeError('Expected dedicated public runtime repository, main branch, root directory')
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    source_head=git(PROJECT,'rev-parse','HEAD').stdout.strip();source_index=hashlib.sha256(git(PROJECT,'ls-files','--stage').stdout.encode()).hexdigest()
    repository='https://github.com/'+cfg['owner']+'/'+cfg['repository']
    report_path=REPORT.parent/'validation.json' if args.validate_only else REPORT
    record={'time':datetime.now(timezone.utc).isoformat(),'repository':repository,'source_head_before':source_head,'complete':False,'phase':'preparing'}
    code=1
    try:
        if args.status_only:
            previous=json.loads(REPORT.read_text('utf-8'))
            if previous.get('repository')!=repository:raise RuntimeError('Last deployment belongs to a different repository')
            record=previous
            record['complete']=False;record.pop('error',None)
            stage=Path(record['stage'])
            record['hosting_package_checks']=validate_package(stage,cfg)
            release=record['hosting_package_checks']['release']
        else:
            stage=args.prepared or PROJECT/'build'/('github-pages-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
            record['stage']=str(stage.resolve())
            if not args.prepared:
                log('Exporting the prepared production build...')
                record['export']=export(stage,cfg,args.texture_mode)
            record['hosting_package_checks']=validate_package(stage,cfg)
            checked=record['hosting_package_checks'];release=checked['release']
            if args.prepared:record['export']={key:checked[key] for key in ('release','file_count','runtime_bytes','full_package_bytes','budget_bytes','all_exported_hashes_verified')}
            record['phase']='validated';write_json(report_path,record)
            log('Validated runtime package including inventories: '+str(checked['file_count'])+' files, '+str(round(checked['full_package_bytes']/1048576,1))+' MiB')
            if args.validate_only:
                record['complete']=True;record['phase']='validated-only';record['uploaded']=False;code=0
                log('Local package verified. No credentials read, repository changes or upload.')
                return code
        api=GitHub()
        if not args.status_only:
            ensure_repository(api,cfg);dest=local_checkout(cfg);record['publication_checkout']=str(dest)
            record['pruned_previous_release']=args.prune_previous_release
            record['copied_and_rehashed_files']=synchronize(stage,dest,args.prune_previous_release);git(dest,'add','--all')
            changed=git(dest,'diff','--cached','--quiet',check=False).returncode
            if changed==1:
                git(dest,'commit','--quiet','-m','Publish Kingdom Watch runtime '+release['id'])
                log('Committed runtime release '+release['id'])
            elif changed!=0:raise RuntimeError('Cannot inspect staged runtime changes')
            record['publication_commit']=git(dest,'rev-parse','HEAD').stdout.strip();record['phase']='committed';write_json(REPORT,record)
            log('Pushing runtime repository (no source repository commits)...')
            git(dest,'-c','http.lowSpeedLimit=1024','-c','http.lowSpeedTime=90','push','--set-upstream','origin','main',echo=True)
        remote=api.call('/repos/'+cfg['owner']+'/'+cfg['repository']+'/git/ref/heads/main')
        if remote['object']['sha']!=record.get('publication_commit'):
            raise RuntimeError('Remote main does not match this release; rerun publication before checking status')
        record['remote_commit_verified']=True
        if not args.status_only:record['pages_settings']=enable_pages(api,cfg)
        record['phase']='uploaded';write_json(REPORT,record)
        complete=check_status(api,cfg,stage,release,args.wait_seconds,record)
        log(('Published and HTTP-verified: ' if complete else 'Uploaded; Pages is still pending: ')+record['url'])
        code=0 if complete else 2
        return code
    except Exception as exc:
        record['complete']=False;record['phase']='failed';record['error']=str(exc);raise
    finally:
        record['source_head_unchanged']=git(PROJECT,'rev-parse','HEAD').stdout.strip()==source_head
        record['source_index_unchanged']=hashlib.sha256(git(PROJECT,'ls-files','--stage').stdout.encode()).hexdigest()==source_index
        if not record['source_head_unchanged'] or not record['source_index_unchanged']:
            record['complete']=False;record['phase']='failed';record['error']='Source repository state changed during publication'
            write_json(report_path,record);raise RuntimeError(record['error'])
        write_json(report_path,record)
        log('Report: '+str(report_path))


if __name__=='__main__':
    try:sys.exit(main())
    except Exception as exc:log(type(exc).__name__+': '+str(exc));sys.exit(1)
