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
    version = 'levels-comic-v2-'+re.search(r'index\.js\?v=(\d+)',index).group(1)
    entry = (BUILD/'assets/main/index.js').read_text(encoding='utf-8')
    assert '__KW_DPR_CAP' in index
    for token in ['levelUpperScene','levelPageBackdrop','levelDifficulty:','levelSelect:','levelBattle','levelSquad',
                  'bg_levels_','_comic_v2','levelRouteContent','左右滑动选关','squadFormation','squadRemoveDialog',
                  'squadHeroRoster','heroPageBackdrop','bg_heroes_comic_v3','shopShelfBackdrop']:
        assert token in entry,token
    level_module = entry.split('System.register("chunks:///_virtual/LevelsPage.ts"',1)[1].split('\nSystem.register(',1)[0]
    assert 'function plaque(' not in level_module
    assert 'lobby_levels_v1' not in level_module and 'lobby_rewards_v1' not in level_module
    assert 'comic_terrain_' not in level_module and 'levelSwitch:' not in level_module
    squad_module = entry.split('System.register("chunks:///_virtual/SquadPanel.ts"',1)[1].split('\nSystem.register(',1)[0]
    assert not re.search(r"['\"]squadBack['\"]", squad_module)
    assert "FROST_RESOURCE = 'fx/frost_domain_video_v10'" in entry
    assert 'RAIN_CAP = 128' in entry and 'mora_linger' in entry and 'FrostProjectileVFX' in entry
    engine = next(p for p in (BUILD/'cocos-js').glob('_virtual_cc-*.js') if 'window.__KW_DPR_CAP || 2' in p.read_text(encoding='utf-8'))
    files={'index.html':'index.html','main.js':'assets/main/index.js','resources-config.json':'assets/resources/config.json',
           'dpr-engine.js':engine.relative_to(BUILD).as_posix()}
    local={}
    folders=[OUT,OUT.parent/'levels-comic-v1',OUT.parent/'hero-comic-v3',OUT.parent/'hero-comic-v2',OUT.parent/'hero-comic-v1',OUT.parent/'shop-comic-v1']
    assets=sum([json.loads((folder/'assets.json').read_text(encoding='utf-8')) for folder in folders],[])
    for asset in assets:
        source=Path(asset['file'])
        uuid=json.loads(source.with_suffix(source.suffix+'.meta').read_text(encoding='utf-8'))['uuid']
        rel=f'assets/resources/native/{uuid[:2]}/{uuid}{source.suffix}'
        assert sha(source)==sha(BUILD/rel),asset['key']+' build mismatch'
        files[asset['key']]=rel
        local[asset['key']]={'sha256':sha(source),'bytes':source.stat().st_size,'path':rel}
    assert len(local)==50
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
    assert ui['ok'] and not ui['errors'] and not ui['failures']
    live=json.loads((OUT/'online-smoke.json').read_text(encoding='utf-8'))
    assert live['ok'] and not live['errors'] and live['url'].endswith(version)
    record={'dateUTC':datetime.now(timezone.utc).isoformat(),'style':'清爽漫画奇幻','status':'published',
            'url':'https://kingdom-watch.pages.dev/?v='+version,'deployment':sys.argv[1],
            'generation':{'tool':'built-in imagegen','newIllustrations':3,'previousIllustrationsVerified':47},
            'components':'three continuous outdoor scenes; compact header; horizontally draggable masked route with saved offset; reward dock with non-overlapping conditions/chests/amounts/claim controls; squad back button removed',
            'typeCheck':'passed','creatorBuild':'passed: 3.8.8 web-mobile','dprPatch':'passed',
            'uiChecks':ui,'onlineSmoke':live,'localAssets':local,'onlineFiles':online,
            'battleInspection':'Not entered. Start payload verified by intercepting scene load in isolated browser contexts.',
            'existingBattleChangesPreserved':['frost skill v10','128 staggered ultimate shards','mora_linger +1 second card','FrostProjectileVFX']}
    (OUT/'deployment-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'url':record['url'],'onlineMatches':len(online),'newIllustrations':3},ensure_ascii=False))
if __name__=='__main__':
    main()
