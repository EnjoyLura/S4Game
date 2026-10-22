"""Static source/type/media review and production packaging; no gameplay execution."""
from pathlib import Path
from datetime import datetime
import difflib, hashlib, json, re, shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
expected = sorted('assets/scripts/'+s for s in ['config/Weapons.ts','core/GameData.ts','ui/pages/ShopPage.ts'])
changed = sorted(n for n,h in before.items() if sha(ROOT/n) != h)
assert changed == expected, changed
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log')) == norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS') == 10
diff = ''.join(''.join(difflib.unified_diff(read(HERE/'before'/n).splitlines(True),read(ROOT/n).splitlines(True),
    fromfile='before/'+n,tofile='after/'+n)) for n in changed)
(HERE/'review.diff').write_text(diff,encoding='utf-8')
catalog = json.loads(read(HERE/'catalog.json'))
art = json.loads(read(HERE/'art-manifest.json'))['assets']
assert len(art) == 16 and catalog['originalWeaponsUnchanged'] and catalog['shopWeaponCount'] == 21
assert {a['id'] for a in art} == {w['id'] for w in catalog['added']}
for w in catalog['added']:
    a = next(a for a in art if a['id'] == w['id'])
    assert a['path'] == 'assets/resources/ux/'+w['art']+'.png'
    assert sha(ROOT/a['path']) == sha(Path(a['source'])) == a['sha256']
    assert a['sourceBytesPreserved']
current = {p.relative_to(ROOT).as_posix() for folder in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/folder).rglob('*') if p.is_file()}
added = sorted(current-set(before))
expected_added = sorted(n for a in art for n in [a['path'],a['path']+'.meta'])
assert added == expected_added, added
game_data = read(ROOT/'assets/scripts/core/GameData.ts')
assert "Object.values(WEAPONS).filter(w => w.quality >= 2 && w.id !== 'wpn_crossbow')" in game_data
assert "if (!lvReached(g.unlock)) return { ok: false" in game_data
assert game_data[:game_data.index('/* ================= 商店')] == read(HERE/'before/assets/scripts/core/GameData.ts').split('/* ================= 商店')[0]
shop = read(ROOT/'assets/scripts/ui/pages/ShopPage.ts')
for marker in ['shopWeaponFilter:', 'filterH', 'weapon?.description', "WEAPONS[s.give.id]?.type === st.weapon"]:
    assert marker in shop, marker
web = ROOT/'build/web-mobile'
release = json.loads(read(web/'web-release.json'))
prior_doc = ROOT/'docs/clear-currencies-v55'
prior_release = json.loads(read(prior_doc/'web-release.json'))
assert release['production'] and release['md5Cache'] and release['entry'] != prior_release['entry']
assert release['engineRevision'] == prior_release['engineRevision']
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
bundle = read(next((web/'assets/main').glob('index.*.js')))
for w in catalog['added']:
    assert w['id'] in bundle and w['art'].split('/')[-1] in bundle
for marker in ['shopWeaponFilter:', 'baseDiamonds', 'settlementDiamondNumber', 'moraUltimateHitDamage',
               'moraFieldFreeze', 'voltStrikeCount', 'pyroMeteorCount', 'goblin_king_walk_v1']:
    assert marker in bundle, marker
assert re.search(r'\{\s*stats:\s*(?:0)?\.1,\s*combat:\s*3,\s*support:\s*1\s*\}',bundle)
native_assets = []
for a in art:
    files = list((web/'assets/resources/native').rglob(a['uuid']+'.*.png'))
    assert len(files) == 1, (a['id'], files)
    assert sha(files[0]) == a['sha256']
    native_assets.append(dict(id=a['id'],path=files[0].relative_to(web).as_posix(),sha256=a['sha256']))
prior = Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
old_native = [p for p in (prior/'assets/resources/native').rglob('*') if p.is_file()]
for p in old_native:
    assert sha(p) == sha(web/p.relative_to(prior)), p.relative_to(prior)
stage = ROOT/'build'/('publish-weapon-expansion-v56-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
previews = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:
    assert sha(p) == sha(stage/'previews'/p.relative_to(prior/'previews'))
version = re.search(r'\?v=(\d+)',release['entry'])[1]
record = dict(originalFilesChecked=len(before),changedExistingFiles=changed,addedFiles=added,
    preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,originalWeaponsUnchanged=9,newWeapons=16,
    totalWeapons=25,shopWeapons=21,blueNewWeapons=8,purpleNewWeapons=8,
    blue=dict(price=1000,unlock='1-2',tier=1),purple=dict(price=1600,unlock='1-4',tier=2),
    existingWhiteAndGreenUnchanged=True,allOriginalMediaUnchanged=True,originalNativeFilesPreserved=len(old_native),
    priorPreviewFilesPreserved=len(previews),nativeAssets=native_assets,
    sourceNotes='Only Weapons, GameData shop catalog/unlock guard, ShopPage filter/details changed. No combat, drops, levels, hero growth, save schema, currencies, card weights, old assets or audio changes.',
    stage=str(stage),published=False,project='kingdom-watch',branch='main',entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=weapon-expansion-v56-'+version,
    manualAcceptance='Static source/AST/media/types/build/HTTP only; no tests, game, browser, combat simulation or audio. User manual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['build-record.json','web-release.json']:
    shutil.copy2(web/name,HERE/name)
shutil.copy2(prior_doc/'publish.ps1',HERE/'publish.ps1')
print('Reviewed: 1900 original files, 3 changed scripts, 16 new PNGs + 16 metadata, no new type diagnostics.')
print('Original native files preserved:',len(old_native),'| previews:',len(previews))
print('Staged:',stage)
print(record['game'])
