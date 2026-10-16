"""Prepare the established Cocos build and Pages publication commands."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/shop-product-details-v1'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR / name).read_text(encoding='utf-8-sig')
    text = text.replace('kwShopDetails', 'kwNotice').replace('shop-product-details-v1', 'notice-feedback-v1')
    text = text.replace('docs/equipment-unequip-v1/deployment-stage.json', 'docs/shop-product-details-v1/deployment-stage.json')
    text = text.replace('shop product icons open typed details with attributes, descriptions, quantities and purchase state',
                        'typed non-blocking notifications and growth feedback with actual values, merge behavior and semantic audio')
    (OUT / name).write_text(text, encoding='utf-8')
