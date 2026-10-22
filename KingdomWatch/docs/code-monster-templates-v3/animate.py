"""Reusable quadruped/flight templates, animated from four single stills.

Python + Pillow + NumPy. No image/video generation, game runtime, or network.
rigs.json holds per-creature landmarks and masks; template code is shared.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import time
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE=Path(__file__).resolve().parent
WORK=1024
SIZE=640
N=32
STEP=24
TAU=math.tau
BG=(237,231,214)


def smooth(x):
    x=np.clip(x,0.,1.)
    return x*x*(3-2*x)


def translation(x,y):
    return np.array([[1.,0,x],[0,1.,y],[0,0,1.]])


def transform(pivot,angle=0.,offset=(0.,0.),scale=(1.,1.)):
    a=math.radians(angle)
    c,s=math.cos(a),math.sin(a)
    m=np.array([[c*scale[0],-s*scale[1],0],[s*scale[0],c*scale[1],0],[0,0,1.]])
    return translation(pivot[0]+offset[0],pivot[1]+offset[1])@m@translation(-pivot[0],-pivot[1])


def point(matrix,p):
    return (matrix@np.array([*p,1.]))[:2]


def bone(a,b,c,d):
    a,b,c,d=map(np.asarray,(a,b,c,d))
    v=b-a
    target=d-c
    phi=math.atan2(v[1],v[0])
    cs,sn=math.cos(phi),math.sin(phi)
    basis=np.array([[cs,-sn,0],[sn,cs,0],[0,0,1.]])
    theta=math.degrees(math.atan2(target[1],target[0])-phi)
    length=np.linalg.norm(target)/np.linalg.norm(v)
    return translation(*c)@transform((0,0),angle=theta)@basis@np.diag([length,1.,1.])@basis.T@translation(-a[0],-a[1])


def mask(poly,radius=10,expand=11):
    m=Image.new('L',(WORK,WORK))
    ImageDraw.Draw(m).polygon([tuple(p) for p in poly],fill=255)
    if expand:
        m=m.filter(ImageFilter.MaxFilter(expand|1))
    if radius:
        m=m.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(m,dtype=np.float32)/255.


Y,X=np.mgrid[0:WORK,0:WORK].astype(np.float32)


def footstep(t,stride,lift):
    p=t%1.
    if p<.65:
        u=p/.65
        depth=stride*(1-2*float(smooth(u)))
        return depth,0.,3.*float(smooth((u-.72)/.28))
    u=(p-.65)/.35
    return (-stride+2*stride*float(smooth(u)),
            lift*math.sin(math.pi*u)**1.5,
            3*(1-float(smooth(u)))-4*math.sin(math.pi*u))


class QuadrupedTemplate:
    def __init__(self,cfg):
        self.cfg=cfg
        self.names=['body','head','tail']
        head=mask(cfg['head'],11,9)
        tail=mask(cfg['tail'],12,11)*(1-head)
        raw_legs=[]
        for leg in cfg['legs']:
            region=mask(leg['mask'],13,21)*(1-head)
            raw_legs.append(region)
        # The source shows the forelegs in front of the hind legs. Restrict
        # overlapping influence rather than stretching the visible face.
        fore=np.maximum(raw_legs[0],raw_legs[1])
        raw_legs[2]*=(1-fore)
        raw_legs[3]*=(1-fore)
        total=sum(raw_legs)
        norm=np.maximum(total,1.)
        raw_legs=[v/norm for v in raw_legs]
        tail*=1-np.minimum(total,1.)
        maps=[head,tail]
        for leg,region in zip(cfg['legs'],raw_legs):
            bend=smooth((Y-leg['knee'][1]+22)/54)
            maps.extend((region*(1-bend),region*bend))
            self.names.extend((leg['id']+'_upper',leg['id']+'_lower'))
        self.maps=[np.maximum(0,1-sum(maps))]+maps

    def pose(self,t):
        cfg=self.cfg
        a=TAU*t
        body=transform(cfg['body_pivot'],angle=.50*math.sin(a),
                       offset=(cfg['sway']*math.sin(a),cfg['bob']*math.cos(2*a+.2)))
        head=body@transform(cfg['head_pivot'],angle=-.55*math.sin(a-.15),
                            offset=(0,1.9*math.sin(2*a-.35)))
        tail=body@transform(cfg['tail_pivot'],angle=cfg['tail_amplitude']*math.sin(a-.5))
        matrices=[body,head,tail]
        feet=[]
        for leg in cfg['legs']:
            depth,lift,roll=footstep(t+leg['phase'],cfg['stride'],cfg['lift'])
            is_hind=leg['id'].startswith('hind')
            amp=.76 if is_hind else 1.
            side=-1 if leg['id'].endswith('left') else 1
            foot=np.asarray(leg['foot'])
            shift=(side*2.4*math.sin(a+leg['phase']*TAU),amp*(depth-lift))
            lower=transform(foot,offset=shift,angle=side*roll*.7,
                            scale=(1+depth*.0006,1+depth*.0006))
            knee=leg['knee']
            upper=bone(leg['root'],knee,point(body,leg['root']),point(lower,knee))
            matrices.extend((upper,lower))
            contact=point(lower,(foot[0],foot[1]+40))
            feet.append((contact,lift*amp,is_hind))
        return matrices,{'feet':feet,'phase':t}


class FlightTemplate:
    def __init__(self,cfg):
        self.cfg=cfg
        self.names=['body','head','tail']
        head=mask(cfg['head'],9,7)
        tail=mask(cfg['tail'],8,7)*(1-head)
        maps=[head,tail]
        total=sum(maps)
        maps=[m/np.maximum(total,1.) for m in maps]
        self.maps=[np.maximum(0,1-sum(maps))]+maps

    def pose(self,t):
        matrices,extra=self.full_pose(t)
        return matrices[:3],extra

    def full_pose(self,t):
        cfg=self.cfg
        split=cfg['power_fraction']
        # Downstroke occupies less time than recovery; no reverse playback.
        phi=math.pi*t/split if t<split else math.pi+math.pi*(t-split)/(1-split)
        wave=math.cos(phi)
        body=transform(cfg['body_pivot'],angle=.45*math.sin(phi),
                       offset=(1.8*math.sin(phi-.2),-cfg['bob']*math.sin(phi-.55)))
        head=body@transform(cfg['head_pivot'],angle=-.55*math.sin(phi-.08),
                            offset=(0,1.3*math.sin(phi-.35)))
        tail=body@transform(cfg['tail_pivot'],angle=2.8*math.sin(phi-.8))
        matrices=[body,head,tail]
        flap=(cfg['up_angle']+cfg['down_angle'])/2*wave+(cfg['up_angle']-cfg['down_angle'])/2
        for side,root,wrist in zip(('l','r'),cfg['wing_roots'],cfg['wing_wrists']):
            sign=1 if side=='l' else -1
            contraction=1-cfg['fold']*max(0,wave)
            inner=body@transform(root,angle=sign*flap,scale=(contraction,1.))
            outer=inner@transform(wrist,angle=sign*cfg['outer_angle']*math.cos(phi-.48))
            matrices.extend((inner,outer))
        return matrices,{'phase':t,'wing_phase':phi}


class FlightWing:
    def __init__(self,parent,side):
        self.parent=parent
        self.side=side
        self.names=[f'wing_{side}_inner',f'wing_{side}_outer']
        root=parent.cfg['wing_roots'][side]
        radius=np.sqrt((X-root[0])**2+((Y-root[1])*.7)**2)
        outer=smooth((radius-95)/170.)
        self.maps=[1-outer,outer]

    def pose(self,t):
        matrices,extra=self.parent.full_pose(t)
        return matrices[3+self.side*2:5+self.side*2],extra


def masked_source(source,alpha):
    rgba=np.array(source)
    rgba[:,:,3]=np.clip(rgba[:,:,3]*alpha,0,255).astype('uint8')
    return Image.fromarray(rgba)


def connected_body(source,seed):
    """Discard detached feather-line scraps on the body side of a wing cut."""
    support=source.getchannel('A').point(lambda a:255 if a>8 else 0)
    ImageDraw.floodfill(support,tuple(seed),128)
    keep=Image.fromarray(np.where(np.asarray(support)==128,255,0).astype('uint8'))
    # Preserve the original antialiasing fringe of the retained silhouette.
    keep=keep.filter(ImageFilter.MaxFilter(5))
    return masked_source(source,np.asarray(keep,dtype=np.float32)/255.)


class LayeredFlightImage:
    """Wings behind a complete torso. Feather/fur overlap hides the wing roots.

    The foot/claw texture never belongs to a wing deformation, even when it
    extends beyond the torso. Inner/outer wing mesh remains continuous.
    """
    def __init__(self,source,template):
        cfg=template.cfg
        left=cfg['wing_cut_left']
        right=[[WORK-x,y] for x,y in left]
        cuts=[mask(poly,1.2,0) for poly in (left,right)]
        self.wings=[]
        for i,poly in enumerate((left,right)):
            # Extra original texture under the static shoulder, not a colored
            # patch. It is concealed by the body's original feather/fur edge.
            root=cfg['wing_roots'][i]
            shoulder_band=smooth((root[1]+100-Y)/65.)
            head_protection=mask(cfg['head'],3,0)
            overlap=np.maximum(cuts[i],mask(poly,1.2,31)*shoulder_band*(1-head_protection))
            self.wings.append(SkinnedImage(masked_source(source,overlap),FlightWing(template,i)))
        body_source=connected_body(masked_source(source,1-np.maximum(*cuts)),cfg['body_pivot'])
        self.body=SkinnedImage(body_source,template)
        self.bone_names=template.names+[name for wing in self.wings for name in wing.template.names]
        self.triangles=np.concatenate([rig.triangles for rig in [*self.wings,self.body]])

    def render(self,t):
        out=Image.new('RGBA',(WORK,WORK))
        folds=0
        for rig in [*self.wings,self.body]:
            im,extra=rig.render(t)
            folds+=extra['folded_triangles']
            out.alpha_composite(im)
        extra['folded_triangles']=folds
        return out,extra


class SkinnedImage:
    def __init__(self,source,template):
        self.source=source
        self.template=template
        rgba=np.asarray(source,dtype=np.float32)/255.
        rgba[:,:,:3]*=rgba[:,:,3:4]
        self.pixels=rgba
        support=np.asarray(source.getchannel('A'))
        bounds=source.getchannel('A').point(lambda a:255 if a>4 else 0).getbbox()
        x0,y0,x1,y1=bounds
        x0,y0=max(0,x0-5),max(0,y0-5)
        x1,y1=min(WORK,x1+5),min(WORK,y1+5)
        xx=list(range(x0,x1,STEP))+[x1]
        yy=list(range(y0,y1,STEP))+[y1]
        self.vertices=np.array([(x,y,1.) for y in yy for x in xx])
        vx=np.minimum(self.vertices[:,0].astype(int),WORK-1)
        vy=np.minimum(self.vertices[:,1].astype(int),WORK-1)
        self.weights=np.stack([m[vy,vx] for m in template.maps])
        self.weights/=np.maximum(self.weights.sum(axis=0,keepdims=True),.0001)
        triangles=[]
        cols=len(xx)
        for row in range(len(yy)-1):
            for col in range(cols-1):
                if support[yy[row]:yy[row+1]+1,xx[col]:xx[col+1]+1].max()==0:
                    continue
                a=row*cols+col
                triangles.extend(((a,a+1,a+cols+1),(a,a+cols+1,a+cols)))
        self.triangles=np.array(triangles)
        self.src_tri=self.vertices[self.triangles,:2].transpose(0,2,1)

    def render(self,t):
        matrices,extra=self.template.pose(t)
        transformed=np.einsum('bij,vj->bvi',np.stack(matrices),self.vertices)[:,:,:2]
        target=np.sum(transformed*self.weights[:,:,None],axis=0)
        q=target[self.triangles]
        systems=np.concatenate((q.transpose(0,2,1),np.ones((len(q),1,3))),axis=1)
        determinants=np.linalg.det(systems)
        inverses=np.linalg.inv(systems)
        out=np.zeros((WORK,WORK,4),dtype=np.float32)
        for k,tri in enumerate(q):
            l=max(0,int(math.floor(tri[:,0].min())))
            r=min(WORK,int(math.ceil(tri[:,0].max()))+1)
            top=max(0,int(math.floor(tri[:,1].min())))
            bot=min(WORK,int(math.ceil(tri[:,1].max()))+1)
            if l>=r or top>=bot:
                continue
            xx,yy=np.meshgrid(np.arange(l,r)+.5,np.arange(top,bot)+.5)
            bary=inverses[k]@np.vstack((xx.ravel(),yy.ravel(),np.ones(xx.size)))
            inside=bary.min(axis=0)>=-1e-6
            if not inside.any():
                continue
            src=self.src_tri[k]@bary[:,inside]
            sx=np.clip(src[0]-.5,0,WORK-1)
            sy=np.clip(src[1]-.5,0,WORK-1)
            ix,iy=np.floor(sx).astype(int),np.floor(sy).astype(int)
            jx,jy=np.minimum(ix+1,WORK-1),np.minimum(iy+1,WORK-1)
            fx,fy=(sx-ix)[:,None],(sy-iy)[:,None]
            samples=(self.pixels[iy,ix]*(1-fx)*(1-fy)+self.pixels[iy,jx]*fx*(1-fy)+
                     self.pixels[jy,ix]*(1-fx)*fy+self.pixels[jy,jx]*fx*fy)
            py,px=np.where(inside.reshape(xx.shape))
            out[py+top,px+l]=samples
        out[:,:,:3]/=np.maximum(out[:,:,3:4],.0001)
        im=Image.fromarray(np.clip(out*255+.5,0,255).astype('uint8'))
        # Geometry diagnostic recorded during rendering; not a game test.
        extra['folded_triangles']=int((determinants<0).sum())
        return im,extra


def font(size):
    for path in ('C:/Windows/Fonts/msyh.ttc','C:/Windows/Fonts/segoeui.ttf'):
        if Path(path).exists():
            return ImageFont.truetype(path,size)
    return ImageFont.load_default()


def preview_frame(im,cfg,extra):
    bg=Image.new('RGBA',(WORK,WORK),BG+(255,))
    shadow=Image.new('RGBA',(WORK,WORK))
    d=ImageDraw.Draw(shadow)
    if cfg['template']=='quadruped':
        d.ellipse((212,843,922,952),fill=(69,67,48,23))
        for foot,lift,hind in extra['feet']:
            x,y=foot
            gy=y+lift
            rx=42 if hind else 58
            d.ellipse((x-rx,gy-8,x+rx,gy+12),fill=(45,46,35,int(47*(1-lift/85))))
    else:
        d.ellipse((360,822,664,864),fill=(64,62,46,25))
    bg.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9)))
    bg.alpha_composite(im)
    return bg.convert('RGB').resize((SIZE,SIZE),Image.Resampling.LANCZOS)


def save_gif(frames,path,duration):
    thumbnails=[im.resize((320,320),Image.Resampling.LANCZOS) for im in frames[::max(1,len(frames)//8)]]
    swatch=Image.new('RGB',(320*4,320*math.ceil(len(thumbnails)/4)))
    for j,im in enumerate(thumbnails):
        swatch.paste(im,((j%4)*320,(j//4)*320))
    palette=swatch.quantize(256,method=Image.Quantize.MEDIANCUT)
    indexed=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
    indexed[0].save(path,save_all=True,append_images=indexed[1:],duration=duration,
                    loop=0,disposal=2,optimize=False)


def export_one(key,cfg):
    started=time.monotonic()
    folder=HERE/key
    (folder/'frames').mkdir(parents=True,exist_ok=True)
    source=Image.open(HERE/'sources'/f'{key}.png').convert('RGBA')
    template=QuadrupedTemplate(cfg) if cfg['template']=='quadruped' else FlightTemplate(cfg)
    rig=SkinnedImage(source,template) if cfg['template']=='quadruped' else LayeredFlightImage(source,template)
    atlas=Image.new('RGBA',(SIZE*8,SIZE*4))
    previews=[]
    all_bounds=[]
    all_folds=[]
    for i in range(N):
        im,extra=rig.render(i/N)
        all_bounds.append(im.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox())
        all_folds.append(extra['folded_triangles'])
        small=im.resize((SIZE,SIZE),Image.Resampling.LANCZOS)
        small.save(folder/'frames'/f'walk_{i:03d}.png')
        atlas.paste(small,((i%8)*SIZE,(i//8)*SIZE))
        previews.append(preview_frame(im,cfg,extra))
    atlas.save(folder/'atlas.png')
    save_gif(previews,folder/'preview.gif',cfg['duration_ms']//N)
    previews[0].save(folder/'poster.png')
    contact=Image.new('RGB',(4*320,2*352),BG)
    d=ImageDraw.Draw(contact)
    for j,i in enumerate(range(0,N,4)):
        contact.paste(previews[i].resize((320,320),Image.Resampling.LANCZOS),((j%4)*320,(j//4)*352))
        d.text(((j%4)*320+10,(j//4)*352+321),f'{cfg["label"]} / {i:02d}',font=font(18),fill='#364533')
    contact.save(folder/'contact.jpg',quality=95)
    meta={
        'id':key,'label':cfg['label'],'template':cfg['template'],
        'source':f'../sources/{key}.png',
        'source_sha256':hashlib.sha256((HERE/'sources'/f'{key}.png').read_bytes()).hexdigest(),
        'frame_count':N,'frame_size':[SIZE,SIZE],
        'frame_duration_ms':cfg['duration_ms']//N,'cycle_ms':cfg['duration_ms'],
        'loop':True,'duplicate_endpoint':False,'atlas':'atlas.png',
        'frames':{f'walk_{i:03d}':[(i%8)*SIZE,(i//8)*SIZE,SIZE,SIZE] for i in range(N)},
        'mesh_step_source_px':STEP,'bones':getattr(rig,'bone_names',template.names),
        'render_bounds':all_bounds,'folded_triangles_per_frame':all_folds,
        'game_modified':False,'motion_generated_from_video':False,
    }
    (folder/'frames.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'id':key,'seconds':round(time.monotonic()-started,1),
                      'triangles':len(rig.triangles),'max_folds':max(all_folds),
                      'margin':min(min(x,y,WORK-r,WORK-b) for x,y,r,b in all_bounds)},ensure_ascii=False),flush=True)
    return previews


def make_pair(keys,configs,previews,duration,path):
    frames=[]
    count=duration//40
    for i in range(count):
        im=Image.new('RGB',(1100,620),BG)
        d=ImageDraw.Draw(im)
        for col,key in enumerate(keys):
            cfg=configs[key]
            idx=round((i*40/cfg['duration_ms'])%1*N)%N
            thumb=previews[key][idx].resize((550,550),Image.Resampling.LANCZOS)
            im.paste(thumb,(col*550,51))
            text=cfg['label']
            d.text((col*550+275,20),text,font=font(26),fill='#263e37',anchor='mm')
            d.text((col*550+275,601),f'{cfg["duration_ms"]/1000:g}s / 32帧',font=font(18),fill='#62705b',anchor='mm')
        frames.append(im)
    save_gif(frames,path,40)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',nargs='*')
    parser.add_argument('--package-only',action='store_true',help='Reuse the previously rendered preview GIFs and PNGs.')
    args=parser.parse_args()
    configs=json.loads((HERE/'rigs.json').read_text('utf-8'))
    keys=args.only or list(configs)
    previews={}
    for key in keys:
        if args.package_only:
            from PIL import ImageSequence
            with Image.open(HERE/key/'preview.gif') as gif:
                previews[key]=[frame.convert('RGB') for frame in ImageSequence.Iterator(gif)]
        else:
            previews[key]=export_one(key,configs[key])
    if set(keys)==set(configs):
        make_pair(['snow_wolf','rift_hound'],configs,previews,1280,HERE/'quadruped-comparison.gif')
        make_pair(['eagle','bat'],configs,previews,1920,HERE/'flight-comparison.gif')
        with zipfile.ZipFile(HERE/'four-monsters-transparent-frames.zip','w',zipfile.ZIP_DEFLATED) as z:
            for key in keys:
                for p in sorted((HERE/key/'frames').glob('*.png')):
                    z.write(p,f'{key}/frames/{p.name}')
                for name in ('atlas.png','frames.json'):
                    z.write(HERE/key/name,f'{key}/{name}')
            for name in ('rigs.json','sources.json','animate.py','prepare_sources.py','README.md'):
                if (HERE/name).exists():
                    z.write(HERE/name,name)
            for p in sorted((HERE/'sources').glob('*.png')):
                z.write(p,f'sources/{p.name}')
        print('Exported two template comparisons and four transparent frame packs.',flush=True)


if __name__=='__main__':
    main()
