"""Static source/type/hash review and production packaging; never executes game code."""
from pathlib import Path
from datetime import datetime
import difflib,hashlib,json,re,shutil

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
changed=sorted(n for n,h in before.items() if sha(ROOT/n)!=h)
assert changed==['assets/scripts/config/Cards.ts'],changed
old=read(HERE/'before/assets/scripts/config/Cards.ts')
new=read(ROOT/'assets/scripts/config/Cards.ts')
oldpart='/** Multiplies rarity weight, not an absolute offer probability. */\nconst OFFER_GROUP_WEIGHT: Record<OfferGroup, number> = { stats: 0.3, combat: 2, support: 1 };'
newpart='/** 普攻机制/技能/大招卡优先；同品质单卡权重是通用数值卡的30倍，并非固定出现概率。 */\nconst OFFER_GROUP_WEIGHT: Record<OfferGroup, number> = { stats: 0.1, combat: 3, support: 1 };'
assert old.count(oldpart)==1 and old.replace(oldpart,newpart)==new
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
assert norm(read(HERE/'types-before.log'))==norm(read(HERE/'types-after.log'))
assert read(HERE/'types-after.log').count('error TS')==10
diff=''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='before/Cards.ts',tofile='after/Cards.ts'))
(HERE/'review.diff').write_text(diff,encoding='utf-8')
current={p.relative_to(ROOT).as_posix() for folder in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/folder).rglob('*') if p.is_file()}
assert current==set(before),'No new game files expected'
web=ROOT/'build/web-mobile'
release=json.loads(read(web/'web-release.json'))
prior_doc=ROOT/'docs/mora-cards-v53'
prior_release=json.loads(read(prior_doc/'web-release.json'))
assert release['production'] and release['md5Cache']
assert release['entry']!=prior_release['entry']
assert release['engineRevision']==prior_release['engineRevision']
engine=read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in engine
bundle=read(next((web/'assets/main').glob('index.*.js')))
assert re.search(r'\{\s*stats:\s*(?:0)?\.1,\s*combat:\s*3,\s*support:\s*1\s*\}',bundle)
for marker in ['moraUltimateHitDamage','moraFieldFreeze','voltStrikeCount','pyroMeteorCount',
               '冰封延长','ui_card_mora_freeze_linger_v1','goblin_king_walk_v1']:
    assert marker in bundle,marker
prior=Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
# This change touches no resources: retain every deployed resource byte exactly.
resource_files=[p for p in (prior/'assets/resources').rglob('*') if p.is_file()]
for p in resource_files:
    assert sha(p)==sha(web/p.relative_to(prior)),p.relative_to(prior)
stage=ROOT/'build'/('publish-card-offer-weights-v54-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,stage,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',stage/'previews')
previews=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:
    assert sha(p)==sha(stage/'previews'/p.relative_to(prior/'previews'))
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(originalFilesChecked=len(before),changedExistingFiles=changed,addedFiles=[],
    preExistingTypeErrors=10,typeDiagnosticsUnchanged=True,allCardDefinitionsAndEffectsUnchanged=True,
    allOriginalMediaUnchanged=True,productionResourceFilesUnchanged=len(resource_files),
    previousGroupWeights=dict(stats=.3,combat=2,support=1),
    groupWeights=dict(stats=.1,combat=3,support=1),sameRarityCombatToStatsRatio=30,
    rarityWeights=dict(white=.6,blue=.3,purple=.1,gold=.05),
    sourceReview='Only OFFER_GROUP_WEIGHT and its comment changed; pool, ownership, unlocks, caps, lessons, effects and weighted unique sampling remain identical.',
    experienceAnswer='Settlement XP is an earned-in-battle summary used for run-level card picks, not persistent currency. Hero upgrades consume gold. No XP changes made.',
    stage=str(stage),published=False,project='kingdom-watch',branch='main',
    priorPreviewFilesPreserved=len(previews),entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=card-offer-weights-v54-'+version,
    manualAcceptance='Static source/assets/type/build/HTTP only; no tests, game, browser, combat simulation or audio. User manual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['build-record.json','web-release.json']:
    shutil.copy2(web/name,HERE/name)
shutil.copy2(prior_doc/'publish.ps1',HERE/'publish.ps1')
print('Static review: only card type weights changed; 1900 original files reviewed; 10 prior type diagnostics unchanged.')
print('Production resources preserved:',len(resource_files),'| historical preview files:',len(previews))
print('Staged:',stage)
print(record['game'])
