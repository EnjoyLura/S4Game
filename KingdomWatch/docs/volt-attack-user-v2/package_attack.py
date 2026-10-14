"""Convert the complete user video with the existing idle's scale and foot anchor."""
from pathlib import Path
import json
import runpy
import shutil
import sys

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
RESOURCE = GAME / 'assets/resources/ux/volt_attack_user_v2'
origin = json.loads((ROOT / 'source-origin.json').read_text(encoding='utf-8'))
shutil.copy2(GAME / 'docs/volt-idle-natural-v1/ready-red.png', ROOT / 'ready-red.png')
sys.argv = ['package_frames.py', '--hero', 'volt', '--kind', 'attack',
            '--folder', ROOT.name, '--resource', RESOURCE.name,
            '--idle-reference', 'volt_idle_natural_v1', '--release', '14',
            '--attack-seconds', str(origin['duration']), '--static-accepted', '--full-source-required']
runpy.run_path(str(GAME / 'docs/hero-stance-rebuild-v1/package_frames.py'), run_name='__main__')
for directory in [ROOT, RESOURCE]:
    path = directory / 'attack.frames.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    manifest.update(gameIntegrated=False, previewOnly=True, userProvidedVideo=True)
    manifest['actionPhases'] = [
        {'name': 'prepare', 'sourceFrames': [0, 13]},
        {'name': 'staff-forward-cast', 'sourceFrames': [14, 27]},
        {'name': 'return', 'sourceFrames': [28, 43]},
        {'name': 'settle-to-ready', 'sourceFrames': [44, 55]}]
    manifest['releaseAnnotation'] = 'Frame 14: forearm reaches the compact forward casting pose; no baked-in effects.'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
path = ROOT / 'packaging.json'
record = json.loads(path.read_text(encoding='utf-8'))
record.update(sourceVideoNewlyGenerated=False, userProvidedVideo=True, previewOnly=True,
              gameIntegrated=False, paidTaskSubmitted=False, sourceOrigin='source-origin.json')
path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
path = ROOT / 'art.json'
record = json.loads(path.read_text(encoding='utf-8'))
record.update(imageTool='Existing confirmed mage master copied unchanged; no image generation this turn',
              sourceImage='../volt-idle-natural-v1/ready-red.png', imageRegenerated=False)
path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': 'preview_prepared', 'resource': RESOURCE.name,
                  'frames': origin['frames'], 'gameChanged': False, 'paidTaskSubmitted': False}))
