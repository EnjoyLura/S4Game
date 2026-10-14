from pathlib import Path
import json, shutil

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parent.parent
MEDIA=GAME/'docs/sniper-attack-clean-v1'
RESOURCE=GAME/'assets/resources/ux/sniper_attack_clean_v1'
for folder in [MEDIA,RESOURCE]:
    path=folder/'attack.frames.json'
    record=json.loads(path.read_text(encoding='utf-8'))
    record.update(gameIntegrated=True,selectedForGameByUser=True,gameVisualAcceptedByUser=False)
    path.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ['packaging.json','processing.json']:
    path=MEDIA/name
    record=json.loads(path.read_text(encoding='utf-8'))
    record.update(gameIntegrated=True,previewOnly=False,selectedForGameByUser=True,gameVisualAcceptedByUser=False)
    path.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
origin=GAME/'docs/sniper-attack-user-v1/source-origin.json'
record=json.loads(origin.read_text(encoding='utf-8'))
record.update(integrated=True,selectedForGameByUser=True,gameVisualAcceptedByUser=False)
origin.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
build=(GAME/'docs/hero-attack-natural-v1/build_game.ps1').read_text(encoding='utf-8')
build=build.replace('hero-attack-natural-v1','sniper-attack-clean-live-v1')
build=build.replace('node docs/sniper-attack-clean-live-v1/build_preview.cjs','node docs/sniper-attack-clean-live-v1/build_preview.cjs')
(ROOT/'build_game.ps1').write_text(build,encoding='utf-8')
release={'status':'integrated_pending_build','resource':'sniper_attack_clean_v1','replaced':'sniper_attack_natural_v1',
    'sourceFrames':56,'displayHeight':153,'readyHeightPx':467.1111,'groundAnchor':[256,496],
    'motionAcceptedByUser':True,'selectedForGameByUser':True,'gameVisualAcceptedByUser':False,
    'idlePreserved':'sniper_idle_natural_v2','retainedHeroes':['archer','volt'],
    'timing':'Actual bolt callback begins release frame 7; preparation plays frames 0-6 before the shot; all forward recovery frames 7-55 retained and adapted to attack interval',
    'idleRule':'Only when no target is in own attack range, no queued shot, and release/recovery has completed',
    'damageAndAttackRateChanged':False,'review':'User manual review; no tests, game, browser or online QA'}
(ROOT/'integration.json').write_text(json.dumps(release,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'resource':release['resource'],'idle':release['idlePreserved'],'frames':56}))
