"""Prepare established Cocos/Pages commands and publication receipts."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/combat-audio-v2'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR/name).read_text(encoding='utf-8-sig')
    text = text.replace('kwCombatAudio', 'kwTapSpring').replace('combat-audio-v2', 'tap-spring-v2')
    text = text.replace('docs/ui-experience-v1/deployment-stage.json', 'docs/combat-audio-v2/deployment-stage.json')
    text = text.replace('five-hero combat sound redesign and density-aware mix; prior UI experience retained',
                        'whole-game tap feedback and elastic buttons without whitening')
    text = text.replace("audioAcceptance = 'pending user manual listening'", "interactionAcceptance = 'pending user manual review'")
    (OUT/name).write_text(text, encoding='utf-8')
