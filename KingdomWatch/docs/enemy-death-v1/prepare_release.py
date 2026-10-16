"""Prepare the established Cocos and Pages commands, plus new asset metadata."""
from pathlib import Path
import json
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/notice-feedback-v1'
SCOPE = 'directional enemy death, weighted fall, contact dust and elemental silhouette dissolve on simulation clock'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('kwNotice', 'kwDeath').replace('notice-feedback-v1', 'enemy-death-v1')
    content = content.replace('docs/shop-product-details-v1/deployment-stage.json', 'docs/notice-feedback-v1/deployment-stage.json')
    content = content.replace('typed non-blocking notifications and growth feedback with actual values, merge behavior and semantic audio', SCOPE)
    content = content.replace('layoutChanged = $true', 'layoutChanged = $false')
    content = content.replace('interactionAcceptance', 'deathPresentationAcceptance')
    (OUT/name).write_text(content, encoding='utf-8')
for path, importer, version, files in [
    ('assets/scripts/battle/MonsterDeath.ts', 'typescript', '4.0.24', []),
    ('assets/resources/fx/mob-death.effect', 'effect', '1.7.1', ['.json']),
]:
    target = GAME/(path+'.meta')
    if not target.exists():
        target.write_text(json.dumps(dict(ver=version, importer=importer, imported=True,
            uuid=str(uuid.uuid4()), files=files, subMetas={}, userData={}), indent=2), encoding='utf-8')
integration = {
    'status': 'prepared', 'scope': SCOPE,
    'presentation': ['exact struck whole cel', 'ground pivot', 'bounded directional impulse',
        'weighted fall', 'contact shadow and dust', 'silhouette dissolve', 'fully transparent tail'],
    'elements': ['physical', 'fire and burn', 'frost and frozen', 'volt'],
    'newDeathAnimationClipsGenerated': False,
    'cosmeticCorpseLimit': 64, 'livingEnemyLimit': 60,
    'corpsesExcludedFrom': ['targeting', 'collisions', 'separation', 'alive count', 'wave clear'],
    'simulationClock': True, 'pausedAndCardPickFreeze': True, 'settlementTailOnly': True,
    'pooledActorsAndMaterials': True, 'sceneCleanupIncludesDetachedPool': True,
    'rewardDamageAndChargeRulesChanged': False,
    'audio': 'existing licensed fatal-hit and kill cues; existing heavy hit-stop rules',
    'gameplayValidation': 'user manual; no tests, game, browser or online acceptance run',
}
(OUT/'integration.json').write_text(json.dumps(integration, ensure_ascii=False, indent=2), encoding='utf-8')
