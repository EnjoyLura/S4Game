from pathlib import Path
import argparse, json

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--sniper-release', type=int, required=True)
ap.add_argument('--volt-release', type=int, required=True)
args = ap.parse_args()
production = {}
for hero, release in [('sniper',args.sniper_release),('volt',args.volt_release)]:
    folder = GAME / 'docs' / f'{hero}-attack-natural-v1'
    report = json.loads((folder / 'packaging.json').read_text(encoding='utf-8'))
    report.update(gameIntegrated=True, releaseFrame=release,
                  playback='Complete forward source and natural recovery; no reverse or effect-frame omissions')
    (folder / 'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    production[hero] = {**report, 'folder':folder.name,
        'videoTask':json.loads((folder / 'video-task.json').read_text(encoding='utf-8')),
        'sourceInfo':json.loads((folder / 'source-info.json').read_text(encoding='utf-8'))}
(ROOT / 'production.json').write_text(json.dumps(production,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({hero:{'frames':p['uniqueFrames'],'height':p['displayHeight'],'seconds':p['seconds'],'release':p['releaseFrame']} for hero,p in production.items()}))
