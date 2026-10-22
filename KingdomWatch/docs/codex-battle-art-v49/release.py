"""Static source/type/frame review and production packaging; never runs the game."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def read(p): return p.read_text(encoding='utf-8-sig')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE/'before.json'))
changed = sorted(n for n,h in before.items() if sha(ROOT/n) != h)
assert changed == ['assets/scripts/ui/pages/BasePage.ts'], changed
new = [p.relative_to(ROOT).as_posix() for folder in ['assets/scripts','assets/resources','build-templates','tools']
       for p in (ROOT/folder).rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in before]
assert not new, new
norm = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff',''))
after = read(HERE/'types-after.log')
assert norm(read(HERE/'types-before.log')) == norm(after)
mapping = json.loads(read(HERE/'art-mapping.json'))
for mid, row in mapping.items():
    frames = json.loads(read(ROOT/('assets/resources/ux/'+row['atlas']+'.frames.json')))['frames']
    assert frames[row['frame']] == row['rect']
    assert row['frame'] == (mid if mid == 'goblin_king' else mid+'_w0')
source = read(ROOT/'assets/scripts/ui/pages/BasePage.ts')
assert source.count('monsterArt(') == 3
assert "battlePose ? 'battle_mob_anim_v1' : 'battle_mobs_v2'" in source
assert "art.getComponent(Sprite)!.color = CA('#000000', .34)" in source
web = ROOT/'build/web-mobile'
bundle = read(next((web/'assets/main').glob('index.*.js')))
for marker in ['battle_mob_anim_v1','codexSilhouette:','baseCodexDialog','baseCodexDetail',
               'SEVENTH_LEVEL_WAVES','EARLY_FIRST_WIN_GOLD','doubleGoldPlayIcon','普攻伤害倍率','大招伤害倍率']:
    assert marker in bundle, marker
release = json.loads(read(web/'web-release.json'))
prior_doc = ROOT/'docs/seventh-level-balance-v48'
previous = json.loads(read(prior_doc/'web-release.json'))
assert release['production'] and release['engineRevision'] == previous['engineRevision']
engine = read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in engine
prior = Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
target = ROOT/'build'/('publish-codex-battle-art-v49-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web,target,ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews',target/'previews')
files = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in files: assert sha(p) == sha(target/'previews'/p.relative_to(prior/'previews'))
version = re.search(r'\?v=(\d+)',release['entry'])[1]
record = dict(stage=str(target),published=False,project='kingdom-watch',branch='main',entryVersion=version,
              game='https://kingdom-watch.pages.dev/?v=codex-battle-art-v49-'+version,
              originalFilesChecked=len(before),changedExistingFiles=changed,addedFiles=new,
              priorPreviewFilesPreserved=len(files),preExistingTypeErrors=after.count('error TS'),typeDiagnosticsUnchanged=True,
              artMapping=mapping,allOriginalMediaUnchanged=True,
              scope='Codex list/detail/locked silhouettes use the five active battle walk-0 frames; king retains static fallback. No battle art or gameplay changes; rejected replacement concepts not integrated.',
              manualAcceptance='No tests, game, browser, combat simulation or audio playback. User performs visual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record,indent=2),encoding='utf8')
for name in ['build-record.json','web-release.json']: shutil.copy2(web/name,HERE/name)
for name in ['publish.ps1','check-publication.py']: shutil.copy2(prior_doc/name,HERE/name)
print('Staged',target)
print(record['game'])
