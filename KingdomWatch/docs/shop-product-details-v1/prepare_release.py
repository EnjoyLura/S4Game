"""Prepare the established Cocos build and Pages publication commands."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/equipment-unequip-v1'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR / name).read_text(encoding='utf-8-sig')
    text = text.replace('kwUnequip', 'kwShopDetails').replace('equipment-unequip-v1', 'shop-product-details-v1')
    text = text.replace('docs/card-offer-weights-v1/deployment-stage.json', 'docs/equipment-unequip-v1/deployment-stage.json')
    text = text.replace('equipped-item dialogs: unequip action with inventory, slot and hero-stat refresh',
                        'shop product icons open typed details with attributes, descriptions, quantities and purchase state')
    (OUT / name).write_text(text, encoding='utf-8')
