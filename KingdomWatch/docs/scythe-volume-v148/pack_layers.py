"""Bake glow into straight RGBA, preserve fixed anchors, pack lossless game atlases."""
import copy
import hashlib
import json
import math
import uuid
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
DEST=PROJECT/'assets/resources/fx'
TEMPLATE=json.loads((DEST/'wind_eye_video_v129.png.meta').read_text('utf8'))
STATS={}

def glow_frame(path,cell,kind):
    a=np.asarray(Image.open(path).convert('RGBA'),dtype=np.float32)/255
    rgb,alpha=a[:,:,:3],a[:,:,3]
    # Bloom from the incandescent edges, not every saturated-red body pixel.
    emission=np.maximum(0,(rgb.mean(axis=2)-.42)/.58)*alpha
    src=Image.fromarray(np.uint8(np.clip(emission,0,1)*255))
    glow=np.zeros(alpha.shape,np.float32)
    radii=[(.65,.50),(2.0,.42),(6.0,.25),(15,.07)]
    if kind=='slash':radii=[(.5,.42),(1.7,.38),(5,.20),(10,.06)]
    for radius,weight in radii:
        glow+=np.asarray(src.filter(ImageFilter.GaussianBlur(radius*2)),np.float32)/255*weight
    # Scarlet bloom retains the dark-red negative space; white is restricted to the cutting lip.
    premul=np.clip(rgb*alpha[:,:,None]+glow[:,:,None]*np.array([1,.08,.015],np.float32),0,1)
    # Keep opaque/dark debris opaque; unpremultiply emission only once for standard alpha blending.
    out_alpha=np.maximum(alpha,premul.max(axis=2))
    out_rgb=premul/np.maximum(out_alpha[:,:,None],1/65535)
    rgba=np.uint8(np.clip(np.dstack([out_rgb,out_alpha]),0,1)*255+.5)
    im=Image.fromarray(rgba).resize(tuple(cell),Image.Resampling.LANCZOS)
    arr=np.array(im)
    arr[:2]=0;arr[-2:]=0;arr[:,:2]=0;arr[:,-2:]=0
    arr[arr[:,:,3]==0,:3]=0
    return Image.fromarray(arr)

def image_meta(name,size):
    meta=copy.deepcopy(TEMPLATE)
    uid=str(uuid.uuid5(uuid.NAMESPACE_URL,'kingdom-watch/fx/'+name))
    meta['uuid']=uid
    meta['userData']['redirect']=uid+'@6c48a'
    for key,sub in meta['subMetas'].items():
        sub['uuid']=uid+'@'+key;sub['displayName']=name
        data=sub['userData']
        if sub['importer']=='texture': data['imageUuidOrDatabaseUri']=uid
        else:
            w,h=size
            data.update(width=w,height=h,rawWidth=w,rawHeight=h,imageUuidOrDatabaseUri=uid+'@6c48a',packable=False)
            data['vertices']={'rawPosition':[-w//2,-h//2,0,w//2,-h//2,0,-w//2,h//2,0,w//2,h//2,0],
                'indexes':[0,1,2,2,1,3],'uv':[0,h,w,h,0,0,w,0],
                'nuv':[0,0,1,0,0,1,1,1],'minPos':[-w//2,-h//2,0],'maxPos':[w//2,h//2,0]}
    return meta

for kind in ('spin',):
    directory=OUT/'layers'/kind
    m=json.loads((directory/'pass.json').read_text('utf8'))
    w,h=m['cellSize'];cols=m.pop('columns');gutter=2
    atlas=Image.new('RGBA',((w+4)*cols,(h+4)*math.ceil(m['frameCount']/cols)))
    m['frames']=[];counts=[]
    for i in range(m['frameCount']):
        im=glow_frame(directory/f'{i:03d}.png',(w,h),kind)
        if not m['loop'] and i>=m['frameCount']-5:
            fade=(m['frameCount']-1-i)/4
            arr=np.array(im);arr[:,:,3]=np.uint8(arr[:,:,3].astype(np.float32)*fade)
            arr[arr[:,:,3]==0,:3]=0;im=Image.fromarray(arr)
        x,y=(i%cols)*(w+4)+gutter,(i//cols)*(h+4)+gutter
        atlas.paste(im,(x,y));m['frames'].append([x,y,w,h])
        counts.append(int(np.count_nonzero(np.asarray(im)[:,:,3])))
        if i in [3,7,13]: im.save(OUT/f'{kind}-{i:02d}.png')
    name='scythe_'+kind+'_v148'
    target=DEST/(name+'.png');atlas.save(target,optimize=True)
    m.update(source='scythe-volume-v148/build_vortex.py',alpha='straight',gutter=gutter)
    (DEST/(name+'.frames.json')).write_text(json.dumps(m,separators=(',',':'))+'\n',encoding='utf8')
    (DEST/(name+'.png.meta')).write_text(json.dumps(image_meta(name,atlas.size),indent=2)+'\n',encoding='utf8')
    json_meta={'ver':'2.0.1','importer':'json','imported':True,
        'uuid':str(uuid.uuid5(uuid.NAMESPACE_URL,'kingdom-watch/fx/'+name+'.frames')),
        'files':['.json'],'subMetas':{},'userData':{}}
    (DEST/(name+'.frames.json.meta')).write_text(json.dumps(json_meta,indent=2)+'\n',encoding='utf8')
    STATS[kind]={'size':atlas.size,'frames':m['frameCount'],'bytes':target.stat().st_size,
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'minVisiblePixels':min(counts),'maxVisiblePixels':max(counts),
        'anchor':m['anchor'],'alpha':'straight','gutter':gutter}
(OUT/'atlas-audit.json').write_text(json.dumps(STATS,indent=2)+'\n',encoding='utf8')
print(json.dumps(STATS,indent=2))
