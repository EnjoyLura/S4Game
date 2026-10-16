"""Inspect the user's supplied reference only; never launches the game."""
from pathlib import Path
import json
import shutil
import imageio.v2 as iio
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = Path('C:/Users/user/Downloads/Screenrecording_20261015_233949.mp4')
for rel in ['assets/scripts/ui/Panels.ts', 'assets/scripts/ui/UIMotion.ts', 'assets/scripts/ui/UIArtReady.ts', 'assets/scripts/ui/ButtonFeedback.ts']:
    dest = OUT/'before'/rel
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(GAME/rel, dest)
reader = iio.get_reader(str(SOURCE))
meta = reader.get_meta_data()
fps = float(meta['fps'])
times = [i * .5 for i in range(16)]
sheet = Image.new('RGB', (900, 4 * 420), '#202b38')
draw = ImageDraw.Draw(sheet)
for i, t in enumerate(times):
    frame = Image.fromarray(reader.get_data(round(t * fps)))
    frame.thumbnail((220, 396))
    x, y = i % 4 * 225, i // 4 * 420
    sheet.paste(frame, (x, y))
    draw.text((x+5, y+398), f'{t:.2f}s', fill='white')
reader.close()
sheet.save(OUT/'reference-overview.jpg', quality=93)
(OUT/'reference-meta.json').write_text(json.dumps({'source': str(SOURCE), **meta}, ensure_ascii=False, indent=2), encoding='utf-8')
print(OUT/'reference-overview.jpg')
