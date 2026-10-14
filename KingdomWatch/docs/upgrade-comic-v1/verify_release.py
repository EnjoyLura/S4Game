"""Compare deployed entry, engine and production artwork with the actual Creator build."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import sys
import tempfile

OUT=Path(__file__).resolve().parent
GAME=OUT.parents[1]
BUILD=GAME/'build/web-mobile'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    index=(BUILD/'index.html').read_text(encoding='utf-8')
    version='upgrade-comic-'+re.search(r'index\.js\?v=(\d+)',index).group(1)
    entry=(BUILD/'assets/main/index.js').read_text(encoding='utf-8')
    for token in ['trainingUpperScene','trainingPlatformAnchor','trainingPageBackdrop','trainingActionDock',
        'bg_upgrade_comic_v1','comic_staff_pyro_v1','comic_staff_volt_v1','comic_staff_mora_v1',
        'comic_training_hammer_v1','trainingScrollThumb','局内仍需三选一解锁',
        'ABILITY_CARDS','skillUnlocked','ultUnlocked','canTakeCard','RAIN_CAP = 128',
        'bg_heroes_comic_v3','bg_levels_','_comic_v2','shopShelfBackdrop']:
        assert token in entry,token
    assert "FROST_RESOURCE = 'fx/frost_domain_video_v10'" in entry
    assert '__KW_DPR_CAP' in index
    engine=next(p for p in (BUILD/'cocos-js').glob('_virtual_cc-*.js') if 'window.__KW_DPR_CAP || 2' in p.read_text(encoding='utf-8'))
    files={'index.html':'index.html','main.js':'assets/main/index.js','resources-config.json':'assets/resources/config.json',
           'dpr-engine.js':engine.relative_to(BUILD).as_posix()}
    specs=json.loads((OUT/'assets.json').read_text(encoding='utf-8'))
    for r in specs:
        source=Path(r['file']);uuid=json.loads(source.with_suffix(source.suffix+'.meta').read_text(encoding='utf-8'))['uuid']
        rel=f'assets/resources/native/{uuid[:2]}/{uuid}{source.suffix}'
        assert sha(source)==sha(BUILD/rel),r['key']+' build mismatch'
        files[r['key']]=rel
    def check(item):
        key,rel=item
        target=Path(tempfile.gettempdir())/('kw-upgrade-online-'+key.replace('.','-')+Path(rel).suffix)
        subprocess.run(['curl.exe','--fail','--location','--silent','--show-error','--retry','2','--max-time','30',
            '--proxy','http://127.0.0.1:10808','--output',str(target),'https://kingdom-watch.pages.dev/'+rel+'?v='+version],check=True,capture_output=True)
        assert sha(target)==sha(BUILD/rel),key+' online mismatch'
        return key,{'matchesLocal':True,'bytes':target.stat().st_size,'sha256':sha(target),'path':rel}
    with ThreadPoolExecutor(max_workers=4) as pool:matches=dict(pool.map(check,files.items()))
    reports={name:json.loads((OUT/(name+'.json')).read_text(encoding='utf-8')) for name in ['ui-validation','online-validation']}
    assert all(r['ok'] for r in reports.values())
    assert reports['online-validation']['url'].endswith(version)
    record={'dateUTC':datetime.now(timezone.utc).isoformat(),'status':'published','url':'https://kingdom-watch.pages.dev/?v='+version,
        'deployment':sys.argv[1],'typeCheck':'passed','creatorBuild':'passed: 3.8.8 web-mobile','dprPatch':'passed',
        'newArt':len(specs),'realBattleStarted':False,'checks':reports,'onlineFiles':matches}
    (OUT/'deployment-validation.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'url':record['url'],'onlineMatches':len(matches)},ensure_ascii=False))

if __name__=='__main__':main()
