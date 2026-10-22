"""Static source/build packaging checks only; never runs gameplay or a browser."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

before = json.loads((HERE / 'before.json').read_text(encoding='utf8'))
changed = sorted(name for name, digest in before.items() if sha(ROOT / name) != digest)
expected = ['assets/scripts/ui/HUD.ts']
if changed != expected:
    raise ValueError('Unexpected existing source/media changes: ' + str(changed))
normalize = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
types_before = normalize((HERE / 'types-before.log').read_text(encoding='utf8'))
types_after = normalize((HERE / 'types-after.log').read_text(encoding='utf8'))
if types_before != types_after:
    raise ValueError('Type diagnostics changed')

# Match all codex enemy IDs to existing atlas rectangles without loading game code.
frames = json.loads((ROOT / 'assets/resources/ux/battle_mobs_v2.frames.json').read_text(encoding='utf8'))['frames']
codex = (ROOT / 'assets/scripts/core/GameData.ts').read_text(encoding='utf8').split('export const CODEX:', 1)[1].split('];', 1)[0]
ids = re.findall(r"id: '([^']+)'", codex)
if len(ids) != 6 or any(enemy not in frames for enemy in ids):
    raise ValueError('Codex portrait frame coverage mismatch')
for enemy in ids:
    x, y, w, h = frames[enemy]
    if w <= 0 or h <= 0 or x < 0 or y < 0 or x+w > 1536 or y+h > 1024:
        raise ValueError('Invalid portrait atlas rectangle: ' + enemy)

web = ROOT / 'build/web-mobile'
bundle = next((web / 'assets/main').glob('index.*.js')).read_text(encoding='utf8')
for marker in ['newEnemyPortrait:', 'newEnemyConfirm', 'firstJourneyFocus', 'first_journey_v1_bow', 'FirstBattleCoach', 'fixedWaves',
               'TutorialSpotlight', 'burnStatusFlame', 'kw-render-diagnostics-v35']:
    if marker not in bundle:
        raise ValueError('Missing compiled marker: ' + marker)
engine = next((web / 'cocos-js').glob('_virtual_cc-*.js')).read_text(encoding='utf8')
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine:
    raise ValueError('Live DPR getter missing')
release = json.loads((web / 'web-release.json').read_text(encoding='utf-8-sig'))
previous = json.loads((ROOT / 'docs/first-level-balance-v37/web-release.json').read_text(encoding='utf-8-sig'))
if not release['production'] or release['engineRevision'] != previous['engineRevision']:
    raise ValueError('Production/engine rendering preservation mismatch')
prior = Path(json.loads((ROOT / 'docs/first-level-balance-v37/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
target = ROOT / 'build' / ('publish-new-enemy-art-v38-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior / 'previews', target / 'previews')
files = [f for f in (prior / 'previews').rglob('*') if f.is_file()]
for f in files:
    if sha(f) != sha(target / 'previews' / f.relative_to(prior / 'previews')):
        raise ValueError('Historical preview mismatch: ' + str(f))
if (web / 'diagnostics.html').read_bytes() != (web / 'index.html').read_bytes():
    raise ValueError('Fixed-path diagnostic HTML mismatch')
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), entryVersion=version, priorPublishedStage=str(prior),
    project='kingdom-watch', branch='main', published=False,
    game='https://kingdom-watch.pages.dev/?v=new-enemy-art-v38-' + version,
    priorPreviewFilesPreserved=len(files), originalFilesChecked=len(before), changedExistingFiles=changed,
    typeDiagnosticsUnchanged=True, preExistingTypeErrors=types_after.count('error TS'),
    allOriginalMediaUnchanged=True, audioAndRenderingUnchanged=True,
    heroWeaponCardDamageFormulasUnchanged=True,
    scope='New-enemy popup uses codex monster atlas frames and the shared comic confirmation button',
    manualAcceptance='User manual; no tests/game/browser/simulation/audio playback performed')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web / name, HERE / name)
for name in ['publish.ps1', 'check-publication.py']:
    shutil.copy2(ROOT / 'docs/first-level-balance-v37' / name, HERE / name)
print('Release staged', target)
print(record['game'])
