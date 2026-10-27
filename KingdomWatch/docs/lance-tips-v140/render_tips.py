"""Render captured UI-only title/rows without loading the app or game engine."""
import sys,json
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps'))
from PIL import Image,ImageDraw,ImageFont
font=ROOT/'assets/resources/fonts/UIBody.ttf'
items=json.loads((OUT/'tips-review.json').read_text('utf8'))
sheet=Image.new('RGB',(1140,990),'#202C32');draw=ImageDraw.Draw(sheet)
names={'lance':'雷枪','arcane':'魔法弓','scythe':'镰刀法师'}
for i,item in enumerate(items):
 ox=i%3*380;oy=i//3*330;p=item['panel'];left=ox+15;top=oy+43
 draw.text((ox+15,oy+12),names[item['id']]+' / '+item['kind'],font=ImageFont.truetype(str(font),18),fill='white')
 draw.rounded_rectangle((left,top,left+p['w'],top+p['h']),12,fill='#14181E')
 for row in item['labels']:
  s=row['style'];size=s.get('size',15);f=ImageFont.truetype(str(font),size);maxw=s.get('w',999)
  while draw.textlength(row['text'],font=f)>maxw and size>8:size-=1;f=ImageFont.truetype(str(font),size)
  x=left+p['w']/2+(row['x']-p['x']);y=top+p['h']/2-(row['y']-p['y'])
  align=s.get('align','center');anchor='lm' if align=='left' else 'rm' if align=='right' else 'mm'
  if align=='left':x-=s.get('w',0)/2
  if align=='right':x+=s.get('w',0)/2
  draw.text((x,y),row['text'],font=f,fill=s.get('color','#FFFFFF'),anchor=anchor)
sheet.save(OUT/'tips-contact-sheet.png')
print('Captured tooltip titles and six rows rendered.')
