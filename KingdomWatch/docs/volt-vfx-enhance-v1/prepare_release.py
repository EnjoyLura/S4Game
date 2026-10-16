"""Prepare the established Cocos/DPR/Pages release, without gameplay acceptance."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/dual-base-damage-v1'
SCOPE = 'procedural Volt normal projectile, chain lightning and ultimate thunder effects'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('docs/enemy-death-burst-v2/deployment-stage.json', '__PRIOR__')
    content = content.replace('kwDualDamage', 'kwVoltVfx').replace('dual-base-damage-v1', 'volt-vfx-enhance-v1')
    content = content.replace('__PRIOR__', 'docs/dual-base-damage-v1/deployment-stage.json')
    content = content.replace('independent attack and skill damage with role growth; remove green death residue', SCOPE)
    (OUT/name).write_text(content, encoding='utf-8')
(OUT/'integration.json').write_text(json.dumps({
    'status': 'prepared', 'scope': SCOPE,
    'normal': 'directional discharge, distance-grown 166px tapered ion wake, jagged hot core, side arcs, localized hit forks',
    'skill': 'four-band jagged chain with attached branches, per-link after-pulses and caster release',
    'ultimate': 'branched sky columns, two cosmetic re-illuminations, target-local contact flare and broken elliptical ground arcs',
    'renderer': 'three shared Graphics layers; 96 pooled events, 24 capacity reserved from crowd hit contacts; deterministic cosmetic noise',
    'clock': 'battle simulation dt; pause, speed and hit-stop follow BattleDirector',
    'damageFormulasChanged': False, 'attackSpeedChanged': False, 'targetingChanged': False,
    'chainDamageRemainsInstantaneous': True, 'ultimateStrikeCount': 15,
    'ultimateStrikeCadenceChanged': False, 'heroMediaChanged': False,
    'otherHeroesChanged': False, 'audioChanged': False, 'greenDeathResidue': False,
    'newGeneratedImagesOrVideos': False,
    'gameplayValidation': 'user manual; no tests, simulations, browser, game or online acceptance run',
}, ensure_ascii=False, indent=2), encoding='utf-8')
