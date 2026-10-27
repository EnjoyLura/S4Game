"""Composite Blender RGBA renders; bloom, neutral presentation, game-size comparison.
No game is run. The forest view is an offline composition using existing art.
"""
import argparse
import json
import math
from functools import lru_cache
from pathlib import Path
import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--all',action='store_true')
args=parser.parse_args()
FPS=24
FILES=sorted((OUT/'frames').glob('frame_*.png'))
SIZE=Image.open(FILES[0]).width
FONT='C:/Windows/Fonts/msyh.ttc'
def font(n):return ImageFont.truetype(FONT,round(n*SIZE/960))

def studio():
    y,x=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)/SIZE
    light=np.exp(-(((x-.49)/.50)**2+((y-.57)/.44)**2))
    floor=np.exp(-(((x-.50)/.44)**2+((y-.65)/.16)**2))
    rng=np.random.default_rng(27)
    grain=rng.normal(0,.0008,(SIZE,SIZE))
    rgb=np.stack([.014+.025*light+.010*floor+grain,.023+.036*light+.008*floor+grain,.036+.052*light+.005*floor+grain],axis=2)
    im=Image.fromarray(np.uint8(np.clip(rgb,0,1)*255))
    # No decorative circles: ground surges must read as independent lightning paths.
    return np.asarray(im,dtype=np.float32)/255

BG=studio()
forest=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGB')
# Fixed crop and scale for every frame; keep the scene's original aspect ratio.
crop_h=forest.width
forest=forest.crop((0,350,forest.width,350+crop_h)).resize((SIZE,SIZE),Image.Resampling.LANCZOS)
forest=forest.convert('RGBA')
manifest=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf8'))
mx,my,mw,mh=manifest['frames']['forest_guard']
mob=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA').crop((mx,my,mx+mw,my+mh))
for px,py,s in [(.37,.60,.105),(.61,.54,.092),(.66,.70,.11),(.28,.72,.112)]:
    sprite=mob.resize((round(SIZE*s),round(SIZE*s)),Image.Resampling.LANCZOS)
    forest.alpha_composite(sprite,(round(px*SIZE-sprite.width/2),round(py*SIZE-sprite.height)))
forest=forest.convert('RGB')
forest=np.asarray(forest,dtype=np.float32)/255
yy,xx=np.mgrid[0:SIZE,0:SIZE].astype(np.float32)/SIZE
LOCAL_LIGHT=np.exp(-(((xx-.5)/.16)**2+((yy-.605)/.085)**2))

def bloom(rgb,alpha):
    lum=rgb.max(axis=2)
    source=np.maximum(0,(lum-.44)/.56)*alpha
    src=Image.fromarray(np.uint8(np.clip(source,0,1)*255))
    glow=np.zeros((SIZE,SIZE),np.float32)
    for radius,weight in [(1.6,.60),(5.8,.55),(18,.46),(48,.25)]:
        glow+=np.asarray(src.filter(ImageFilter.GaussianBlur(radius*SIZE/960)),dtype=np.float32)/255*weight
    return glow[:,:,None]*np.array([1,.53,.075],dtype=np.float32)

def stage_name(t):
    if t<.55:return '凝聚 · 晶状雷枪'
    if t<1.5:return '投掷 · 加速贯地'
    if t<2.25:return '触地 · 雷爆与碎石'
    if t<6.55:return '持续放电 · 地面雷波'
    return '余电消散'

@lru_cache(maxsize=1)
def source(path):
    rgba=np.asarray(Image.open(path).convert('RGBA'),dtype=np.float32)/255
    rgb=rgba[:,:,:3];alpha=rgba[:,:,3]
    return rgb,alpha,bloom(rgb,alpha)

def compose(path,game=False,labels=True):
    rgb,alpha,glow=source(path)
    frame=int(path.stem.split('_')[1]);t=(frame-1)/FPS
    bg=forest.copy() if game else BG.copy()
    # A brief, localized contact illumination. No screen-wide flash or camera shake.
    energy=0
    if t>=1.5:
        energy=.65*math.exp(-max(0,t-1.5)*11)
        for delay in [.035,.8,1.65,2.55,3.55]:
            age=t-1.5-delay
            if age>=0:energy+=.075*math.exp(-age*8)
    bg+=LOCAL_LIGHT[:,:,None]*np.array([1,.46,.045])*energy
    result=bg*(1-alpha[:,:,None])+rgb*alpha[:,:,None]
    result+=glow*(1 if not game else .8)
    result=np.clip(result,0,1)
    im=Image.fromarray(np.uint8(result*255))
    if labels:
        d=ImageDraw.Draw(im)
        pad=round(SIZE*.045)
        if game:
            d.rounded_rectangle((pad,pad,SIZE-pad,pad+SIZE*.082),radius=8,fill=(12,19,22))
            d.text((pad+SIZE*.018,pad+SIZE*.018),'游戏场景静态合成 · 尚未接入',font=font(20),fill=(230,230,218))
        else:
            hx=round(SIZE*.61)
            d.text((hx,pad),'GOLDEN THUNDER',font=font(15),fill=(186,151,85))
            d.text((hx,pad+SIZE*.032),'雷枪 · 雷暴冲击',font=font(31),fill=(236,233,219))
            d.text((hx,pad+SIZE*.084),'BLENDER  /  VFX STUDY 02',font=font(12),fill=(103,119,134))
        base=round(SIZE*.915)
        if game:d.rectangle((0,base-12,SIZE,SIZE),fill=(12,19,22))
        d.text((pad,base),stage_name(t),font=font(18),fill=(226,215,185))
        d.text((SIZE-pad-SIZE*.13,base),f'{t:04.2f} s',font=font(16),fill=(139,153,162))
        y=round(SIZE*.963)
        d.line((pad,y,SIZE-pad,y),fill=(44,54,66),width=2)
        d.line((pad,y,pad+(SIZE-2*pad)*min(1,t/8),y),fill=(217,165,67),width=3)
        for mark in [1.5,2.3,3.15,4.05,5.05]:
            x=round(pad+(SIZE-2*pad)*mark/8)
            d.line((x,y-3,x,y+3),fill=(112,100,75),width=1)
    return im

keyframes=[30,37,39,41,44,49,57,80,118]
tiles=[]
for f in keyframes:
    path=OUT/'frames'/f'frame_{f:04d}.png'
    if not path.exists():continue
    im=compose(path)
    im.save(OUT/f'beauty-{f:04d}.jpg',quality=96)
    gm=compose(path,True)
    gm.save(OUT/f'game-context-{f:04d}.jpg',quality=95)
    tile=im.resize((400,400),Image.Resampling.LANCZOS)
    tiles.append(tile)
contact=Image.new('RGB',(400*3,400*math.ceil(len(tiles)/3)),(8,12,18))
for i,tile in enumerate(tiles):contact.paste(tile,((i%3)*400,(i//3)*400))
contact.save(OUT/'contact-sheet.jpg',quality=94)

if args.all:
    expected=list(range(1,193))
    actual=[int(p.stem.split('_')[1]) for p in FILES]
    assert actual==expected, f'Expected 192 frames, got {len(actual)}'
    gifs=[];game_gifs=[]
    with imageio.get_writer(OUT/'golden-thunder-lance.mp4',fps=FPS,codec='libx264',quality=9,macro_block_size=16,ffmpeg_log_level='error') as writer, imageio.get_writer(OUT/'game-context.mp4',fps=FPS,codec='libx264',quality=9,macro_block_size=16,ffmpeg_log_level='error') as game_writer:
        for i,path in enumerate(FILES):
            im=compose(path);gm=compose(path,True)
            writer.append_data(np.asarray(im));game_writer.append_data(np.asarray(gm))
            if i%2==0:
                gifs.append(im.resize((640,640),Image.Resampling.LANCZOS))
                game_gifs.append(gm.resize((480,480),Image.Resampling.LANCZOS))
            if i%24==0:print('COMPOSITED',i,flush=True)
    durations=[round((i+1)*1000/12)-round(i*1000/12) for i in range(len(gifs))]
    gifs[0].save(OUT/'golden-thunder-lance.webp',save_all=True,append_images=gifs[1:],duration=durations,loop=0,quality=88,method=4)
    game_gifs[0].save(OUT/'game-context.webp',save_all=True,append_images=game_gifs[1:],duration=durations,loop=0,quality=87,method=4)
    # GIF uses a shared palette to avoid frame-to-frame color flicker.
    atlas=Image.new('RGB',(640*8,640*4))
    for i in range(32):atlas.paste(gifs[i*3],((i%8)*640,(i//8)*640))
    palette=atlas.quantize(colors=192)
    indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in gifs]
    gif_durations=[(round((i+1)*100/12)-round(i*100/12))*10 for i in range(len(gifs))]
    indexed[0].save(OUT/'golden-thunder-lance.gif',save_all=True,append_images=indexed[1:],duration=gif_durations,loop=0,optimize=False,disposal=2)
    (OUT/'preview-info.json').write_text(json.dumps({'frames':192,'fps':24,'seconds':8,'resolution':SIZE,'render':'Blender EEVEE','post':'fixed background, localized ground light, multiscale bloom','gamePreview':'Offline static art composition; no engine execution','audio':False},indent=2))
print('PREVIEW_COMPLETE',flush=True)
