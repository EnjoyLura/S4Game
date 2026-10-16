"""Prepare the established build/publication commands; no gameplay validation."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/enemy-death-v1'
OLD_SCOPE = 'directional enemy death, weighted fall, contact dust and elemental silhouette dissolve on simulation clock'
SCOPE = 'in-place enemy material burst and fading ground splatter; remove all whole-body falling'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('kwDeath', 'kwDeathBurst').replace('enemy-death-v1', 'enemy-death-burst-v2')
    content = content.replace('docs/notice-feedback-v1/deployment-stage.json', 'docs/enemy-death-v1/deployment-stage.json')
    content = content.replace(OLD_SCOPE, SCOPE)
    (OUT/name).write_text(content, encoding='utf-8')
integration = {
    'status': 'prepared', 'scope': SCOPE,
    'visualReference': 'user supplied Screenrecording_20261015_190858.mp4; standing burst, fragments, green fading ground residue',
    'rejectedPriorPresentation': 'whole-body fall / rotation / ground settling / corpse hold / long dissolve',
    'wholeBodyRotationOrTravel': False,
    'bodyFragmentsUseActualGameMonsterCel': True,
    'bodyFragmentsPerQuad': 6,
    'bodyBurstSeconds': {'normal': 0.19, 'elite': 0.22, 'bossHook': 0.24},
    'groundResidueSeconds': {'normal': 0.9, 'elite': 1.02, 'bossHook': 1.15},
    'sameCelHandoffNoDoubleImage': True,
    'fallback': 'fixed in-place rapid fade for this death, without late shader handoff',
    'elementalAccents': ['short embers', 'small ice chips', '100ms residual electric arcs'],
    'simulationClock': True, 'cosmeticLimit': 64, 'livingLimit': 60,
    'gameplayRewardsAndAudioChanged': False,
    'gameplayValidation': 'user manual; no tests, game, browser or online acceptance run',
}
(OUT/'integration.json').write_text(json.dumps(integration, ensure_ascii=False, indent=2), encoding='utf-8')
