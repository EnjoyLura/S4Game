"""Read-only asset inspection contact sheet, never an in-game replacement asset."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
keys = ['ui_card_sharp', 'ui_card_swift', 'ui_card_crit_rate', 'ui_card_crit_dmg',
        'ui_card_cd_cut', 'ui_card_fast_charge_a', 'ui_icon_skill_archer']
for owner in ['mora']:
    keys += ['ui_icon_skill_' + owner, 'ui_icon_ult_' + owner]
    keys += [p.stem for p in sorted((ROOT / 'assets/resources/ux').glob('ui_card_' + owner + '*.png'))]
keys = list(dict.fromkeys(keys))
tile = 225
sheet = Image.new('RGB', (tile * 5, 260 * ((len(keys)+4)//5)), '#d9ddd9')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
rows = []
for i, key in enumerate(keys):
    src = ROOT / 'assets/resources/ux' / (key + '.png')
    im = Image.open(src).convert('RGBA')
    thumb = im.copy()
    thumb.thumbnail((205,205))
    x,y = (i%5)*tile, (i//5)*260
    sheet.paste(thumb, (x+(tile-thumb.width)//2,y+8), thumb)
    draw.text((x+5,y+220), key, fill='#111111', font=font)
    rows.append(dict(key=key,size=list(im.size),alphaBounds=im.getchannel('A').getbbox()))
sheet.save(HERE / 'existing-art-contact.png')
(HERE / 'existing-art.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(len(rows), 'source icons inspected')
