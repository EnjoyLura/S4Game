"""Prepare the established Cocos/DPR/Pages workflow for the combined release."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/sniper-cards-v1'
SCOPE = 'violet thunder ultimate, blue sniper ultimate, opaque page handoff and formation close without blank frames'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('docs/archer-cards-v1/deployment-stage.json', '__PRIOR__')
    content = content.replace('kwSniperCards', 'kwUltimateUI').replace('sniper-cards-v1', 'hero-ultimate-ui-v3')
    content = content.replace('__PRIOR__', 'docs/sniper-cards-v1/deployment-stage.json')
    content = content.replace('sniper card rarities, skill range and piercing, 30 percent ultimate vulnerability with overhead red reticle, three generated icons', SCOPE)
    (OUT/name).write_text(content, encoding='utf-8')
(OUT/'integration.json').write_text(json.dumps({
    'status': 'prepared', 'scope': SCOPE,
    'volt': {'renderer': 'VoltUltimateVFX', 'material': 'fx/volt-ultimate-procedural',
             'pool': 12, 'skyLife': .31, 'groundLife': .58, 'fractures': 24,
             'anchor': 'target foot', 'neighborEnergyNormalization': True},
    'sniper': {'renderer': 'SniperUltimateVFX', 'material': 'fx/sniper-ultimate-procedural',
               'flightPool': 12, 'accentPool': 24, 'lockSeconds': .5,
               'wakeMax': 245, 'releaseLife': .32, 'hitLife': .28,
               'aimAndReticle': 'blue', 'overheadVulnerabilityMark': 'blue',
               'cardArtworkRegenerated': False},
    'ui': {'pageFade': False, 'candidateOpacity': 'full; below retained page',
           'nestedReadiness': True, 'waitForDraw': True, 'slidePixels': 8, 'slideSeconds': .16,
           'squadClose': 'refresh destination while opaque; remove only after destination is drawn'},
    'clock': 'battle simulation dt', 'paidMediaGeneration': False,
    'gameplayChanged': False, 'audioChanged': False, 'heroMediaChanged': False,
    'validation': 'user manual; no tests, simulations, game, browser or online acceptance run',
}, ensure_ascii=False, indent=2), encoding='utf-8')
