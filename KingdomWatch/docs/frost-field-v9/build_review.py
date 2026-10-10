"""Polish the approved H3 v6 video assets without generating new media.

One fixed inverse spatial map rounds the six-sided field. A short opacity
onset replaces the original slow starburst, followed by native v6 frames.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
GAME=OUT.parents[1]
BASE=OUT.parent/'frost-field-v6'
SOURCE=BASE/'sequence/frames-alpha'
OUT.mkdir(parents=True,exist_ok=True)
DEST=OUT/'sequence'
DEST.mkdir(exist_ok=True)
(DEST/'frames-alpha').mkdir(exist_ok=True)
S=384
center=(192.0,214.0)
yy,xx=np.mgrid[0:S,0:S].astype(np.float32)
dx,dy=xx-center[0],yy-center[1]
radius=np.hypot(dx,dy)
angle=np.arctan2(dy,dx)
# v6 has vertices near 12, 2, 4, 6, 8 and 10 o'clock. Expand the
# regions between those vertices; preserve the center and vertex rays.
sector=math.pi/3
delta=(angle+sector/2)%sector-sector/2
hex_to_round=np.cos(delta)/math.cos(math.pi/6)
source_radius=radius.copy()
for _ in range(4):
    weight=np.clip((source_radius-36)/(104-36),0,1)
    weight=weight*weight*(3-2*weight)
    scale=1+(hex_to_round-1)*weight
    source_radius=radius/scale
sx=center[0]+dx/scale
sy=center[1]+dy/scale
x0=np.floor(sx).astype(int)
y0=np.floor(sy).astype(int)
tx=(sx-x0)[...,None]
ty=(sy-y0)[...,None]

def round_field(frame):
    rgba=np.array(frame,dtype=np.float32)/255
    rgba[:,:,:3]*=rgba[:,:,3:4]
    def sample(x,y):
        valid=(x>=0)&(x<S)&(y>=0)&(y<S)
        return rgba[np.clip(y,0,S-1),np.clip(x,0,S-1)]*valid[...,None]
    a=sample(x0,y0)*(1-tx)+sample(x0+1,y0)*tx
    b=sample(x0,y0+1)*(1-tx)+sample(x0+1,y0+1)*tx
    result=a*(1-ty)+b*ty
    result[:,:,:3]/=np.maximum(result[:,:,3:4],1e-8)
    return Image.fromarray(np.rint(np.clip(result,0,1)*255).astype('uint8'))

source_indices=list(range(22,56))
source_hashes={}
native=[]
for index in source_indices:
    path=SOURCE/f'frost-{index:03d}.png'
    source_hashes[str(index)]=hashlib.sha256(path.read_bytes()).hexdigest()
    native.append(round_field(Image.open(path).convert('RGBA')))
frames=[]
for opacity in (.30,.72):
    rgba=np.array(native[0])
    rgba[:,:,3]=np.rint(rgba[:,:,3].astype(float)*opacity).astype('uint8')
    frames.append(Image.fromarray(rgba))
frames+=native
durations=[20,20]+[30 if index<36 else 20 for index in source_indices]
duration=sum(durations)/1000
prefix='frost_domain_video_v9'
columns=8
rows=math.ceil(len(frames)/columns)
atlas=Image.new('RGBA',(columns*S,rows*S))
rects={}
for k,frame in enumerate(frames):
    x,y=(k%columns)*S,(k//columns)*S
    atlas.paste(frame,(x,y))
    rects[f'{prefix}_{k}']=[x,y,S,S]
    frame.save(DEST/'frames-alpha'/f'frost-{k:03d}.png')
atlas.save(DEST/f'{prefix}.png')
metadata={'frames':rects,'frameCount':len(frames),'cellSize':[S,S],
          'duration':duration,'frameDurations':[ms/1000 for ms in durations],
          'sourceModel':'lens-minimax-h3-768p','sourceVersion':'frost-field-v6',
          'sourceFrameIndices':[22,22]+source_indices,
          'opening':'40ms opacity onset from the existing fully formed frame; original frames 0-21 omitted',
          'geometry':'one fixed hexagon-to-round inverse map for the entire clip',
          'warpCenter':list(center),'maxRadialExpansion':1/math.cos(math.pi/6),
          'noPerFrameTracking':True,'newGenerationCalls':0,
          'tailFade':'inherited from v6','status':'awaiting-manual-review',
          'gameIntegrated':False,'blend':'straight alpha, SRC_ALPHA / ONE_MINUS_SRC_ALPHA'}
(DEST/f'{prefix}.frames.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')

font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
floor=Image.open(GAME/'assets/resources/scenes/scene_1_1.png').convert('RGB')
floor=floor.crop((90,600,1060,1376)).resize((640,512),Image.Resampling.LANCZOS)
offset=(128,83)
def compose(frame):
    image=floor.convert('RGBA')
    if frame is not None: image.alpha_composite(frame,offset)
    return image.convert('RGB')

picked=np.linspace(0,len(frames)-1,16).round().astype(int)
sheet=Image.new('RGB',(1024,1160),'#202c35')
draw=ImageDraw.Draw(sheet)
draw.text((16,12),f'v6 精修 · MiniMax H3 既有素材 / {duration:.2f} 秒释放 / 无新生成',font=font,fill='#d8edf7')
elapsed=np.cumsum([0]+durations[:-1])/1000
for k,index in enumerate(picked):
    cell=Image.new('RGBA',(256,256),'#303d46')
    cell.alpha_composite(frames[index].resize((256,256),Image.Resampling.LANCZOS))
    x,y=k%4*256,48+k//4*278
    sheet.paste(cell.convert('RGB'),(x,y))
    draw.text((x+10,y+258),f'#{index:02d} · {elapsed[index]:.2f}s',font=small,fill='#d8edf7')
sheet.save(OUT/'contact-sheet.jpg',quality=94)

samples=[compose(None)]+[compose(frame) for frame in frames]+[compose(None)]
palette_source=Image.new('RGB',(1280,1024))
for k,index in enumerate((2,9,19,28)):
    palette_source.paste(compose(frames[index]),(k%2*640,k//2*512))
palette=palette_source.quantize(colors=256)
quantized=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in samples]
quantized[0].save(OUT/'frost-domain-preview.gif',save_all=True,append_images=quantized[1:],
                  duration=[180]+durations+[500],loop=0,optimize=True)
peak=10
compose(frames[peak]).save(OUT/'frost-domain-preview.png')
frames[peak].save(OUT/'fully-expanded-cutout.png')

compare=Image.new('RGB',(1280,544),'#202c35')
compare.paste(compose(Image.open(SOURCE/'frost-030.png').convert('RGBA')),(0,0))
compare.paste(compose(frames[peak]),(640,0))
draw=ImageDraw.Draw(compare)
draw.text((14,516),'原 v6：六边形轮廓',font=font,fill='#d8edf7')
draw.text((654,516),'v9：保留素材，圆化侧边',font=font,fill='#d8edf7')
compare.save(OUT/'outline-comparison.jpg',quality=94)

unchanged=all(hashlib.sha256((SOURCE/f'frost-{int(index):03d}.png').read_bytes()).hexdigest()==digest for index,digest in source_hashes.items())
report={'sourceModel':'lens-minimax-h3-768p','sourceVersion':'v6','newGenerationCalls':0,
        'sourceFramesUntouched':unchanged,'fixedWarpAcrossAllFrames':True,
        'originalStarburstRemoved':True,'onsetSeconds':.04,
        'frameCount':len(frames),'skillDuration':duration,'gifDurationMs':sum(durations)+680,
        'lastFrameAlphaMax':frames[-1].getchannel('A').getextrema()[1],
        'reviewMode':'offline material composite','gameIntegrated':False}
(OUT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
