"""Prepare the established Cocos build and Pages publication commands."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/card-offer-weights-v1'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR / name).read_text(encoding='utf-8-sig')
    text = text.replace('kwCardOffer', 'kwUnequip').replace('card-offer-weights-v1', 'equipment-unequip-v1')
    text = text.replace('docs/skill-milestone-swipe-v1/deployment-stage.json', 'docs/card-offer-weights-v1/deployment-stage.json')
    text = text.replace('upgrade offers: generic stat weight x0.3; normal attack, skill and ultimate weight x2',
                        'equipped-item dialogs: unequip action with inventory, slot and hero-stat refresh')
    if name == 'publish.ps1':
        text = text.replace('layoutChanged = $false', 'layoutChanged = $true')
    (OUT / name).write_text(text, encoding='utf-8')
