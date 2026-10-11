from pathlib import Path
import json
import imageio.v2 as imageio
from PIL import Image, ImageDraw

OUT=Path(__file__).resolve().parent
GAME=OUT.parents[1]
video=Path('C:/Users/user/Downloads/QQ20261011-113303.mp4')
r=imageio.get_reader(str(video))
meta=r.get_meta_data()
print(json.dumps(meta,default=str))
duration=meta['duration']
times=[(duration-.12)*i/15 for i in range(16)]
sheet=Image.new('RGB',(1200,1400),'#18252b')
d=ImageDraw.Draw(sheet)
for i,t in enumerate(times):
    frame=Image.fromarray(r.get_data(min(round(t*meta['fps']),round(duration*meta['fps'])-1)))
    frame.thumbnail((300,320))
    x,y=i%4*300,i//4*350
    sheet.paste(frame,(x,y));d.text((x+8,y+325),f'{t:.2f}s',fill='white')
sheet.save(OUT/'user-video-contact.jpg',quality=90)
r.close()
sheet=Image.new('RGB',(1152,900),'#253640');d=ImageDraw.Draw(sheet)
for i,k in enumerate([18,23,24,26,28,30,32,34,36,38,40,43]):
    frame=Image.open(GAME/f'docs/frost-field-v10/sequence/frames-alpha/frost-{k:03d}.png').convert('RGBA')
    frame.thumbnail((288,270))
    x,y=i%4*288,i//4*300
    sheet.paste(frame,(x,y),frame);d.text((x+8,y+275),f'v10 #{k}',fill='white')
sheet.save(OUT/'old-tail-contact.jpg',quality=93)
