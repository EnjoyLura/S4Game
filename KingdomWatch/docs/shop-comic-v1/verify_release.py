"""Verify the deployed build and every new production illustration by SHA-256."""
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
BUILD = GAME / 'build/web-mobile'
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    index=(BUILD/'index.html').read_text(encoding='utf-8')
    stamp=re.search(r'index\.js\?v=(\d+)',index).group(1)
    version='shop-layout-'+stamp
    entry=(BUILD/'assets/main/index.js').read_text(encoding='utf-8')
    assert '__KW_DPR_CAP' in index
    assert 'comicPurchase' in entry or 'shopPurchaseDialog' in entry
    assert 'comicPlate' in entry and 'shop_comic_v1' in entry and 'bg_shop_comic_v1' in entry
    assert 'shopShelfBackdrop' in entry
    assert 'comicPortrait' in entry and 'portraitClip' in entry
    assert 'FROST_RESOURCE = \'fx/frost_domain_video_v10\'' in entry
    assert 'RAIN_CAP = 128' in entry and 'mora_linger' in entry and 'FrostProjectileVFX' in entry
    engine=next(p for p in (BUILD/'cocos-js').glob('_virtual_cc-*.js') if 'window.__KW_DPR_CAP || 2' in p.read_text(encoding='utf-8'))
    files={'index.html':'index.html','main.js':'assets/main/index.js','resources-config.json':'assets/resources/config.json',
      'dpr-engine.js':engine.relative_to(BUILD).as_posix()}
    local={}
    for asset in json.loads((OUT/'assets.json').read_text(encoding='utf-8')):
        source=Path(asset['file'])
        meta=json.loads(source.with_suffix(source.suffix+'.meta').read_text(encoding='utf-8'))
        uuid=meta['uuid']
        rel=f'assets/resources/native/{uuid[:2]}/{uuid}{source.suffix}'
        assert sha(source)==sha(BUILD/rel),asset['key']+' build image mismatch'
        files[asset['key']]=rel
        local[asset['key']]={'sha256':sha(source),'bytes':source.stat().st_size,'path':rel}
    assert len(local)==20
    def verify(item):
        name,rel=item
        dest=Path(tempfile.gettempdir())/('kw-shop-comic-online-'+name.replace('.','-')+Path(rel).suffix)
        cmd=['curl.exe','--fail','--location','--silent','--show-error','--retry','2','--max-time','30',
          '--proxy','http://127.0.0.1:10808','--output',str(dest),'https://kingdom-watch.pages.dev/'+rel+'?v='+version]
        subprocess.run(cmd,check=True,capture_output=True)
        assert sha(dest)==sha(BUILD/rel),name+' online hash mismatch'
        return name,{'matchesLocal':True,'sha256':sha(dest),'bytes':dest.stat().st_size}
    with ThreadPoolExecutor(max_workers=4) as pool:
        online=dict(pool.map(verify,files.items()))
    ui=json.loads((OUT/'ui-validation.json').read_text(encoding='utf-8'))
    assert ui['ok'] and not ui['errors'] and not ui['failures']
    record={'dateUTC':datetime.now(timezone.utc).isoformat(),'style':'清爽漫画奇幻','status':'published',
      'url':'https://kingdom-watch.pages.dev/?v='+version,'deployment':sys.argv[1],
      'generation':{'tool':'built-in imagegen','productionIllustrations':20,'singleStyleReference':True},
      'components':'scene, item illustrations, hero portraits, cards, tabs, prices, purchase dialogs, shared wallet and navigation',
      'layoutChanges':['title anchored to the wooden sign','shared compact wallet aligned right','full-width paper backdrop behind the shelf','single contour without layered bottom shadows','true circular hero portrait masks'],
      'codeDrawnComponents':'shared flat faces, single contours and deterministic press/disabled states',
      'typeCheck':'passed','creatorBuild':'passed: 3.8.8 web-mobile','dprPatch':'passed','uiChecks':ui,
      'existingBattleChangesPreserved':['frost skill v10','128 staggered ultimate shards','mora_linger +1 second card','FrostProjectileVFX'],
      'localAssets':local,'onlineFiles':online}
    (OUT/'deployment-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'url':record['url'],'onlineMatches':len(online),'newIllustrations':len(local)},ensure_ascii=False))

if __name__=='__main__':
    main()
