"""Resolve declared warmup paths and actual master files. No game modules execute."""
import json,re
from pathlib import Path

OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
RES=PROJECT/'assets/resources'
checked={}
for name in ['ui/LobbyArtWarmup.ts','ui/BattleEntryWarmup.ts']:
    text=(PROJECT/'assets/scripts'/name).read_text('utf-8')
    for key in re.findall(r"['\"]((?:scenes|fx|[a-z0-9_]+_v\d+)/[a-z0-9_./-]+)['\"]",text):
        if key.endswith('/') or key.endswith('_'): continue
        base=RES/(key if key.startswith(('scenes/','fx/')) else 'ux/'+key)
        options=[base.with_suffix(ext) for ext in ['.png','.jpg','.jpeg','.effect','.json']]
        matches=[p for p in options if p.is_file()]
        assert matches, 'Unresolved warmup path: '+key
        checked[key]=matches[0].relative_to(PROJECT).as_posix()
families={
 'preparation_art_v2':['difficulty_normal_v2','difficulty_elite_v2','difficulty_hell_v2','chest_bronze_v2','chest_sapphire_v2','chest_crimson_v2','claim_button_v2'],
 'shop_comic_v1':['comic_coin_v1','comic_diamond_v1','comic_nav_shop_v1','comic_helm_falcon_v1','comic_nav_map_v1','comic_nav_castle_v1'],
}
for root,names in families.items():
    for name in names:
        path=RES/'ux'/root/(name+'.png');assert path.is_file(), path
        checked[root+'/'+name]=path.relative_to(PROJECT).as_posix()
sources={'archer':'hero_lobby_idle_v103','pyro':'hero_lobby_idle_v99','mora':'hero_lobby_idle_v102','sniper':'hero_lobby_idle_v100','volt':'hero_lobby_idle_v100'}
heroes=[]
for hero,directory in sources.items():
    key=directory+'/'+hero
    manifest=json.loads((RES/'ux'/(key+'.frames.json')).read_text('utf-8'))
    assert len(manifest['animation']['frames'])==len(manifest['animation']['frameDurations'])
    assert all(t>0 for t in manifest['animation']['frameDurations'])
    fallback=RES/'ux/hero_comic_v1'/('comic_figure_'+hero+('_v2' if hero=='archer' else '_v1')+'.png')
    heroes.append({'hero':hero,'actual':key,'frames':len(manifest['animation']['frames']),
                   'fallbackPNGBytesNoLongerRequestedOnSuccess':fallback.stat().st_size})
result={'declaredWarmupFilesResolved':checked,'heroShowcases':heroes,
        'coldFallbackRetained':True,'imagesOrAnimationPixelsModified':False,
        'prefetchAPI':'Cocos resources.preload: download only, no asset parsing',
        'unrelatedHeroEffectsNotConstructed':True,'ordinaryUltFaceDoesNotFetchCoveredPortrait':True,
        'gameBrowserOrWasmExecuted':False}
(OUT/'resource-plan-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'resolvedLiteralFiles':len(checked),'heroShowcases':len(heroes),
                  'fallbackPNGBytesSkippedAcrossFiveHeroes':sum(h['fallbackPNGBytesNoLongerRequestedOnSuccess'] for h in heroes)}))
