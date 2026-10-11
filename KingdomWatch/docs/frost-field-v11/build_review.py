"""Keep the accepted v10 opening/main; fracture its last solid ice frame.

No new generation or independent AI cels. Fixed source fragments retain their
painted facets and follow downward gravity to their own ground roots, then melt.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
FX = GAME / 'assets/resources/fx'
SOURCE = OUT.parent / 'frost-field-v10/sequence/frames-alpha'
DEST = OUT / 'sequence'
(DEST / 'frames-alpha').mkdir(parents=True, exist_ok=True)
S = 384
PREFIX = 'frost_domain_video_v11'
meta = json.loads((FX / 'frost_domain_video_v10.frames.json').read_text(encoding='utf-8'))
source = [Image.open(SOURCE / f'frost-{i:03d}.png').convert('RGBA') for i in range(44)]
mature = np.asarray(source[23]).copy()
yy, xx = np.mgrid[:S, :S]
rng = np.random.default_rng(311011)

def smooth(a, b, v):
    u = np.clip((v-a)/(b-a), 0, 1)
    return u*u*(3-2*u)

# Crystal groups and their fixed ground roots in the original 384px canvas.
# Ice moves down toward THESE feet, rather than translating the entire field.
groups = [((193,132),(33,42),(194,159)),
          ((277,167),(31,37),(272,195)),
          ((294,235),(35,39),(285,264)),
          ((219,285),(39,34),(218,315)),
          ((124,251),(36,40),(138,282)),
          ((103,174),(34,42),(114,206))]
weights = []
for (x,y),(rx,ry),_ in groups:
    r = np.sqrt(((xx-x)/rx)**2 + ((yy-y)/ry)**2)
    weights.append(1-smooth(.79,1.08,r))
weights = np.asarray(weights)
owners = weights.argmax(axis=0)
crystal_mask = weights.max(axis=0)
base = mature.copy()
base[:,:,3] = np.rint(mature[:,:,3]*(1-crystal_mask)).astype('uint8')
pieces = []
for group, ((cx,cy),(rx,ry),(rootx,rooty)) in enumerate(groups):
    # Irregular connected Voronoi pieces, with stable identity across the tail.
    seeds = np.asarray([(cx,cy)] + [(cx+rx*rng.uniform(-.78,.78), cy+ry*rng.uniform(-.8,.8)) for _ in range(8)])
    distance = (xx[None]-seeds[:,0,None,None])**2+(yy[None]-seeds[:,1,None,None])**2
    labels = distance.argmin(axis=0)
    for j in range(len(seeds)):
        mask = crystal_mask * (owners==group) * (labels==j)
        alpha = np.rint(mature[:,:,3]*mask).astype('uint8')
        ys,xs = np.nonzero(alpha > 2)
        if not len(xs): continue
        x0,x1,y0,y1 = xs.min(),xs.max()+1,ys.min(),ys.max()+1
        a = alpha[y0:y1,x0:x1].astype(float)
        grid_y,grid_x = np.mgrid[y0:y1,x0:x1]
        px,py = float((a*grid_x).sum()/a.sum()),float((a*grid_y).sum()/a.sum())
        rgba = mature[y0:y1,x0:x1].copy();rgba[:,:,3]=alpha[y0:y1,x0:x1]
        # Projected height above this cluster's root. No upward impulse.
        height = max(7, rooty-py)
        velocity = 18.0
        gravity = 900.0
        land = (-velocity+math.sqrt(velocity**2+2*gravity*height))/gravity
        pieces.append(dict(image=Image.fromarray(rgba), x=x0,y=y0,cx=px,cy=py,
                           height=height,land=land,delay=float(rng.uniform(0,.025)),
                           vx=float((px-cx)*1.05+rng.uniform(-14,14)),
                           ground_vy=float(rng.uniform(-4,7)),
                           spin=float(rng.uniform(-120,120)),
                           group=group))

def state(p,t):
    age=max(0,t-p['delay']); airborne=min(age,p['land'])
    drop=min(p['height'],18*airborne+450*airborne*airborne)
    slide=min(age,.43)
    dx=p['vx']*slide
    floor_y=p['ground_vy']*slide
    settled=max(0,age-p['land'])
    # Flatten a little after contact; never bounce or shoot back upwards.
    squash=1-.42*smooth(0,.08,settled)
    fade=(1-smooth(.49,.68,t))*(1-smooth(.10,.27,settled))
    return dx,drop+floor_y,p['spin']*airborne,squash,fade,drop

tracks=[]
def tail(t):
    if t<=0: return source[23].copy()
    if t>=.68: return Image.new('RGBA',(S,S))
    rgba=base.copy()
    rgba[:,:,3]=np.rint(base[:,:,3]*(1-smooth(.02,.61,t))).astype('uint8')
    canvas=Image.fromarray(rgba)
    # Every fragment's centre falls monotonically in height until grounded.
    # Ground-plane lateral spread is short and remains inside the fixed canvas.
    for p in sorted(pieces,key=lambda p:p['cy']+p['height']):
        dx,dy,angle,squash,fade,_=state(p,t)
        image=p['image']
        # Use the crop centre as a stable pivot; no frame-to-frame recropping.
        image=image.resize((image.width,max(1,round(image.height*squash))),Image.Resampling.BICUBIC)
        image=image.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
        image.putalpha(image.getchannel('A').point(lambda a:round(a*fade)))
        x=p['x']+p['image'].width/2+dx-image.width/2
        y=p['y']+p['image'].height/2+dy-image.height/2
        canvas.alpha_composite(image,(round(x),round(y)))
    return canvas

frames=source[:24]+[tail(.68*k/19) for k in range(20)]
for p in pieces:
    ts=np.linspace(0,.68,69)
    drops=[state(p,float(t))[5] for t in ts]
    assert all(b>=a-1e-9 for a,b in zip(drops,drops[1:])), 'fragment must never rise'
    assert abs(drops[-1]-p['height'])<1e-9, 'all fragments reach ground'
    tracks.append({k:round(p[k],5) if isinstance(p[k],float) else p[k] for k in
                   ('group','cx','cy','height','land','delay','vx','ground_vy','spin')})

atlas=Image.new('RGBA',(3072,2304))
rects={}
for i,frame in enumerate(frames):
    x,y=i%8*S,i//8*S
    atlas.paste(frame,(x,y));rects[f'{PREFIX}_{i}']=[x,y,S,S]
    frame.save(DEST/'frames-alpha'/f'frost-{i:03d}.png')
atlas.save(DEST/f'{PREFIX}.png')
atlas.save(FX/f'{PREFIX}.png')
meta.update(frames=rects,framePrefix=PREFIX+'_',sourceVersion='frost-field-v10',
            tailFade='fixed painted fragments; downward 18px/s initial velocity + 900px/s² gravity; settle then dissolve',
            preservedFrameCount=24,newGenerationCalls=0,status='integrated-for-manual-review',gameIntegrated=True)
for directory in (FX,DEST):
    (directory/f'{PREFIX}.frames.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
for suffix in ('.png','.frames.json'):
    dest=FX/f'{PREFIX}{suffix}.meta'
    if dest.exists(): continue
    template=json.loads((FX/f'frost_domain_video_v10{suffix}.meta').read_text(encoding='utf-8'))
    old=template['uuid']; new=str(uuid.uuid4())
    raw=json.dumps(template,ensure_ascii=False,indent=2).replace(old,new).replace('frost_domain_video_v10',PREFIX)
    dest.write_text(raw,encoding='utf-8')

floor=Image.open(GAME/'assets/resources/scenes/scene_1_1.png').convert('RGB')
floor=floor.crop((90,600,1060,1376)).resize((640,512),Image.Resampling.LANCZOS)
def compose(frame):
    image=floor.convert('RGBA');image.alpha_composite(frame,(128,83));return image.convert('RGB')
times=np.cumsum([0]+meta['frameDurations'][:-1]).tolist()
samples=[floor]+[compose(f) for f in frames]+[floor]
pal=Image.new('RGB',(1280,1024))
for i,k in enumerate((18,24,29,34)):pal.paste(samples[k+1],(i%2*640,i//2*512))
palette=pal.quantize(colors=256)
q=[i.quantize(palette=palette,dither=Image.Dither.NONE) for i in samples]
boundaries=[round(s*100)*10 for s in np.cumsum([0]+meta['frameDurations'])]
gifdur=np.diff(boundaries).tolist()
q[0].save(OUT/'frost-domain-preview.gif',save_all=True,append_images=q[1:],
          duration=[200]+gifdur+[500],loop=0,optimize=False)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
sheet=Image.new('RGB',(1280,1080),'#1e2d36');d=ImageDraw.Draw(sheet)
for i,k in enumerate([23,24,26,28,30,32,34,36,38,40,42,43]):
    frame=compose(frames[k]).resize((320,256),Image.Resampling.LANCZOS)
    x,y=i%4*320,i//4*360
    sheet.paste(frame,(x,y));d.text((x+8,y+264),f'{times[k]:.3f}s / #{k}',font=font,fill='white')
sheet.save(OUT/'tail-contact-sheet.jpg',quality=95)
compare=Image.new('RGB',(1280,512))
compare.paste(compose(source[32]),(0,0));compare.paste(compose(frames[32]),(640,0))
compare.save(OUT/'tail-comparison.png')
report={'status':'awaiting-user-review','newAiCalls':0,'duration':round(sum(meta['frameDurations']),6),
        'onset':.4,'main':.42,'tail':.68,'frameCount':44,'fragmentCount':len(pieces),
        'onsetAndMainPixelIdenticalToV10':all(np.array_equal(a,b) for a,b in zip(frames[:24],source[:24])),
        'groundAnchor':meta['groundAnchor'],'groundRadius':meta['groundRadius'],
        'downwardInitialVelocity':18,'gravity':900,'noUpwardImpulse':True,
        'allFragmentsReachGroundBeforeFade':all(p['land']+p['delay']<.49 for p in pieces),
        'lastFrameAlphaMax':frames[-1].getchannel('A').getextrema()[1],
        'v10SourceHash':hashlib.sha256((FX/'frost_domain_video_v10.png').read_bytes()).hexdigest(),
        'outputHash':hashlib.sha256((FX/f'{PREFIX}.png').read_bytes()).hexdigest(),
        'review':'offline material composite; no live battle inspected'}
assert report['onsetAndMainPixelIdenticalToV10'] and report['allFragmentsReachGroundBeforeFade']
assert report['duration']==1.5 and report['lastFrameAlphaMax']==0
(OUT/'fragment-trajectories.json').write_text(json.dumps(tracks,indent=2),encoding='utf-8')
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report))
