"""Static source/type/compiled-bundle review and packaging. Never executes game code."""
from pathlib import Path
from datetime import datetime
import difflib,hashlib,json,re,shutil,sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
changed=[n for n,h in before.items() if sha(ROOT/n)!=h]
assert changed==['assets/scripts/battle/Hero.ts'],changed
current={p.relative_to(ROOT).as_posix() for name in ['assets/scripts','assets/resources','build-templates','tools'] for p in (ROOT/name).rglob('*') if p.is_file()}
assert current==set(before),'Unexpected source/resource additions or removals'
old=read(HERE/'Hero.before.ts');hero=read(ROOT/'assets/scripts/battle/Hero.ts')
bad='    return super.ultShowDuration + Math.max(0, Math.ceil((voltStrikeCount(this.stats) - 15) / 5)) * 1.2;'
good='    // Cocos loose super-getter lowering reads HeroBase.prototype, losing the instance id.\n    return ULT_TIMING.volt.duration + Math.max(0, Math.ceil((voltStrikeCount(this.stats) - 15) / 5)) * 1.2;'
assert old.count(bad)==1 and hero==old.replace(bad,good)
assert 'super.' not in hero
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log'))==norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS')==10
(HERE/'review.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),hero.splitlines(True),fromfile='before/Hero.ts',tofile='after/Hero.ts')),encoding='utf-8')
print('Source review: only VoltHero duration base lookup changed; all other 1963 files unchanged; original 10 type diagnostics unchanged.')
if '--source-only' in sys.argv:sys.exit(0)
web=ROOT/'build/web-mobile';prior_doc=ROOT/'docs/equipment-expansion-v57'
release=json.loads(read(web/'web-release.json'));prior_release=json.loads(read(prior_doc/'web-release.json'))
assert release['production'] and release['md5Cache'] and release['entry']!=prior_release['entry']
assert release['engineRevision']==prior_release['engineRevision']
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
bundle=next((web/'assets/main').glob('index.*.js'));code=read(bundle)
assert '.prototype.ultShowDuration' not in code
fixed=re.findall(r'key:"ultShowDuration",get:function\(\)\{return [A-Za-z_$][\w$]*\.volt\.duration\+1\.2\*Math\.max\(0,Math\.ceil\(\([A-Za-z_$][\w$]*\(this\.stats\)-15\)/5\)\)\}\}',code)
assert len(fixed)==1,'Compiled VoltHero getter must read the volt timing constant directly'
(HERE/'after-bundle-getter.json').write_text(json.dumps(dict(bundle=bundle.relative_to(web).as_posix(),getter=fixed[0],prototypeGetterAbsent=True),indent=2),encoding='utf-8')
for marker in ['voltStrikeCount','voltStrikeTime','volt_strikes','volt_stun','shopEquipFilter:','shopWeaponFilter:','baseDiamonds','moraUltimateHitDamage','pyroMeteorCount','goblin_king_walk_v1']:
 # Cocos minifies function names; their source files are already hash-identical.
 if marker not in ['voltStrikeCount','voltStrikeTime']:assert marker in code,marker
for d in json.loads(read(prior_doc/'catalog.json'))['added']:
 assert d['id'] in code and d['art'].split('/')[-1] in code
prior=Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
original_media=[p for p in (prior/'assets/resources/native').rglob('*') if p.is_file()]
new_media=[p for p in (web/'assets/resources/native').rglob('*') if p.is_file()]
assert {p.relative_to(prior).as_posix() for p in original_media}=={p.relative_to(web).as_posix() for p in new_media}
for p in original_media:assert sha(p)==sha(web/p.relative_to(prior)),str(p)
stage=ROOT/'build'/('publish-volt-ultimate-fix-v58-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
previews=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:assert sha(p)==sha(stage/'previews'/p.relative_to(prior/'previews'))
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(originalFilesChecked=len(before),changedExistingFiles=changed,addedGameFiles=[],preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,
 cause='Cocos loose super accessor lowering emitted HeroBase.prototype.ultShowDuration, so base getter this.id became undefined and ULT_TIMING[undefined].duration threw before lightning queue creation, after charge reset.',
 fix='Read ULT_TIMING.volt.duration directly; the extra-strike extension formula and all cast/queue/damage/charge/stun/audio logic remain byte-identical.',
 compiledPrototypeGetterAbsent=True,allOriginalNativeResourcesPreserved=len(original_media),priorPreviewFilesPreserved=len(previews),
 stage=str(stage),published=False,project='kingdom-watch',branch='main',entryVersion=version,
 game='https://kingdom-watch.pages.dev/?v=volt-ultimate-fix-v58-'+version,
 manualAcceptance='Static source/types/compiled bundle/resources/build/read-only HTTP only; no game/browser/tests/simulation/audio. User manual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['build-record.json','web-release.json']:shutil.copy2(web/name,HERE/name)
shutil.copy2(prior_doc/'publish.ps1',HERE/'publish.ps1')
print('Compiled getter fixed; original native files:',len(original_media),'| previews:',len(previews))
print('Staged:',stage)
print(record['game'])
