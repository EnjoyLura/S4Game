"""Create an offline scene composite using real game art; no battle execution."""
from pathlib import Path
import argparse, json
from PIL import Image, ImageDraw, ImageFont
from build_idle import save_gif

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[1]
ap=argparse.ArgumentParser()
ap.add_argument('--take',choices=['idle-v2','idle-v3','idle-v4'])
args=ap.parse_args()
folder=ROOT/'sniper'/args.take if args.take else ROOT/'sniper'
sniper=json.loads((folder/'idle.frames.json').read_text(encoding='utf-8'))
archer=json.loads((GAME/'assets/resources/ux/archer_idle_v1/idle.frames.json').read_text(encoding='utf-8'))
s_atlas=Image.open(folder/'idle.png').convert('RGBA')
a_atlas=Image.open(GAME/'assets/resources/ux/archer_idle_v1/idle.png').convert('RGBA')
floor=Image.open(GAME/'assets/resources/scenes/scene_1_1.png').convert('RGBA').resize((750,500),Image.Resampling.LANCZOS)
wall=Image.open(GAME/'assets/resources/ux/defense_wall.png').convert('RGBA').resize((750,321),Image.Resampling.LANCZOS)
base=floor.copy()
base.alpha_composite(wall,(0,210))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17)
draw=ImageDraw.Draw(base)
draw.text((20,15),'游戏素材合成 · 固定脚底 / 等比显示',font=font,fill='#f4edce',stroke_width=2,stroke_fill='#31443b')
draw.text((115,465),f"线上弓箭手 · {archer['displayHeight']}",font=font,fill='#f4edce',stroke_width=2,stroke_fill='#31443b')
draw.text((445,465),'重弩手 · 新待机',font=font,fill='#f4edce',stroke_width=2,stroke_fill='#31443b')
def paint(canvas,atlas,manifest,index,x):
    name=manifest['animation']['frames'][index]
    px,py,w,h=manifest['frames'][name]
    cell=atlas.crop((px,py,px+w,py+h))
    scale=manifest['displayHeight']/manifest['readyHeightPx']
    cell=cell.resize((round(w*scale),round(h*scale)),Image.Resampling.LANCZOS)
    canvas.alpha_composite(cell,(round(x-manifest['groundAnchor'][0]*scale),round(440-manifest['groundAnchor'][1]*scale)))
frames=[]
count=len(sniper['animation']['frames'])
seconds=sniper['animation']['seconds']
timing=sniper['animation'].get('frameDurations',[seconds/count]*count)
t=0.0
for i in range(count):
    frame=base.copy()
    ai=int((t%archer['animation']['seconds'])/archer['animation']['seconds']*len(archer['animation']['frames']))
    paint(frame,a_atlas,archer,ai,210)
    paint(frame,s_atlas,sniper,i,540)
    frames.append(frame.convert('RGB'))
    t+=timing[i]
save_gif(frames,folder/'battle-composite.gif',seconds,timing)
print(json.dumps({'gif':str(folder/'battle-composite.gif'),'frames':count,'seconds':seconds,'archerDisplayHeight':archer['displayHeight']},ensure_ascii=True))
