"""Static source/build packaging only; no tests or game/browser execution."""
from pathlib import Path
from datetime import datetime
import hashlib,json,re,shutil,difflib
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
changed=sorted(n for n,h in before.items() if sha(ROOT/n)!=h)
expected=sorted('assets/scripts/'+n for n in ['config/LevelDifficulty.ts','core/SaveData.ts',
    'core/ThirdJourney.ts','ui/HUD.ts','ui/LevelLootPreview.ts','ui/pages/LevelsPage.ts'])
if changed!=expected: raise ValueError('Unexpected original file changes: '+str(changed))
new=sorted(str(p.relative_to(ROOT)).replace('\\','/') for d in ['assets/scripts','assets/resources','build-templates','tools']
    for p in (ROOT/d).rglob('*') if p.is_file() and str(p.relative_to(ROOT)).replace('\\','/') not in before)
expected_new=['assets/scripts/config/FourthLevel.ts','assets/scripts/config/FourthLevel.ts.meta']
if new!=expected_new: raise ValueError('Unexpected additions: '+str(new))
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
after=read(HERE/'types-after.log')
if norm(read(HERE/'types-before.log'))!=norm(after): raise ValueError('Type diagnostics changed')
parts=[]
for n in changed:
    parts.extend(difflib.unified_diff(read(HERE/'before'/n).splitlines(True),read(ROOT/n).splitlines(True),
        fromfile='before/'+n,tofile='after/'+n))
(HERE/'review.diff').write_text(''.join(parts),encoding='utf8')
# Keep all of HUD outside the one requested modal byte-equivalent after newline normalization.
hud=read(ROOT/'assets/scripts/ui/HUD.ts'); old=read(HERE/'before/assets/scripts/ui/HUD.ts')
strip=lambda s:s[:s.index('  /** Monster discovery')] if '  /** Monster discovery' in s else s[:s.index('  /** 新怪物介绍弹窗')]
prefix=strip(hud).replace('gcircle, gpanel, label, noticeBtn','dlgPanel, dlgTitle, gcircle, gpanel, label, noticeBtn')
prefix=prefix.replace('comicButton, comicPlate','comicButton').replace("import { detailSkin } from './DetailDialog';\n",'')
suffix=lambda s:s[s.index('  /** 每帧轮询'):]
if prefix!=strip(old) or suffix(hud)!=suffix(old): raise ValueError('HUD changes exceed modal and imports')
save=read(ROOT/'assets/scripts/core/SaveData.ts')
addition='''  // Replace only the recorded v43 first-win gift, keeping its UID, level and worn references.
  // A missing/sold gift is not recreated; unrelated staffs remain untouched.
  const thirdGift = sv.thirdJourney!.rewardClaimed && sv.thirdJourney!.rewardUid
    ? sv.equips.find(e => e.uid === sv.thirdJourney!.rewardUid && e.defId === 'wpn_green_staff') : undefined;
  if (thirdGift) { thirdGift.defId = 'wpn_green_book'; changed = true; }
'''
if save.replace(addition,'')!=read(HERE/'before/assets/scripts/core/SaveData.ts'): raise ValueError('Save migration scope changed')
web=ROOT/'build/web-mobile'; bundle=read(next((web/'assets/main').glob('index.*.js')))
for marker in ['newEnemyCommonPanel','newEnemyContent','third_journey_v1_book','wpn_green_book',
    'thirdJourney','postBowCampTab','entryDone','entrySkipped','campaignStartBattle','doubleGoldPlayIcon',
    'battleDouble','battleReturn','secondJourney','newEnemyPortrait:','burnStatusFlame','kw-render-diagnostics-v35']:
    if marker not in bundle: raise ValueError('Missing compiled marker '+marker)
release=json.loads(read(web/'web-release.json'))
previous=json.loads(read(ROOT/'docs/third-level-balance-v43/web-release.json'))
if not release['production'] or release['engineRevision']!=previous['engineRevision']: raise ValueError('Production/engine mismatch')
engine=read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('DPR getter missing')
prior=Path(json.loads(read(ROOT/'docs/third-level-balance-v43/deployment-stage.json'))['stage'])
target=ROOT/'build'/('publish-fourth-level-balance-v44-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,target,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',target/'previews')
files=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files:
    if sha(p)!=sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Preview changed')
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(stage=str(target),published=False,project='kingdom-watch',branch='main',entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=fourth-level-balance-v44-'+version,
    priorPublishedStage=str(prior),originalFilesChecked=len(before),changedExistingFiles=changed,addedFiles=new,
    priorPreviewFilesPreserved=len(files),typeDiagnosticsUnchanged=True,preExistingTypeErrors=after.count('error TS'),
    allOriginalMediaUnchanged=True,monsterEntryUnchanged=True,
    normalFourthLevel=dict(waves=8,workers=242,slingers=12,riders=8,elites=4,shamans=3,
        staticQueueEndSeconds=244.35,combatTargetMinutes=[4,5],measured=False,
        baseline='Archer/sniper/pyro Lv.3, weapons Lv.2, earned green bow/book; no hard entry gate',
        baseGold=100,materials={'mat_stone':4},teaching=False,freeCharge=False),
    thirdReward=dict(defId='wpn_green_book',migration='Only an existing staff matched by the recorded first-win rewardUid; preserve UID/level/worn references; no replacement if missing',campEquipTutorial=False),
    newEnemyModal='Shared detailSkin paper and title; dimensions/confirmation/portrait unchanged; content inset down 16 to clear title',
    scope='Normal 1-4 crowd balance/rewards; shared discovery modal skin; 1-3 first-win green book and scoped old-gift migration.',
    manualAcceptance='No tests/game/browser/simulation/audio playback. User manual interaction/visual/balance acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,indent=2),encoding='utf8')
for n in ['build-record.json','web-release.json']: shutil.copy2(web/n,HERE/n)
for n in ['publish.ps1','check-publication.py']: shutil.copy2(ROOT/'docs/third-level-balance-v43'/n,HERE/n)
print('Staged',target);print(record['game'])
