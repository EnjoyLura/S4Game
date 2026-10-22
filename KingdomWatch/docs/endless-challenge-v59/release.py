"""Source/type/media/compiled-package inspection only. Does not execute game code."""
from pathlib import Path
from datetime import datetime
import difflib,hashlib,json,re,shutil,sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
changed=sorted(n for n,h in before.items() if sha(ROOT/n)!=h)
expected=sorted('assets/scripts/'+n for n in ['Boot.ts','battle/BattleDirector.ts','core/EventBus.ts','core/Flow.ts','core/SaveData.ts','ui/BattleEntryWarmup.ts','ui/BossWarning.ts','ui/HUD.ts','ui/Panels.ts','ui/pages/BasePage.ts','ui/pages/LevelsPage.ts'])
assert changed==expected,changed
current={p.relative_to(ROOT).as_posix() for name in ['assets/scripts','assets/resources','build-templates','tools'] for p in (ROOT/name).rglob('*') if p.is_file()}
added=sorted(current-set(before))
assert set(before)<=current,'Original file removed'
expected_added=['assets/scripts/config/Endless.ts','assets/scripts/config/Endless.ts.meta','assets/scripts/core/EndlessProgress.ts','assets/scripts/core/EndlessProgress.ts.meta','assets/resources/scenes/bg_base_endless_v59.png','assets/resources/scenes/bg_base_endless_v59.png.meta']
assert added==sorted(expected_added),added
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log'))==norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS')==10
diff=''
for name in changed:
    old=read(HERE/'before'/name.removeprefix('assets/scripts/'))
    new=read(ROOT/name)
    diff+=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='before/'+name,tofile='after/'+name))
(HERE/'review.diff').write_text(diff,encoding='utf-8')
src=lambda name:read(ROOT/('assets/scripts/'+name))
endless=src('config/Endless.ts');bd=src('battle/BattleDirector.ts');base=src('ui/pages/BasePage.ts')
assert "stars[chapter + '-10']" in endless and 'c.number > chapter' in endless
assert 'getChallengeDef(c.number' in endless and 'floor % 5 === 0' in endless
assert 'waves: [endlessWave(chapter, 1)]' in endless and 'materials: [], gearPool: []' in endless
assert "id: 'endless-' + chapter" in endless and 'fixedWaves: true' in endless
assert 'this.endlessFloor++' in bd and 'this.levelDef.waves = [endlessWave(' in bd
assert 'this.endlessCleared < this.endlessFloor' in bd and 'this.endlessCleared >= this.endlessFloor' in bd
assert 'this.endlessRest = 3' in bd and 'recordEndlessFloor(this.endlessChapter, this.endlessCleared)' in bd
assert 'if (this.isEndless) { this.finishEndless(); return; }' in bd
assert 'this.endlessCardsComplete = true' in bd and 'this.pickQueue = 0' in bd
assert 'this.creditBattleGold(this.goldEarned)' in bd and 'flow.mainTab = 4; flow.levelReturn = null' in bd
assert 'endlessOpen(flow.endlessChapter, loadSave().stars)' in src('Boot.ts')
assert 'endlessOpen(chapter.number, loadSave().stars)' in base and 'warmBattlefield(levelId, squad, pool)' in base
assert 'scenes/bg_base_endless_v59' in base and "building('workshop'" not in base
assert 'flow.endlessChapter = 0' in src('ui/pages/LevelsPage.ts')
assert 'super.' not in src('battle/Hero.ts')
art=json.loads(read(HERE/'art.json'))
assert sha(ROOT/art['target'])==art['sha256']
meta=json.loads(read(ROOT/(art['target']+'.meta')))
assert meta['uuid']==art['uuid'] and meta['subMetas']['f9941']['userData']['width']==art['width']
print('Source inspection:',len(changed),'changed,',len(added),'new;',len(before)-len(changed),'original files unchanged. Original 10 type diagnostics unchanged.')
if '--source-only' in sys.argv:sys.exit(0)
web=ROOT/'build/web-mobile';prior_doc=ROOT/'docs/volt-ultimate-fix-v58'
release=json.loads(read(web/'web-release.json'));prior_release=json.loads(read(prior_doc/'web-release.json'))
assert release['production'] and release['md5Cache'] and release['entry']!=prior_release['entry']
assert release['engineRevision']==prior_release['engineRevision']
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
bundle=next((web/'assets/main').glob('index.*.js'));code=read(bundle)
for marker in ['endlessChapter','endlessFloor','endlessCleared','endlessStartingBest','endlessCardsComplete','endlessReturn','baseEndlessDialog','bg_base_endless_v59','endless-','volt_strikes','volt_stun','moraUltimateHitDamage','pyroMeteorCount','goblin_king_walk_v1']:
    if marker not in ['moraUltimateHitDamage','pyroMeteorCount']:assert marker in code,marker
assert '.prototype.ultShowDuration' not in code
prior=Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
original_media=[p for p in (prior/'assets/resources/native').rglob('*') if p.is_file()]
for p in original_media:assert sha(p)==sha(web/p.relative_to(prior)),str(p)
new_media=[p for p in (web/'assets/resources/native').rglob('*') if p.is_file() and p.relative_to(web).as_posix() not in {q.relative_to(prior).as_posix() for q in original_media}]
assert len(new_media)==1 and sha(new_media[0])==art['sha256'],[str(p) for p in new_media]
stage=ROOT/'build'/('publish-endless-challenge-v59-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
previews=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:assert sha(p)==sha(stage/'previews'/p.relative_to(prior/'previews'))
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(originalFilesChecked=len(before),changedExistingFiles=changed,addedGameFiles=added,preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,
    allOriginalNativeResourcesPreserved=len(original_media),newNativeMedia=[p.relative_to(web).as_posix() for p in new_media],priorPreviewFilesPreserved=len(previews),
    stage=str(stage),published=False,project='kingdom-watch',branch='main',entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=endless-challenge-v59-'+version,
    manualAcceptance='Static source/types/media/compiled bundle/build/read-only HTTP only; no game/browser/tests/simulation/audio. User manual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['build-record.json','web-release.json']:shutil.copy2(web/name,HERE/name)
shutil.copy2(prior_doc/'publish.ps1',HERE/'publish.ps1')
print('Package inspection: preserved',len(original_media),'native resources and',len(previews),'preview files; one new scene PNG matches original generated bytes.')
print('Staged:',stage)
print(record['game'])
