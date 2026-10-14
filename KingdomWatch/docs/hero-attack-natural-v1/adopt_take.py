"""Promote a complete production take; retain all earlier requests and source videos."""
from pathlib import Path
import argparse, json, shutil

ROOT = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument('--hero', choices=['sniper','volt'], required=True)
ap.add_argument('--take', required=True)
args = ap.parse_args()
folder = ROOT.parent / f'{args.hero}-attack-natural-v1'
source = folder / 'takes' / args.take
for file in ['source.mp4','video-task.json','attack-prompt.txt']:
    shutil.copyfile(source / file, folder / file)
task=json.loads((folder/'video-task.json').read_text(encoding='utf-8'))
host=json.loads((folder/'first-frame-host.json').read_text(encoding='utf-8'))
host.update(imageUrl=task['imageUrl'],deployment=task['imageUrl'].rsplit('/',1)[0],
            returnPoseReference=task.get('returnPoseImageReference'))
(folder/'first-frame-host.json').write_text(json.dumps(host,indent=2),encoding='utf-8')
record={'take':args.take,'sourceFolder':str(source),'fullSourceRequired':True,'reversePlayback':False,
        'effectsHandling':'Whole source regenerated, no effect removal/trim/reversed recovery',
        'sourceAnnotationOnly':True,'animationAcceptedByUser':False}
(folder/'source-selection.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps(record))
