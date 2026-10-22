"""Package the production build and preserve historical previews. No runtime or audio playback."""
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

web = ROOT / 'build/web-mobile'
bundle = next((web / 'assets/main').glob('index.*.js')).read_text(encoding='utf8')
for marker in ['meteor_ult', 'offset', 'restart', '70101', 'holdMusicForTransition', 'MUSIC_TRACK_GAIN']:
    if marker not in bundle:
        raise ValueError('Missing compiled audio configuration: ' + marker)
release = json.loads((web / 'web-release.json').read_text(encoding='utf-8-sig'))
if not release['production']:
    raise ValueError('Production build required')
prior = Path(json.loads((ROOT / 'docs/audio-gains-v30/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
target = ROOT / 'build' / ('publish-meteor-impact-v31-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, target, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior / 'previews', target / 'previews')
files = [f for f in (prior / 'previews').rglob('*') if f.is_file()]
for f in files:
    if sha(f) != sha(target / 'previews' / f.relative_to(prior / 'previews')):
        raise ValueError('Historical preview mismatch: ' + str(f))
native = {sha(f): f for f in (web / 'assets/resources/native').rglob('*') if f.is_file()}
resource_config = json.loads(next((web / 'assets/resources').glob('config.*.json')).read_text(encoding='utf8'))
paths = {v[0] for v in resource_config['paths'].values()}
source = ROOT / 'assets/resources/audio/v28/meteor_ult.wav'
uuid = json.loads(Path(str(source) + '.meta').read_text(encoding='utf8'))['uuid']
if 'audio/v28/meteor_ult' not in paths or sha(source) not in native or uuid not in native[sha(source)].name:
    raise ValueError('Meteor production resource mismatch')
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(stage=str(target), entryVersion=version, priorPublishedStage=str(prior),
    project='kingdom-watch', branch='main', published=False,
    game='https://kingdom-watch.pages.dev/?v=meteor-impact-v31-' + version,
    priorPreviewFilesPreserved=len(files), compiledImpactOffsetAndRestartPresent=True,
    originalMeteorResourcePathUUIDAndHashMatch=True,
    meteorNative=native[sha(source)].relative_to(web).as_posix(),
    manualAcceptance='User manual; no game/browser/audio playback performed')
(HERE / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web / name, HERE / name)
print('Release staged', target)
