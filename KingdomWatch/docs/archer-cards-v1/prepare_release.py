"""Prepare Cocos/DPR/Pages publication; gameplay acceptance is manual."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/volt-vfx-enhance-v1'
SCOPE = 'archer four-rarity cards, attack tradeoffs, five-stack serial and fan, shared per-hero numeric cards'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('docs/dual-base-damage-v1/deployment-stage.json', '__PRIOR__')
    content = content.replace('kwVoltVfx', 'kwArcherCards').replace('volt-vfx-enhance-v1', 'archer-cards-v1')
    content = content.replace('__PRIOR__', 'docs/volt-vfx-enhance-v1/deployment-stage.json')
    content = content.replace('procedural Volt normal projectile, chain lightning and ultimate thunder effects', SCOPE)
    (OUT/name).write_text(content, encoding='utf-8')
(OUT/'integration.json').write_text(json.dumps({
    'status': 'prepared', 'scope': SCOPE,
    'archerRarities': {
        'white': ['sharp', 'swift'],
        'blue': ['crit_rate', 'crit_dmg', 'serial', 'fan', 'instinct_a'],
        'purple': ['fast_charge_a', 'split', 'explode', 'frost', 'burn', 'explode_r', 'explode_w'],
        'gold': ['archer_unlock_ult', 'archer_unlock_skill', 'rain_rounds'],
    },
    'sharedNumericCards': {'heroes': ['archer', 'sniper', 'pyro', 'volt', 'mora'],
        'attack': '+20%', 'attackSpeed': '+15%', 'critRate': '+15%', 'critDamage': '+30%',
        'independentOwnerAndStacks': True, 'sameArtPerCardType': True,
        'legacyArcherSniperIdsPreserved': True, 'newMageCopies': 12},
    'attackTradeoffCards': ['serial', 'fan', 'split', 'explode', 'frost', 'burn'],
    'attackTradeoffPerAcquisition': 'current attack multiplier * 0.9; only owning hero',
    'serialMaxStacks': 5, 'fanMaxStacks': 5, 'fanStepDegrees': 7,
    'singleAcquisitionMechanics': ['explode', 'frost', 'burn'],
    'singleAcquisitionReason': 'old second stack only reapplied identical state; would now penalize attack with no gain',
    'prerequisitesPreserved': True,
    'rarityRelativeWeights': {'white': .6, 'blue': .3, 'purple': .1, 'gold': .05},
    'offerGroupWeightsPreserved': {'stats': .3, 'combat': 2, 'support': 1},
    'otherHeroExclusiveCardsChanged': False, 'globalCardsChanged': False,
    'damageFormulaChanged': False, 'voltVfxPreserved': True, 'audioChanged': False,
    'gameplayValidation': 'user manual; no tests, simulation, game, browser or online acceptance run',
}, ensure_ascii=False, indent=2), encoding='utf-8')
