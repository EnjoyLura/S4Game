"""Production packaging and static identity review; does not run the game."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil, subprocess, sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p:p.read_text(encoding='utf-8-sig')
sha = lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
subprocess.run([sys.executable,str(HERE/'audit-source.py')],check=True)
record=json.loads(read(HERE/'source-review.json'))
before=json.loads(read(HERE/'before.json'))
art=json.loads(read(HERE/'art-manifest.json'))['assets']
added=sorted(p.relative_to(ROOT).as_posix() for folder in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/folder).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before)
assert added==sorted(n for a in art for n in [a['path'],a['path']+'.meta']),added
web=ROOT/'build/web-mobile'
release=json.loads(read(web/'web-release.json'))
prior_doc=ROOT/'docs/volt-cards-v52'
assert release['production'] and release['md5Cache']
assert release['engineRevision']==json.loads(read(prior_doc/'web-release.json'))['engineRevision']
engine=read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in engine
bundle=read(next((web/'assets/main').glob('index.*.js')))
for marker in ['moraUltimateHitDamage','moraFieldFreeze','moraFreezeChance','moraColdMultiplier',
               '冰封延长','冰川之力','速冻之心','绝对零度','pyroMeteorCount','voltStrikeCount',
               'ui_card_pyro_ember_v2','ui_card_volt_stun_v1','ui_card_mora_freeze_linger_v1',
               'goblin_king_walk_v1','EARLY_FIRST_WIN_GOLD']:
    assert marker in bundle,marker
assert 'mora_morale' not in bundle
config=json.loads(read(next((web/'assets/resources').glob('config.*.json'))))
paths=[v[0] for v in config['paths'].values()]
native_assets=[]
for a in art:
    key='ux/'+Path(a['path']).stem
    assert key+'/spriteFrame' in paths,key
    assert sha(ROOT/a['path'])==a['sha256']
    native=list((web/'assets/resources/native').rglob(a['uuid']+'*.png'))
    assert len(native)==1 and sha(native[0])==a['sha256'],a['id']
    native_assets.append(dict(id=a['id'],path=native[0].relative_to(web).as_posix(),sha256=a['sha256']))
prior=Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
stage=ROOT/'build'/('publish-mora-cards-v53-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
previews=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:
    assert sha(p)==sha(stage/'previews'/p.relative_to(prior/'previews'))
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record.update(stage=str(stage),published=False,project='kingdom-watch',branch='main',
    addedFiles=added,priorPreviewFilesPreserved=len(previews),entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=mora-cards-v53-'+version,
    nativeAssets=native_assets,scope='17 ice cards, +1s skill freeze extension, 3 real ultimate hits sharing old total damage; 7 icon redraws and 1 new full circular painting.',
    manualAcceptance='Static source/assets/type/build/HTTP only. No tests, game, browser, combat simulation or audio; user performs acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['build-record.json','web-release.json']:
    shutil.copy2(web/name,HERE/name)
shutil.copy2(prior_doc/'publish.ps1',HERE/'publish.ps1')
print('Staged:',stage)
print(record['game'])
print('Native generated PNGs checked:',len(native_assets),'| preserved previews:',len(previews))
