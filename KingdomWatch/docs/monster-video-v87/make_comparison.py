from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
font=lambda size:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size)
sheet=Image.new('RGB',(900,960),'#b8c9cb');d=ImageDraw.Draw(sheet)
d.text((40,12),'原片：逐渐放大',font=font(22),fill='#142d2d')
d.text((490,12),'校正后：保留腿部运动',font=font(22),fill='#142d2d')
for row,frame in enumerate([0,28,55]):
 for col,folder in enumerate(['spider-raw','cutouts/thorn_ancient']):
  im=Image.open(ROOT/folder/f'{frame:03d}.png').convert('RGBA')
  im=im.resize((424,310),Image.Resampling.LANCZOS)
  sheet.paste(im,(col*450+13,row*305+45),im)
 d.text((18,row*305+51),f'帧 {frame}',font=font(16),fill='#142d2d')
sheet.save(ROOT/'spider-scale-comparison.jpg',quality=96)
data=json.loads((ROOT/'spider-stabilization.json').read_text())
print(json.dumps({'sourceScaleTrend':data['firstToLastZoom'],
 'correctedBodyScaleRange':[min(s['residualScale'] for s in data['samples']),max(s['residualScale'] for s in data['samples'])]},indent=2))
