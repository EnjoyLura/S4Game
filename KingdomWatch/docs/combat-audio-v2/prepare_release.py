"""Prepare the established build/publish workflow; never launch gameplay."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/ui-experience-v1'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR/name).read_text(encoding='utf-8-sig')
    text = text.replace('kwUIExperience', 'kwCombatAudio')
    text = text.replace('audio-playback-fix-v1/deployment-stage.json', 'ui-experience-v1/deployment-stage.json')
    text = text.replace('ui-experience-v1', 'combat-audio-v2')
    # The previous record must remain the actual published UI stage.
    text = text.replace('docs/combat-audio-v2/deployment-stage.json', 'docs/ui-experience-v1/deployment-stage.json')
    text = text.replace('semantic UI audio, procedural tap feedback and interruptible page/modal motion',
                        'five-hero combat sound redesign and density-aware mix; prior UI experience retained')
    text = text.replace("interactionAcceptance = 'pending user manual review'", "audioAcceptance = 'pending user manual listening'")
    (OUT/name).write_text(text, encoding='utf-8')
