"""Plot sampled pure geometry without running the engine or battle."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps'))
from PIL import Image,ImageDraw
out=Path(__file__).resolve().parent
paths=[p for p in json.loads((out/'trajectory-review.json').read_text()) if p['kind']=='normal']
im=Image.new('RGB',(1000,820),'#10191e');g=ImageDraw.Draw(im)
for col,p in enumerate(paths):
    def xy(x,y):return (col*500+250+x*.55,760-(y+500)*.55)
    g.text((col*500+24,24),'Diagonal throw' if col==0 else 'Target directly ahead',fill='#f9dea2')
    g.text((col*500+24,48),'Tip path / tangent direction / equal time samples',fill='#a5bbc1')
    for x in [-300,0,300]:g.line([xy(x,-500),xy(x,700)],fill='#263239')
    for y in [-450,0,300,700]:g.line([xy(-375,y),xy(375,y)],fill='#263239')
    points=p['points'];g.line([xy(x,y) for x,y,a in points],fill='#5c777d',width=2)
    for i,(x,y,a) in enumerate(points):
        x,y=xy(x,y);color=(255,round(150+90*i/len(points)),80)
        g.ellipse((x-2,y-2,x+2,y+2),fill=color)
        if i%3==0:
            ux,uy=math.cos(a),-math.sin(a)
            g.line((x-18*ux,y-18*uy,x,y),fill=color,width=3)
            g.polygon([(x,y),(x-7*ux+3*uy,y-7*uy-3*ux),(x-7*ux-3*uy,y-7*uy+3*ux)],fill=color)
    for name,x,y in [('launch',p['sx'],p['sy']),('impact',p['tx'],p['ty'])]:
        x,y=xy(x,y);g.text((x+8,y+4),name,fill='white')
    g.text((col*500+24,790),f"Duration {p['seconds']:.2f}s / descent {(1-p['apex'])*100:.0f}%",fill='#a5bbc1')
im.save(out/'trajectory.png')
