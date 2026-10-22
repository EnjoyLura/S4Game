"""Static packaging only. Never opens or executes the game/browser."""
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
if changed != ['assets/scripts/Boot.ts']:
    raise ValueError('Unexpected existing source/media changes: ' + str(changed))
baseline = (HERE / 'Boot.before.ts').read_text(encoding='utf8')
current = (ROOT / 'assets/scripts/Boot.ts').read_text(encoding='utf8')
restored = current.replace("import { installRenderDiagnostics } from './core/RenderDiagnostics';\n", '').replace('\n  installRenderDiagnostics();\n', '')
if restored != baseline:
    raise ValueError('Boot changed beyond the opt-in diagnostics hook')
normalize = lambda s: re.sub(r'\(\d+,\d+\)', '(LINE,COL)', s.replace('\ufeff', ''))
if normalize((HERE / 'types-before.log').read_text(encoding='utf8')) != normalize((HERE / 'types-after.log').read_text(encoding='utf8')):
    raise ValueError('Type diagnostics changed')

web = ROOT / 'build/web-mobile'
bundle = next((web / 'assets/main').glob('index.*.js')).read_text(encoding='utf8')
for marker in ['kw-render-diagnostics-v33', 'renderdiag', 'kwRenderDiagnostics', 'drawingBufferPixels', 'textCanvasPixels', 'safeRectRaw', 'estimatedBackingToDisplay']:
    if marker not in bundle:
        raise ValueError('Missing compiled diagnostic marker: ' + marker)
release = json.loads((web / 'web-release.json').read_text(encoding='utf-8-sig'))
if not release['production']:
    raise ValueError('Production build required')
prior = Path(json.loads((ROOT / 'docs/hit-mix-v32/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
target = ROOT / 'build' / ('publish-render-diagnostics-v33-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior / 'previews', target / 'previews')
files = [f for f in (prior / 'previews').rglob('*') if f.is_file()]
for f in files:
    if sha(f) != sha(target / 'previews' / f.relative_to(prior / 'previews')):
        raise ValueError('Historical preview mismatch: ' + str(f))
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), entryVersion=version, priorPublishedStage=str(prior),
    project='kingdom-watch', branch='main', published=False,
    game='https://kingdom-watch.pages.dev/?v=render-diagnostics-v33-' + version,
    diagnostic='https://kingdom-watch.pages.dev/?renderdiag=1&v=render-diagnostics-v33-' + version,
    priorPreviewFilesPreserved=len(files), originalFilesChecked=len(before), changedExistingFiles=changed,
    typeDiagnosticsUnchanged=True, compiledDiagnosticFieldsPresent=True,
    noDprViewportFontSafetyOrAudioOverrides=True,
    manualAcceptance='User manual; no game/browser/audio playback performed')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web / name, HERE / name)
print('Release staged', target)
