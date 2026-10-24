"""Omit unreachable lobby trial textures from an export, preserving authoring files.

Keep UUID slots and serialized packs intact. Only remove resource aliases and
native-version records for obsolete trial images; live resource paths stay intact.
"""
import hashlib,json,re
from pathlib import Path
from art_resources import decode_uuid,contained,write_json


def active_paths(project):
    file=project/'assets/scripts/ui/HeroLobbyIdle.ts'
    text=file.read_text('utf-8')
    heroes=re.search(r'const HEROES = new Set\(\[(.*?)\]\)',text,re.S)
    expression=re.search(r'const directory = (.*?);',text,re.S)
    if not heroes or not expression:raise RuntimeError('Cannot resolve lobby animation routing')
    heroes=set(re.findall(r"'([^']+)'",heroes[1]));remaining=expression[1];routes={}
    while match:=re.match(r"\s*hero\s*===\s*'([^']+)'\s*\?\s*'(hero_lobby_idle_v\d+/)'\s*:",remaining):
        hero,directory=match.groups()
        if hero not in heroes or hero in routes:raise RuntimeError('Ambiguous lobby animation routing')
        routes[hero]=directory;remaining=remaining[match.end():]
    default=re.fullmatch(r"\s*'(hero_lobby_idle_v\d+/)'\s*",remaining)
    if not default:raise RuntimeError('Unsupported lobby animation routing; preserve export until reviewed')
    for hero in heroes:routes.setdefault(hero,default[1])
    for source in (project/'assets/scripts').rglob('*.ts'):
        script=source.read_text('utf-8')
        if re.search(r'\bloadDir\s*\(',script):raise RuntimeError('Directory-wide loads need a separate trial-art reachability audit')
        if source!=file and 'hero_lobby_idle_v' in script:raise RuntimeError('Additional lobby art consumer needs review')
    return {'ux/'+directory+hero for hero,directory in routes.items()}


def prune_lobby_trials(folder,project):
    folder=Path(folder).resolve();active=active_paths(project)
    config_path,=(folder/'assets/resources').glob('config.*.json')
    config=json.loads(config_path.read_text('utf-8'));paths=config['paths']
    found={v[0] for v in paths.values()}
    for root in active:
        if root+'/spriteFrame' not in found or root+'.frames' not in found:
            raise RuntimeError('Active lobby animation missing from build: '+root)
    removed={k:v for k,v in paths.items() if v[0].startswith('ux/hero_lobby_idle_v')
      and not any(v[0] in {root,root+'.frames',root+'/texture',root+'/spriteFrame'} for root in active)}
    if not removed:return {'active':sorted(active),'removedNativeCount':0,'removedNativeBytes':0}
    roots={v[0] for v in removed.values() if not v[0].endswith(('/texture','/spriteFrame','.frames'))}
    for root in roots:
        if not re.fullmatch(r'ux/hero_lobby_idle_v\d+/[a-z]+',root):raise RuntimeError('Unexpected lobby trial path')
    native_ids={decode_uuid(config['uuids'][int(k)]) for k,v in removed.items() if v[0] in roots}
    # A direct scene/asset UUID consumer would bypass the resource aliases.
    for source in (project/'assets').rglob('*'):
        if source.suffix not in {'.scene','.prefab','.json','.ts'} or not source.is_file():continue
        if 'hero_lobby_idle_' in source.as_posix():continue
        text=source.read_text('utf-8')
        if any(uuid in text for uuid in native_ids):raise RuntimeError('Trial texture has a direct UUID consumer: '+str(source))
    versions=config['versions']['native'];keep=[];files=[];removed_ids=set()
    for offset in range(0,len(versions),2):
        key,version=versions[offset:offset+2];uuid=decode_uuid(config['uuids'][key] if isinstance(key,int) else key)
        if uuid not in native_ids:keep.extend([key,version]);continue
        candidates=list((config_path.parent/config['nativeBase']/uuid[:2]).glob(uuid+'.'+version+'.*'))
        if len(candidates)!=1 or candidates[0].suffix!='.png':raise RuntimeError('Expected one standalone trial PNG')
        path=contained(folder,candidates[0]);files.append({'path':path.relative_to(folder).as_posix(),'bytes':path.stat().st_size,
          'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});removed_ids.add(uuid)
    if removed_ids!=native_ids:raise RuntimeError('Trial native UUID/version mismatch')
    # Only the disposable export copy is mutated, after all targets are checked.
    config['paths']={k:v for k,v in paths.items() if k not in removed}
    config['versions']['native']=keep
    raw=(json.dumps(config,ensure_ascii=False,separators=(',',':'))+'\n').encode();version=hashlib.sha256(raw).hexdigest()[:16]
    settings_path,=(folder/'src').glob('settings.*.json');settings=json.loads(settings_path.read_text('utf-8'))
    old_version=settings['assets']['bundleVers']['resources'];new_config=config_path.with_name('config.'+version+'.json')
    if new_config.exists():raise RuntimeError('Pruned config target already exists')
    new_config.write_bytes(raw);contained(folder,config_path).unlink()
    old_index=config_path.parent/('index.'+old_version+'.js')
    if old_index.is_file():contained(folder,old_index).rename(contained(folder,old_index.with_name('index.'+version+'.js')))
    settings['assets']['bundleVers']['resources']=version;write_json(settings_path,settings)
    for item in files:contained(folder,folder/item['path']).unlink()
    return {'active':sorted(active),'removedResourceAliases':len(removed),'removedNativeCount':len(files),
      'removedNativeBytes':sum(f['bytes'] for f in files),'removedTrialRoots':sorted(roots),'files':files,
      'sourceAndNormalBuildUnchanged':True,'uuidSlotsAndSerializedPacksPreserved':True}
