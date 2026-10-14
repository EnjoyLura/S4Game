"""Verify release entry, the shared comic assets and the new expedition art by SHA-256."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import tempfile
import sys

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
BUILD = GAME/'build/web-mobile'
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    index = (BUILD/'index.html').read_text(encoding='utf-8')
    version = 'levels-comic-v1-'+re.search(r'index\.js\?v=(\d+)',index).group(1)
    entry = (BUILD/'assets/main/index.js').read_text(encoding='utf-8')
    assert '__KW_DPR_CAP' in index
    for token in ['levelUpperScene','levelPageBackdrop','levelDifficulty:','levelSelect:','levelBattle','levelSquad',
                  'bg_levels_comic_v1','levels_comic_v1/comic_terrain_','squadFormation','squadRemoveDialog',
                  'squadHeroRoster','heroPageBackdrop','bg_heroes_comic_v3','shopShelfBackdrop']:
        assert token in entry,token
    level_module = entry.split('System.register("chunks:///_virtual/LevelsPage.ts"',1)[1].split('\nSystem.register(',1)[0]
    assert 'function plaque(' not in level_module
    assert 'lobby_levels_v1' not in level_module and 'lobby_rewards_v1' not in level_module
    assert "FROST_RESOURCE = 'fx/frost_domain_video_v10'" in entry
    assert 'RAIN_CAP = 128' in entry and 'mora_linger' in entry and 'FrostProjectileVFX' in entry
    engine = next(p for p in (BUILD/'cocos-js').glob('_virtual_cc-*.js') if 'window.__KW_DPR_CAP || 2' in p.read_text(encoding='utf-8'))
    files={'index.html':'index.html','main.js':'assets/main/index.js','resources-config.json':'assets/resources/config.json',
           'dpr-engine.js':engine.relative_to(BUILD).as_posix()}
    local={}
    folders=[OUT,OUT.parent/'hero-comic-v3',OUT.parent/'hero-comic-v2',OUT.parent/'hero-comic-v1',OUT.parent/'shop-comic-v1']
    assets=sum([json.loads((folder/'assets.json').read_text(encoding='utf-8')) for folder in folders],[])
    for asset in assets:
        source=Path(asset['file'])
        uuid=json.loads(source.with_suffix(source.suffix+'.meta').read_text(encoding='utf-8'))['uuid']
        rel=f'assets/resources/native/{uuid[:2]}/{uuid}{source.suffix}'
        assert sha(source)==sha(BUILD/rel),asset['key']+' build mismatch'
        files[asset['key']]=rel
        local[asset['key']]={'sha256':sha(source),'bytes':source.stat().st_size,'path':rel}
    assert len(local)==47
    def verify(item):
        name,rel=item
        target=Path(tempfile.gettempdir())/('kw-levels-comic-online-'+name.replace('.','-')+Path(rel).suffix)
        subprocess.run(['curl.exe','--fail','--location','--silent','--show-error','--retry','2','--max-time','30',
                        '--proxy','http://127.0.0.1:10808','--output',str(target),'https://kingdom-watch.pages.dev/'+rel+'?v='+version],
                       check=True,capture_output=True)
        assert sha(target)==sha(BUILD/rel),name+' online hash mismatch'
        return name,{'matchesLocal':True,'sha256':sha(target),'bytes':target.stat().st_size}
    with ThreadPoolExecutor(max_workers=4) as pool:
        online=dict(pool.map(verify,files.items()))
    ui=json.loads((OUT/'ui-validation.json').read_text(encoding='utf-8'))
    hero_ui=json.loads((OUT.parent/'hero-comic-v3/ui-validation.json').read_text(encoding='utf-8'))
    shop_ui=json.loads((OUT.parent/'shop-comic-v1/ui-validation.json').read_text(encoding='utf-8'))
    assert all(r['ok'] and not r['errors'] and not r['failures'] for r in [ui,hero_ui,shop_ui])
    record={'dateUTC':datetime.now(timezone.utc).isoformat(),'style':'清爽漫画奇幻','status':'published',
            'url':'https://kingdom-watch.pages.dev/?v='+version,'deployment':sys.argv[1],
            'generation':{'tool':'built-in imagegen','newIllustrations':10,'sharedPreviousIllustrations':37},
            'components':'map-room environment, three battlefield dioramas, difficulty tabs, stage cycle buttons, level route selectors, star/reward chests, battle/squad actions, full formation panel and remove confirmation',
            'typeCheck':'passed','creatorBuild':'passed: 3.8.8 web-mobile','dprPatch':'passed',
            'uiChecks':ui,'heroRegression':hero_ui,'shopRegression':shop_ui,'localAssets':local,'onlineFiles':online,
            'battleInspection':'Not entered. Start payload verified by intercepting scene load in isolated browser contexts.',
            'existingBattleChangesPreserved':['frost skill v10','128 staggered ultimate shards','mora_linger +1 second card','FrostProjectileVFX']}
    (OUT/'deployment-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'url':record['url'],'onlineMatches':len(online),'newIllustrations':10},ensure_ascii=False))
if __name__=='__main__':
    main()
