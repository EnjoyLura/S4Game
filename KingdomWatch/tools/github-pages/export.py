"""Create a runtime-only, project-path-safe GitHub Pages package.

Reads a normal production Cocos export; never changes it or the CF templates.
"""
from __future__ import annotations
import hashlib
import json
import re
import shutil
import struct
from pathlib import Path
from urllib.parse import unquote, urlsplit

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[1]
WEB=PROJECT/'build/web-mobile'
EXTENSIONS={'.html','.css','.js','.json','.wasm','.bin','.png','.jpg','.jpeg','.webp','.gif','.mp3','.wav','.ogg','.m4a','.ttf','.otf','.woff','.woff2','.txt'}


def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()


def write_json(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')


def wasm_memories(data):
    if data[:8]!=b'\0asm\x01\0\0\0':raise RuntimeError('Invalid WASM header')
    def leb(p):
        v=shift=0
        while True:
            b=data[p];p+=1;v|=(b&127)<<shift
            if not b&128:return v,p
            shift+=7
    def string(p):
        n,p=leb(p);return p+n
    def limits(p):
        flags,p=leb(p);minimum,p=leb(p)
        if flags&1:_,p=leb(p)
        return {'shared':bool(flags&2),'memory64':bool(flags&4),'minimum_pages':minimum},p
    p=8;mem=[]
    while p<len(data):
        section=data[p];length,q=leb(p+1);end=q+length
        if section==2:
            n,q=leb(q)
            for _ in range(n):
                q=string(string(q));kind=data[q];q+=1
                if kind==0:_,q=leb(q)
                elif kind==1:q+=1;_,q=limits(q)
                elif kind==2:m,q=limits(q);mem.append(m)
                elif kind==3:q+=2
                elif kind==4:q+=1;_,q=leb(q)
                else:raise RuntimeError('Unknown WASM import kind')
        elif section==5:
            n,q=leb(q)
            for _ in range(n):m,q=limits(q);mem.append(m)
        p=end
    return mem


def runtime_files():
    for folder in ('assets','src','cocos-js'):
        for p in sorted((WEB/folder).rglob('*')):
            if p.is_symlink():raise RuntimeError('Symlink in build: '+str(p))
            if p.is_file():
                if p.suffix.lower() not in EXTENSIONS:raise RuntimeError('Unrecognized runtime extension: '+p.name)
                if p.suffix=='.map' or any(x in p.parts for x in ('node_modules','.git','logs','cache')):raise RuntimeError('Development file in runtime')
                yield p
    for pattern in ('application.*.js','index.*.js','style.*.css','audio-credits*.html','font-licenses*.txt'):
        yield from sorted(WEB.glob(pattern))


def verify_links(folder):
    """Verify all explicit file URLs plus Cocos bundle entry/version manifests."""
    missing=[];checked=0;external=set();metadata=[]
    virtual_modules=set()
    for p in folder.rglob('*.js'):
        virtual_modules.update(re.findall(r'''System\.register\(["']([^"']+)["']''',p.read_text('utf-8')))
    candidates=re.compile(r'''["']([^"'\s<>]{1,220}\.(?:js|json|css|wasm|png|jpg|jpeg|webp|mp3|wav|ttf|woff2?|bin)(?:\?[^"'\s<>]*)?)["']''')
    for f in folder.rglob('*'):
        if not f.is_file() or f.suffix not in {'.html','.js','.json','.css'}:continue
        if f.name.startswith('hosting-') or f.name=='index.html':continue
        text=f.read_text('utf-8')
        for match in candidates.finditer(text):
            raw=match[1];url=urlsplit(raw)
            if raw in virtual_modules or (raw.startswith('./') and raw[2:] in {v.rsplit('/',1)[-1] for v in virtual_modules}):continue
            if f.suffix=='.json' and '/import/' in f.relative_to(folder).as_posix() and any(label in raw for label in ('loop-selection.json','idle.frames.json','motion-selection.json')):
                metadata.append(raw);continue
            if url.scheme or raw.startswith('//'):
                if url.scheme in ('http','https'):external.add(raw)
                continue
            path=unquote(url.path)
            if path.startswith('/'):
                # Only the explicit <base> may start at the GitHub project root.
                missing.append(f'{f.relative_to(folder)}: absolute file URL {path}');continue
            if any(x in path for x in ('${','{','}','\\','*')):continue
            if not (path.startswith('.') or '/' in path or path.startswith(('index.','application.','style.'))):continue
            if any((parent/path).is_file() for parent in (f.parent,folder)):
                checked+=1
            elif path.startswith(('./','../','assets/','src/','cocos-js/')):
                missing.append(f'{f.relative_to(folder)}: {path}')
    settings=json.loads(next((folder/'src').glob('settings.*.json')).read_text('utf-8'))
    if settings['assets'].get('server') or settings['assets'].get('remoteBundles'):raise RuntimeError('Remote Cocos bundles require explicit CORS review')
    for name,version in settings['assets']['bundleVers'].items():
        for filename in ('config.'+version+'.json','index.'+version+'.js'):
            if not (folder/'assets'/name/filename).is_file():missing.append(name+'/'+filename)
    if missing:raise RuntimeError('Unresolved runtime URLs: '+json.dumps(sorted(set(missing))[:30]))
    return {'explicit_file_references_checked':checked,'embedded_provenance_strings_not_fetches':sorted(set(metadata)),'virtual_system_modules':len(virtual_modules),'remote_url_literals':sorted(external),'bundle_versions':settings['assets']['bundleVers']}


def address_runtime_code(folder,html,engine_revision):
    """Give post-build patches real versioned paths, not only query strings.

    Preserve Cocos bundle/native media paths. Version the modified engine as a
    group (it has cyclic imports), then rename the acyclic startup dependencies
    by their final bytes. The normal CF build is never written here.
    """
    def remap(mapping):
        nonlocal html
        for f in list(folder.rglob('*')):
            if f.is_file() and f.suffix in {'.js','.json','.html','.css'}:
                before=f.read_text('utf-8');after=before
                for old,new in mapping.items():after=after.replace(old,new)
                if after!=before:f.write_text(after,encoding='utf-8',newline='')
        for old,new in mapping.items():html=html.replace(old,new)
    engines=list((folder/'cocos-js').glob('*.js'))
    names={p.name:p.stem+'.'+engine_revision+'.js' for p in engines}
    remap(names)
    for p in engines:p.rename(p.with_name(names[p.name]))
    effect=folder/'src/effect.bin'
    if effect.exists():
        name='effect.'+sha(effect)[:16]+'.bin';remap({'src/effect.bin':'src/'+name});effect.rename(effect.with_name(name))
    for pattern,prefix in [('src/settings.*.json','settings'),('src/import-map.*.json','import-map'),('application.*.js','application'),('index.*.js','index')]:
        paths=list(folder.glob(pattern))
        if len(paths)!=1:raise RuntimeError('Expected one startup dependency: '+pattern)
        p=paths[0];name=prefix+'.'+sha(p)[:16]+p.suffix
        if p.name!=name:remap({p.name:name});p.rename(p.with_name(name))
    return html


def export(destination,config):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+',config['repository']):raise RuntimeError('Invalid repository name')
    destination=Path(destination).resolve()
    if destination.exists() and any(destination.iterdir()):raise RuntimeError('Export destination must be empty')
    destination.mkdir(parents=True,exist_ok=True)
    production=json.loads((WEB/'web-release.json').read_text('utf-8'))
    if not production.get('production') or not production.get('md5Cache'):raise RuntimeError('Run the original production build first')
    base='/'+config['repository']+'/'
    for source in runtime_files():
        relative=source.relative_to(WEB);target=destination/relative
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    original_html=address_runtime_code(destination,(WEB/'index.html').read_text('utf-8'),production['engineRevision'])
    if '<base ' in original_html:raise RuntimeError('Unexpected existing document base')
    game_html=original_html.replace('<head>','<head>\n<base href="'+base+'">',1)
    entry_bytes=game_html.encode('utf-8');entry_sha=hashlib.sha256(entry_bytes).hexdigest();entry='game.'+entry_sha[:16]+'.html'
    (destination/entry).write_bytes(entry_bytes)
    (destination/'index.html').write_text((HERE/'launcher.html').read_text('utf-8').replace('__BASE_PATH__',base),encoding='utf-8')
    (destination/'hosting-diagnostics.html').write_text((HERE/'diagnostics.html').read_text('utf-8').replace('__BASE_PATH__',base),encoding='utf-8')
    (destination/'.nojekyll').write_bytes(b'')
    memories={p.relative_to(destination).as_posix():wasm_memories(p.read_bytes()) for p in destination.rglob('*.wasm')}
    shared=any(m['shared'] for ms in memories.values() for m in ms)
    text='\n'.join(p.read_text('utf-8') for p in destination.rglob('*.js'))
    if shared or any(v in text for v in ('SharedArrayBuffer','PThread','pthread_create')):
        raise RuntimeError('This export needs shared memory; add and validate isolation before publishing')
    for f in destination.rglob('*'):
        if f.is_file() and f.suffix in {'.js','.json','.html','.txt'}:
            value=f.read_text('utf-8')
            if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}',value):raise RuntimeError('Credential-like value in '+f.name)
    links=verify_links(destination)
    files={p.relative_to(destination).as_posix():{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(destination.rglob('*')) if p.is_file()}
    total=sum(v['bytes'] for v in files.values())
    if total>950*1024**2:raise RuntimeError('Export approaches the GitHub Pages 1 GiB site limit')
    if any(v['bytes']>=100*1024**2 for v in files.values()):raise RuntimeError('A runtime file reaches the GitHub 100 MiB file limit')
    inventory={'schema':1,'files':files,'total_bytes':total,'runtime':{'cocos':'3.8.8','engine_revision':production['engineRevision'],'shared_wasm_memory':shared,'wasm_memories':memories,'remote_bundles':False}}
    raw=(json.dumps(inventory,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode('utf-8')
    inv_sha=hashlib.sha256(raw).hexdigest();inv_name='hosting-files.'+inv_sha[:16]+'.json';(destination/inv_name).write_bytes(raw)
    pointer={'schema':1,'id':inv_sha[:16],'base_path':base,'entry':entry,'entry_sha256':entry_sha,'entry_bytes':len(entry_bytes),'inventory':inv_name,'inventory_sha256':inv_sha,'requires_cross_origin_isolation':False,'wasm':sorted(memories)}
    write_json(destination/'hosting-release.json',pointer)
    # Independently reread every exported file after writing the inventories.
    for name,record in files.items():
        if sha(destination/name)!=record['sha256']:raise RuntimeError('Export checksum changed: '+name)
    return {'release':pointer,'file_count':len(files)+2,'runtime_bytes':total,'validation':links,'all_exported_hashes_verified':True,'source_web_files_modified':False}


def validate_package(folder,config):
    """Inspect an exported package without executing JS, WASM or a test harness."""
    folder=Path(folder).resolve()
    def safe_file(name):
        if not isinstance(name,str) or not name or any(c in name for c in ('\\',':','?','#')) or any(p in ('','.','..') for p in name.split('/')):
            raise RuntimeError('Unsafe runtime package path')
        path=folder/name
        if not path.resolve().is_relative_to(folder) or path.is_symlink() or not path.is_file():
            raise RuntimeError('Missing or unsafe runtime package file: '+name)
        return path
    release=json.loads(safe_file('hosting-release.json').read_text('utf-8'))
    base='/'+config['repository']+'/'
    if release.get('schema')!=1 or release.get('base_path')!=base:
        raise RuntimeError('Runtime package does not match the configured project path')
    if not re.fullmatch(r'hosting-files\.[a-f0-9]{16}\.json',release.get('inventory','')):
        raise RuntimeError('Invalid runtime inventory name')
    inventory_path=safe_file(release['inventory']);digest=sha(inventory_path)
    if digest!=release.get('inventory_sha256') or release.get('id')!=digest[:16] or inventory_path.name!='hosting-files.'+digest[:16]+'.json':
        raise RuntimeError('Runtime inventory checksum mismatch')
    inventory=json.loads(inventory_path.read_text('utf-8'));files=inventory['files']
    actual=set()
    for path in folder.rglob('*'):
        if path.is_symlink():raise RuntimeError('Symlink in runtime package')
        if path.is_file():actual.add(path.relative_to(folder).as_posix())
    if actual!=set(files)|{'hosting-release.json',release['inventory']}:
        raise RuntimeError('Runtime package contains missing or unlisted files')
    for name,meta in files.items():
        path=safe_file(name)
        if name!='.nojekyll' and path.suffix.lower() not in EXTENSIONS:
            raise RuntimeError('Non-runtime file in package: '+name)
        if any(p in ('.git','.github','node_modules','logs','cache') for p in path.relative_to(folder).parts):
            raise RuntimeError('Development directory in runtime package')
        if path.stat().st_size!=meta['bytes'] or sha(path)!=meta['sha256']:
            raise RuntimeError('Runtime package checksum mismatch: '+name)
    total=sum(meta['bytes'] for meta in files.values())
    if total!=inventory['total_bytes'] or total>950*1048576 or any(meta['bytes']>=100*1048576 for meta in files.values()):
        raise RuntimeError('Runtime package size or file budget is invalid')
    if safe_file('.nojekyll').stat().st_size!=0:raise RuntimeError('Expected empty .nojekyll')
    entry=safe_file(release['entry'])
    if not re.fullmatch(r'game\.[a-f0-9]{16}\.html',entry.name) or sha(entry)!=release['entry_sha256'] or entry.stat().st_size!=release['entry_bytes']:
        raise RuntimeError('Runtime entry checksum mismatch')
    if '<base href="'+base+'">' not in entry.read_text('utf-8'):
        raise RuntimeError('Missing project-path base in game entry')
    wasm=sorted(name for name in files if name.endswith('.wasm'))
    memories={name:wasm_memories(safe_file(name).read_bytes()) for name in wasm}
    if wasm!=release['wasm'] or release.get('requires_cross_origin_isolation') is not False or any(m['shared'] for ms in memories.values() for m in ms):
        raise RuntimeError('WASM requirements need a separate isolation adaptation')
    if memories!=inventory['runtime']['wasm_memories']:raise RuntimeError('WASM memory inventory mismatch')
    for name in files:
        if Path(name).suffix in {'.js','.json','.html','.txt'}:
            value=safe_file(name).read_text('utf-8')
            if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}',value):
                raise RuntimeError('Credential-like value in runtime package')
            if name.endswith('.js') and any(v in value for v in ('SharedArrayBuffer','PThread','pthread_create')):
                raise RuntimeError('Shared-memory JS requires a separate isolation adaptation')
    return {'release':release,'file_count':len(actual),'runtime_bytes':total,'all_exported_hashes_verified':True,
            'links':verify_links(folder),'wasm_memories':memories,'validation':'static files and WASM headers only',
            'javascript_executed':False,'wasm_compiled_or_instantiated':False,'game_browser_or_tests_started':False}


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('destination');args=parser.parse_args()
    print(json.dumps(export(args.destination,json.loads((HERE/'config.json').read_text('utf-8'))),ensure_ascii=False,indent=2))
