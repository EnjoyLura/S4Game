"""Offscreen typography review of captured actual showTips labels, no game/UI launched."""
import json,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,'C:/Users/user/AppData/Local/Temp/kw-video-inspect-deps')
from PIL import Image,ImageDraw,ImageFont
cases=json.loads((OUT/'tips-review.json').read_text('utf8'))
canvas=Image.new('RGB',(1160,1050),'#24342e');d=ImageDraw.Draw(canvas)
font_path=ROOT/'assets/resources/fonts/UIBody.ttf'
head=ImageFont.truetype(str(font_path),24)
d.text((24,18),'风法师 · 实际说明面板离屏排版检查',font=head,fill='white')
for i,case in enumerate(cases):
 p=case['panel'];left=24+(i%3)*380;top=120+(i//3)*460
 d.text((left,top-44),('基础配置' if case['build']=='base' else '专属卡满层')+' · '+{'atk':'普攻','skill':'技能','ult':'大招'}[case['kind']],font=head,fill='#a8edcf')
 d.rounded_rectangle((left,top,left+p['w'],top+p['h']),radius=12,fill='#14181e')
 for label in case['labels']:
  s=label['style'];font=ImageFont.truetype(str(font_path),s['size']);text=label['text'];limit=s.get('w',p['w'])
  while font.getlength(text)>limit and font.size>6:font=ImageFont.truetype(str(font_path),font.size-1)
  assert font.size>=10,(case['kind'],text,font.size)
  x=left+label['x']-(p['x']-p['w']/2);y=top+p['y']+p['h']/2-label['y']
  align=s.get('align','center');anchor='mm'
  if align=='left':x-=limit/2;anchor='lm'
  if align=='right':x+=limit/2;anchor='rm'
  d.text((x,y),text,font=font,fill=s['color'],anchor=anchor)
canvas.save(OUT/'tips-preview.png')
print('PASS: six actual-label panels, minimum rendered font >=10px')
