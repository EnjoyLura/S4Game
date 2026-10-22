"""Static source and production packaging checks; never executes the game."""
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
changed = [name for name, digest in before.items() if sha(ROOT / name) != digest]
expected = ['assets/scripts/battle/FireVFX.ts', 'assets/scripts/battle/ImpactFX.ts',
            'assets/scripts/battle/BattleDirector.ts']
if sorted(changed) != sorted(expected):
    raise ValueError('Unexpected existing source/media changes: ' + str(changed))
normalize = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
if normalize((HERE / 'types-before.log').read_text(encoding='utf8')) != normalize((HERE / 'types-after.log').read_text(encoding='utf8')):
    raise ValueError('Type diagnostics changed')

# Existing hit animations and gameplay remain byte-for-byte equivalent after
# removing this release's visual-only additions from the source text.
director = (ROOT / expected[2]).read_text(encoding='utf8')
director = director.replace('      this.impacts.syncBurns(this.mgr.list, sub);\n', '', 1)
if director != (HERE / 'BattleDirector.before.ts').read_text(encoding='utf8'):
    raise ValueError('Unexpected battle-loop change')
impact = (ROOT / expected[1]).read_text(encoding='utf8')
impact = impact.replace('{ BurningTarget, FireVFX }', '{ FireVFX }', 1)
impact = impact.replace('  syncBurns(targets: readonly BurningTarget[], dt: number): void { this.fire.syncBurns(targets, dt); }\n\n', '', 1)
if impact != (HERE / 'ImpactFX.before.ts').read_text(encoding='utf8'):
    raise ValueError('Unexpected impact routing change')
fire = (ROOT / expected[0]).read_text(encoding='utf8')
fire = re.sub(r'/\*\* Read-only status view:.*?export interface BurningTarget[^\n]*\n', '', fire, count=1, flags=re.S)
fire = re.sub(r'const PYRO_CLIP_LIFE[^\n]*\n', '', fire, count=1)
fire = fire.replace('  private burning = new Map<BurningTarget, Clip>();\n  private burnFree: Clip[] = [];\n', '', 1)
fire = fire.replace('      this.burning.clear(); this.burnFree.length = 0;\n', '', 1)
fire = re.sub(r'  /\*\* One existing small flame per living burned enemy,.*?\n  blast\(', '  blast(', fire, count=1, flags=re.S)
if fire != (HERE / 'FireVFX.before.ts').read_text(encoding='utf8'):
    raise ValueError('Unexpected existing fire animation change')

web = ROOT / 'build/web-mobile'
bundle = next((web / 'assets/main').glob('index.*.js')).read_text(encoding='utf8')
for marker in ['burnStatusFlame', 'syncBurns', 'fx/pyro_hit.frames', 'kw-render-diagnostics-v35']:
    if marker not in bundle:
        raise ValueError('Missing compiled marker: ' + marker)
engine = next((web / 'cocos-js').glob('_virtual_cc-*.js')).read_text(encoding='utf8')
if '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' not in engine:
    raise ValueError('Live DPR getter missing')
release = json.loads((web / 'web-release.json').read_text(encoding='utf-8-sig'))
previous = json.loads((ROOT / 'docs/native-render-v35/web-release.json').read_text(encoding='utf-8-sig'))
if not release['production'] or release['engineRevision'] != previous['engineRevision']:
    raise ValueError('Production/engine rendering preservation mismatch')
prior = Path(json.loads((ROOT / 'docs/native-render-v35/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
target = ROOT / 'build' / ('publish-burn-status-v36-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
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
    game='https://kingdom-watch.pages.dev/?v=burn-status-v36-' + version,
    priorPreviewFilesPreserved=len(files), originalFilesChecked=len(before), changedExistingFiles=changed,
    typeDiagnosticsUnchanged=True, previousFireAnimationsUnchanged=True,
    audioGameplayAndRenderingUnchanged=True, allOriginalMediaUnchanged=True,
    statusVisual='One pooled existing pyro_hit flame attached per living enemy with burnT > 0',
    manualAcceptance='User manual; no tests/game/browser/simulation/audio playback performed')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web / name, HERE / name)
shutil.copy2(ROOT / 'docs/native-render-v35/publish.ps1', HERE / 'publish.ps1')
print('Release staged', target)
print(record['game'])
