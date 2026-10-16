"""Prepare established build/deploy commands without running gameplay acceptance."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/enemy-death-burst-v2'
OLD_SCOPE = 'in-place enemy material burst and fading ground splatter; remove all whole-body falling'
SCOPE = 'independent attack and skill damage with role growth; remove green death residue'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('kwDeathBurst', 'kwDualDamage').replace('enemy-death-burst-v2', 'dual-base-damage-v1')
    content = content.replace('docs/enemy-death-v1/deployment-stage.json', 'docs/enemy-death-burst-v2/deployment-stage.json')
    content = content.replace(OLD_SCOPE, SCOPE).replace('deathPresentationAcceptance', 'manualAcceptance')
    (OUT/name).write_text(content, encoding='utf-8')
(OUT/'integration.json').write_text(json.dumps({
    'status': 'prepared', 'scope': SCOPE,
    'baseStats': ['attack', 'skillDamage'],
    'normalDamage': 'attack * normalMultiplier',
    'abilityDamage': 'attack * smallAttackCoefficient + skillDamage * abilityMultiplier',
    'initialSmallAttackCoefficient': 0.2,
    'initialGrowthTypes': {'archer': 'normal', 'sniper': 'normal', 'pyro': 'ultimate', 'volt': 'skill', 'mora': 'hybrid'},
    'baseStatsSharedByBattleAndUI': True,
    'equipmentSkillDamageRemainsFlat': True,
    'skillLevelChangesCoefficientNotBaseSkillDamage': True,
    'greenGroundResidue': False, 'wholeBodyFall': False,
    'gameplayValidation': 'user manual; no tests, simulations, browser, game or online acceptance run',
}, ensure_ascii=False, indent=2), encoding='utf-8')
