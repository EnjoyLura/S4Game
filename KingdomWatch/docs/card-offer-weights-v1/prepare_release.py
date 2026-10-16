"""Prepare the established Cocos build and Pages publication commands."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/skill-milestone-swipe-v1'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR / name).read_text(encoding='utf-8-sig')
    text = text.replace('kwSkillSwipe', 'kwCardOffer').replace('skill-milestone-swipe-v1', 'card-offer-weights-v1')
    text = text.replace('docs/page-switch-no-flash-v1/deployment-stage.json', 'docs/skill-milestone-swipe-v1/deployment-stage.json')
    text = text.replace('skill breakthrough cards: horizontal drag, snap, edge resistance and vertical-scroll handoff',
                        'upgrade offers: generic stat weight x0.3; normal attack, skill and ultimate weight x2')
    (OUT / name).write_text(text, encoding='utf-8')
