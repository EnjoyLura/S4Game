"""Static source/type/resource review and production packaging; no game execution."""
from pathlib import Path
from datetime import datetime
import difflib, hashlib, json, re, shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
expected=sorted('assets/scripts/'+s for s in ['core/GameData.ts','ui/HeroComic.ts','ui/pages/ShopPage.ts'])
changed=sorted(n for n,h in before.items() if sha(ROOT/n)!=h)
assert changed==expected,changed
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log'))==norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS')==10
diff=''.join(''.join(difflib.unified_diff(read(HERE/'before'/n).splitlines(True),read(ROOT/n).splitlines(True),fromfile='before/'+n,tofile='after/'+n)) for n in changed)
(HERE/'review.diff').write_text(diff,encoding='utf-8')
catalog=json.loads(read(HERE/'catalog.json'))
art=json.loads(read(HERE/'art-manifest.json'))['assets']
assert len(art)==16 and catalog['originalNonWeaponEquipmentUnchanged'] and catalog['shopEquipmentCount']==20
assert {a['id'] for a in art}=={d['id'] for d in catalog['added']}
for d in catalog['added']:
 a=next(a for a in art if a['id']==d['id'])
 assert a['path']=='assets/resources/ux/'+d['art']+'.png'
 assert sha(ROOT/a['path'])==sha(Path(a['source']))==a['sha256'] and a['sourceBytesPreserved']
current={p.relative_to(ROOT).as_posix() for folder in ['assets/scripts','assets/resources','build-templates','tools'] for p in (ROOT/folder).rglob('*') if p.is_file()}
added=sorted(current-set(before))
assert added==sorted(n for a in art for n in [a['path'],a['path']+'.meta']),added
game=read(ROOT/'assets/scripts/core/GameData.ts')
oldgame=read(HERE/'before/assets/scripts/core/GameData.ts')
assert game[game.index('export function isEquip'):game.index('/* ================= 商店')]==oldgame[oldgame.index('export function isEquip'):oldgame.index('/* ================= 商店')]
assert game[game.index('/** 关卡顺序表'):]==oldgame[oldgame.index('/** 关卡顺序表'):]
assert "Object.values(EQUIPS).filter(d => d.kind !== 'weapon' && !!d.art)" in game
assert "currency: 'gold' as const" in game
assert sha(ROOT/'assets/scripts/config/Weapons.ts')==sha(HERE/'before/assets/scripts/config/Weapons.ts')
shop=read(ROOT/'assets/scripts/ui/pages/ShopPage.ts')
for marker in ['shopEquipFilter:', 'shopWeaponFilter:', "EQUIPS[s.give.id]?.kind === st.equip", 'd.description || EQUIP_INTRO', "'所有英雄'"]:
 assert marker in shop,marker
oldshop=read(HERE/'before/assets/scripts/ui/pages/ShopPage.ts')
assert shop[shop.index('function openProductDetails'):]==oldshop[oldshop.index('function openProductDetails'):]
web=ROOT/'build/web-mobile'
release=json.loads(read(web/'web-release.json'))
prior_doc=ROOT/'docs/weapon-expansion-v56'
prior_release=json.loads(read(prior_doc/'web-release.json'))
assert release['production'] and release['md5Cache'] and release['entry']!=prior_release['entry']
assert release['engineRevision']==prior_release['engineRevision']
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
bundle=read(next((web/'assets/main').glob('index.*.js')))
for d in catalog['added']:
 assert d['id'] in bundle and d['art'].split('/')[-1] in bundle
for marker in ['shopEquipFilter:', 'shopWeaponFilter:', 'baseDiamonds', 'settlementDiamondNumber', 'moraUltimateHitDamage', 'moraFieldFreeze', 'voltStrikeCount', 'pyroMeteorCount', 'goblin_king_walk_v1']:
 assert marker in bundle,marker
assert re.search(r'\{\s*stats:\s*(?:0)?\.1,\s*combat:\s*3,\s*support:\s*1\s*\}',bundle)
native_assets=[]
for a in art:
 files=list((web/'assets/resources/native').rglob(a['uuid']+'.*.png'))
 assert len(files)==1,(a['id'],files)
 assert sha(files[0])==a['sha256']
 native_assets.append(dict(id=a['id'],path=files[0].relative_to(web).as_posix(),sha256=a['sha256']))
prior=Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
old_native=[p for p in (prior/'assets/resources/native').rglob('*') if p.is_file()]
for p in old_native:
 assert sha(p)==sha(web/p.relative_to(prior)),p.relative_to(prior)
stage=ROOT/'build'/('publish-equipment-expansion-v57-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
previews=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:
 assert sha(p)==sha(stage/'previews'/p.relative_to(prior/'previews'))
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(originalFilesChecked=len(before),changedExistingFiles=changed,addedFiles=added,preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,
 originalNonWeaponEquipmentUnchanged=4,newEquipment=16,totalNonWeaponEquipment=20,totalIncludingWeapons=45,shopEquipment=20,blueNewEquipment=8,purpleNewEquipment=8,
 blue=dict(price=1800,currency='gold',unlock='1-2',tier=1),purple=dict(price=6000,currency='gold',unlock='1-4',tier=1),
 existingWhiteAndGreenUnchanged=True,weaponsV56Unchanged=True,allOriginalMediaUnchanged=True,originalNativeFilesPreserved=len(old_native),priorPreviewFilesPreserved=len(previews),nativeAssets=native_assets,
 sourceNotes='Only GameData equipment definitions/shop catalog, HeroComic shared art map, ShopPage slot filter/details changed. No combat/drop/save/cultivation/economy formula changes.',
 stage=str(stage),published=False,project='kingdom-watch',branch='main',entryVersion=version,game='https://kingdom-watch.pages.dev/?v=equipment-expansion-v57-'+version,
 manualAcceptance='Static source/AST/media/types/build/HTTP only; no tests, game, browser, combat simulation or audio. User manual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['build-record.json','web-release.json']:
 shutil.copy2(web/name,HERE/name)
shutil.copy2(prior_doc/'publish.ps1',HERE/'publish.ps1')
print('Static review complete:',len(before),'original files;',len(changed),'scripts changed; 16 new PNG + 16 metadata; original 10 type diagnostics unchanged.')
print('Original native resources:',len(old_native),'| prior previews:',len(previews))
print('Staged:',stage)
print(record['game'])
