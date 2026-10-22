"""Static source/build packaging only; no tests or game/browser execution."""
from pathlib import Path
from datetime import datetime
import hashlib,json,re,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before=json.loads(read(HERE/'before.json'))
changed=sorted(n for n,h in before.items() if sha(ROOT/n)!=h)
expected=sorted('assets/scripts/'+n for n in ['battle/Monster.ts','core/SaveData.ts','core/SecondJourney.ts',
    'ui/MainUI.ts','ui/TrainingLobby.ts','ui/pages/HeroPage.ts','ui/pages/LevelsPage.ts'])
if changed!=expected: raise ValueError('Unexpected original file changes: '+str(changed))
norm=lambda s:re.sub(r'\(\d+,\d+\)','(LINE,COL)',s.replace('\ufeff',''))
after=read(HERE/'types-after.log')
if norm(read(HERE/'types-before.log'))!=norm(after): raise ValueError('Type diagnostics changed')
monster=read(ROOT/'assets/scripts/battle/Monster.ts')
old=read(HERE/'Monster.before.ts.txt')
restored=monster.replace('import { LINE_Y, LO, PAL }','import { LINE_Y, PAL, SPAWN_Y }')
addition='''/** Put the entire silhouette just below the top HUD, including the art's foot offset.
 * Keep the shared offscreen SPAWN_Y unchanged: ultimates use it as their launch height. */
function mobEntryY(radius: number): number {
  return LO.half - LO.notchTop - 124 - radius * (MOB_ART_HEIGHT - .82);
}
'''
restored=restored.replace(addition,'').replace('mobEntryY(def.radius) - Math.random() * 24','SPAWN_Y + 40 + Math.random() * 60').replace('Math.min(mobEntryY(m.def.radius), p.y + dy)','Math.min(SPAWN_Y, p.y + dy)')
if restored!=old: raise ValueError('Monster changes exceed spawn placement and separation ceiling')
web=ROOT/'build/web-mobile'
bundle=read(next((web/'assets/main').glob('index.*.js')))
for marker in ['postBowCampTab','entryDone','entrySkipped','campaignStartBattle',
    'doubleGoldPlayIcon','battleDouble','battleReturn','secondJourney','newEnemyPortrait:',
    'burnStatusFlame','kw-render-diagnostics-v35']:
    if marker not in bundle: raise ValueError('Missing compiled marker '+marker)
release=json.loads(read(web/'web-release.json'))
previous=json.loads(read(ROOT/'docs/gold-play-icon-v41/web-release.json'))
if not release['production'] or release['engineRevision']!=previous['engineRevision']: raise ValueError('Production/engine mismatch')
engine=read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine: raise ValueError('DPR getter missing')
prior=Path(json.loads(read(ROOT/'docs/gold-play-icon-v41/deployment-stage.json'))['stage'])
target=ROOT/'build'/('publish-post-bow-guide-v42-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,target,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',target/'previews')
files=[p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files:
    if sha(p)!=sha(target/'previews'/p.relative_to(prior/'previews')): raise ValueError('Preview changed')
version=re.search(r'\?v=(\d+)',release['entry'])[1]
record=dict(stage=str(target),published=False,project='kingdom-watch',branch='main',entryVersion=version,
    game='https://kingdom-watch.pages.dev/?v=post-bow-guide-v42-'+version,
    priorPublishedStage=str(prior),originalFilesChecked=len(before),changedExistingFiles=changed,
    priorPreviewFilesPreserved=len(files),typeDiagnosticsUnchanged=True,preExistingTypeErrors=after.count('error TS'),
    allOriginalMediaUnchanged=True,waveCountsAndCombatStatsUnchanged=True,ultimateLaunchHeightsUnchanged=True,
    scope='Earned bow -> archer upgrade -> normal 1-2 start spotlight; visible monster entry below top HUD.',
    manualAcceptance='No tests/game/browser/simulation/audio playback. User manual interaction/visual/balance acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,indent=2),encoding='utf8')
for n in ['build-record.json','web-release.json']: shutil.copy2(web/n,HERE/n)
for n in ['publish.ps1','check-publication.py']: shutil.copy2(ROOT/'docs/gold-play-icon-v41'/n,HERE/n)
print('Staged',target);print(record['game'])
