"""Pinned rotation fields -> continuous triangle mesh -> offline RGBA sprites.

No coordinate averaging between bone poses. Every joint has a finite stationary
collar; angles, rather than transformed positions, fade through that collar.
Original UVs never change. No generator, game engine, browser or network.
"""
from __future__ import annotations
from dataclasses import dataclass
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TAU=math.tau


def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0.,1.)
    return t*t*(3-2*t)


def polygon_mask(size,poly,feather=5):
    image=Image.new('L',size)
    ImageDraw.Draw(image).polygon([tuple(p) for p in poly],fill=255)
    if feather:image=image.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(image,dtype=np.float32)/255.


def sample(texture,p):
    """Bilinear inverse UV lookup, with premultiplied RGB and pixel centres."""
    h,w=texture.shape[:2]
    x=np.clip(p[...,0]-.5,0,w-1.00001);y=np.clip(p[...,1]-.5,0,h-1.00001)
    ix=x.astype(np.int32);iy=y.astype(np.int32)
    fx=(x-ix)[...,None];fy=(y-iy)[...,None]
    return ((texture[iy,ix]*(1-fx)+texture[iy,ix+1]*fx)*(1-fy)
            +(texture[iy+1,ix]*(1-fx)+texture[iy+1,ix+1]*fx)*fy)


def sample_mask(mask,points):
    h,w=mask.shape
    x=np.clip(points[:,0],0,w-1.00001);y=np.clip(points[:,1],0,h-1.00001)
    ix=x.astype(np.int32);iy=y.astype(np.int32);fx=x-ix;fy=y-iy
    return (mask[iy,ix]*(1-fx)+mask[iy,ix+1]*fx)*(1-fy)+(mask[iy+1,ix]*(1-fx)+mask[iy+1,ix+1]*fx)*fy


def rotate(points,pivot,angles):
    d=points-np.asarray(pivot);c=np.cos(angles);s=np.sin(angles)
    return np.stack((d[:,0]*c-d[:,1]*s,d[:,0]*s+d[:,1]*c),axis=-1)+pivot


def curve(phase,spec):
    a=phase+spec.get('phase',0.)
    if spec.get('kind')=='lift':v=max(0.,math.sin(a))**2
    else:v=math.sin(a)
    return (spec.get('bias',0.)+spec.get('amplitude',0.)*v+spec.get('harmonic',0.)*math.sin(2*a)
            +spec.get('lift_amplitude',0.)*max(0.,math.sin(a+spec.get('lift_phase',0.)))**2)


class RotationStack:
    """Sequential angular fields. Pivots follow preceding fields consistently.

    Whole-body single meshes use this for legs/arms. Masks select influence,
    not cutouts, so there is no independently moving edge at an armpit/hip.
    """
    def __init__(self,size,operations,global_motion):
        self.size=size;self.operations=operations;self.global_motion=global_motion
        self.masks=[op.get('_mask') for op in operations]

    def __call__(self,points,phase):
        pivots=np.array([op['pivot'] for op in self.operations],dtype=float)
        src=np.concatenate((points,pivots));q=src.copy();n=len(points)
        for i,op in enumerate(self.operations):
            amount=curve(phase,op['curve'])
            # Compact limb masks are not radial. Advect the angular/translation
            # field in small steps so its fading boundary does not fold when
            # a hand/foot travels a sizeable distance near that boundary.
            pivot=q[n+i].copy();steps=10
            for _ in range(steps):
                distance=np.linalg.norm(q-pivot,axis=1)
                weight=smooth(*op['falloff'],distance)
                if self.masks[i] is not None:weight*=sample_mask(self.masks[i],q)
                if op['type']=='rotation':q=rotate(q,pivot,np.deg2rad(amount)/steps*weight)
                elif op['type']=='translation':q+=np.array(op['axis'])*amount/steps*weight[:,None]
                else:raise ValueError(op['type'])
        return self.global_pose(q[:n],phase)

    def global_pose(self,q,phase):
        g=self.global_motion
        angle=np.deg2rad(g.get('roll',0.)*math.sin(phase))
        q=rotate(q,np.array(g['pivot']),np.full(len(q),angle))
        q+=np.array([g.get('sway',0.)*math.sin(phase),g.get('bob',0.)*math.cos(2*phase+.2)])
        return q


class FlightField:
    """Finite pinned root + radial angular twist, following the supplied guide."""
    def __init__(self,cfg,part,protected=None):self.cfg=cfg;self.part=part;self.protected=protected

    def __call__(self,points,phase):
        cfg=self.cfg;q=points.copy()
        if self.part!='body':
            side=-1 if self.part=='left' else 1
            root=np.array(cfg['roots'][0 if side==-1 else 1])
            flap=cfg['bias']-cfg['amplitude']*math.cos(phase)+cfg['harmonic']*math.sin(2*phase)
            tip=-cfg['tip_amplitude']*math.cos(phase-cfg['tip_delay'])
            steps=16 if self.protected is not None else 1
            for _ in range(steps):
                dist=np.linalg.norm(q-root,axis=1)
                angle=smooth(*cfg['root_falloff'],dist)*(flap+tip*smooth(*cfg['tip_falloff'],dist))
                if self.protected is not None:angle*=1-sample_mask(self.protected,q)
                q=rotate(q,root,side*angle/steps)
        # Identical body motion is applied to every layer, including the collar.
        y=points[:,1];x=points[:,0]
        central=1-smooth(*cfg['central_falloff'],np.abs(x-cfg['center_x']))
        q[:,1]+=cfg['bob']*math.cos(phase-.60)
        q[:,1]+=central*smooth(*cfg['tail_y'],y)*cfg['tail_y_amplitude']*math.sin(phase-.75)
        q[:,0]+=central*smooth(*cfg['feet_y'],y)*cfg['feet_x_amplitude']*math.sin(phase-1.)
        return q


@dataclass
class Layer:
    name:str
    texture:np.ndarray
    vertices:np.ndarray
    triangles:np.ndarray
    field:object


def make_layer(name,rgba,mask,field,step):
    tex=rgba.copy();tex[:,:,3]*=mask
    ys,xs=np.where(tex[:,:,3]>.005)
    if not len(xs):raise ValueError('Empty layer '+name)
    h,w=tex.shape[:2]
    gx=np.linspace(max(0,xs.min()-4),min(w-1,xs.max()+5),max(3,math.ceil((xs.max()-xs.min()+9)/step)+1))
    gy=np.linspace(max(0,ys.min()-4),min(h-1,ys.max()+5),max(3,math.ceil((ys.max()-ys.min()+9)/step)+1))
    xx,yy=np.meshgrid(gx,gy);v=np.stack((xx,yy),axis=-1).reshape(-1,2)
    tri=[];cols=len(gx)
    for j in range(len(gy)-1):
        for i in range(cols-1):
            l=max(0,int(gx[i])-1);r=min(w,int(gx[i+1])+2)
            t=max(0,int(gy[j])-1);b=min(h,int(gy[j+1])+2)
            if np.max(tex[t:b,l:r,3])<=0:continue
            a=j*cols+i;tri.extend(((a,a+1,a+cols+1),(a,a+cols+1,a+cols)))
    tex[:,:,:3]*=tex[:,:,3:4]
    layer=Layer(name,tex,v,np.array(tri,dtype=np.int32),field)
    layer.pose_cache={}
    return layer


def mapped(layer,phase):
    key=round(phase%TAU,10)
    if key not in layer.pose_cache:layer.pose_cache[key]=layer.field(layer.vertices,phase)
    return layer.pose_cache[key]


def areas(layer,phase):
    q=mapped(layer,phase)[layer.triangles]
    a=q[:,1]-q[:,0];b=q[:,2]-q[:,0]
    return a[:,0]*b[:,1]-a[:,1]*b[:,0]


def raster(layer,phase,scale,offset,size):
    target=(mapped(layer,phase)*scale+offset)*2
    canvas=np.zeros((size*2,size*2,4),dtype=np.float32)
    for indices in layer.triangles:
        p,q,r=target[indices]
        area=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
        if area<=1e-8:raise ValueError('Collapsed/flipped '+layer.name)
        low=np.maximum(np.floor(np.min((p,q,r),axis=0)).astype(int),0)
        high=np.minimum(np.ceil(np.max((p,q,r),axis=0)).astype(int),size*2-1)
        if np.any(high<low):continue
        xx,yy=np.meshgrid(np.arange(low[0],high[0]+1)+.5,np.arange(low[1],high[1]+1)+.5)
        b=((xx-p[0])*(r[1]-p[1])-(yy-p[1])*(r[0]-p[0]))/area
        c=((q[0]-p[0])*(yy-p[1])-(q[1]-p[1])*(xx-p[0]))/area
        take=(b>=-1e-7)&(c>=-1e-7)&(b+c<=1+1e-7)
        if not take.any():continue
        uv=layer.vertices[indices[0]]+b[take,None]*(layer.vertices[indices[1]]-layer.vertices[indices[0]])+c[take,None]*(layer.vertices[indices[2]]-layer.vertices[indices[0]])
        tile=canvas[low[1]:high[1]+1,low[0]:high[0]+1]
        tile[take]=sample(layer.texture,uv)
    return canvas


def render(layers,phase,scale,offset,size=512):
    out=np.zeros((size*2,size*2,4),dtype=np.float32)
    for layer in layers:
        patch=raster(layer,phase,scale,offset,size)
        out=patch+out*(1-patch[:,:,3:4])
    # Filter all four premultiplied channels before converting to straight RGBA.
    small=np.stack([np.asarray(Image.fromarray(out[:,:,i]).resize((size,size),Image.Resampling.LANCZOS)) for i in range(4)],axis=-1)
    small=np.clip(small,0,1);small[:,:,:3]/=np.maximum(small[:,:,3:4],1e-7)
    small[small[:,:,3]<1/510,:3]=0
    return Image.fromarray(np.uint8(np.clip(small,0,1)*255+.5))


def geometry_check(layers,samples=129):
    low=np.array([np.inf,np.inf]);high=-low;minimum=np.inf;endpoint=0.;velocity=0.
    for phase in np.linspace(0,TAU,samples):
        for layer in layers:
            q=mapped(layer,phase);low=np.minimum(low,q.min(axis=0));high=np.maximum(high,q.max(axis=0))
            minimum=min(minimum,float(areas(layer,phase).min()))
    for layer in layers:
        v=layer.vertices;f=layer.field;eps=1e-5
        endpoint=max(endpoint,float(np.max(np.abs(f(v,0)-f(v,TAU)))))
        # Symmetric finite differences test the derivative on either side of wrap.
        dv0=(f(v,eps)-f(v,-eps))/(2*eps)
        dv1=(f(v,TAU+eps)-f(v,TAU-eps))/(2*eps)
        velocity=max(velocity,float(np.max(np.abs(dv0-dv1))))
    if minimum<=0:raise ValueError('Dense phase check found a fold: '+str(minimum))
    return {'phases':samples,'minimum_signed_cross_product':minimum,'periodic_position_max_error':endpoint,'periodic_velocity_max_error':velocity,'low':low.tolist(),'high':high.tolist()}
