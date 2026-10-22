"""Bake five original-image monsters with the pinned-field architecture.

--draft writes key poses for inspection. Full mode writes transparent frames,
two atlas sizes, synchronized legacy comparisons, metadata and an HTML viewer.
"""
from __future__ import annotations
import argparse,hashlib,json,math,time,zipfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageSequence,ImageFilter

from engine import (TAU,smooth,polygon_mask,sample_mask,RotationStack,FlightField,
                    make_layer,render,geometry_check)

HERE=Path(__file__).resolve().parent
SIZE=512
BG=(237,231,214)


def json_write(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size)


def layers_for(cfg):
    rgba=np.asarray(Image.open(HERE/cfg['input']).convert('RGBA'),dtype=np.float32)/255.
    h,w=rgba.shape[:2]
    if cfg['type']!='flight':
        protect=polygon_mask((w,h),cfg['protect'],7) if cfg.get('protect') else 0
        operations=[]
        for original in cfg['operations']:
            op=dict(original)
            op['_mask']=polygon_mask((w,h),op['polygon'],op.get('feather',7))*(1-protect)
            operations.append(op)
        stack=RotationStack((w,h),operations,cfg['global'])
        return [make_layer('continuous-body',rgba,np.ones((h,w)),stack,18 if cfg['type']=='biped' else 17)]
    m=cfg['layer_masks'];f=cfg['flight'];yy,xx=np.indices((h,w));radius=np.abs(xx-f['center_x'])
    body_width=m['body_width']+m['body_width_extra']*smooth(*m['body_width_y'],yy)
    body=1-smooth(body_width-m['body_feather'],body_width+m['body_feather'],radius)
    head=polygon_mask((w,h),m['head_protect'],3) if m.get('head_protect') else 0
    protected=None
    if m.get('head_protect'):
        # Preserve the cut contour around ears and its neighbouring texture.
        # Inner 20 px are fully stationary; another soft band joins the wing.
        hard=Image.fromarray(np.uint8(polygon_mask((w,h),m['head_protect'],0)*255))
        inner=np.asarray(hard.filter(ImageFilter.MaxFilter(41)),dtype=np.float32)/255.
        outer=np.asarray(hard.filter(ImageFilter.MaxFilter(71)).filter(ImageFilter.GaussianBlur(12)),dtype=np.float32)/255.
        protected=np.maximum(inner,outer)
    body=np.maximum(body,head)
    if m.get('lower_body_y'):body=np.maximum(body,smooth(*m['lower_body_y'],yy))
    wing_height=1-smooth(*m['wing_y'],yy)
    result=[]
    for name,side in [('left',-1),('right',1)]:
        mask=smooth(*m['wing_x'],side*(xx-f['center_x']))*wing_height*(1-head)
        result.append(make_layer(name,rgba,mask,FlightField(f,name,protected),18 if w>1200 else 15))
    result.append(make_layer('body',rgba,body,FlightField(f,'body'),18 if w>1200 else 15))
    return result


def camera(cfg,evidence):
    low=np.array(evidence['low']);high=np.array(evidence['high'])
    # One camera for BOTH old and new, including between-frame extrema.
    a=cfg['legacy_work_affine'];s=a['scale'];offset=np.array(a['offset'])
    for x0,y0,x1,y1 in cfg['legacy_bounds']:
        low=np.minimum(low,(np.array([x0,y0])-offset)/s)
        high=np.maximum(high,(np.array([x1,y1])-offset)/s)
    scale=float(np.min((SIZE-56)/(high-low)))
    shift=np.array([SIZE/2,SIZE/2])-(low+high)/2*scale
    return scale,shift


def old_frame(cfg,key,i,scale,offset):
    with Image.open(HERE/'legacy'/f'{key}.png') as atlas:
        cell=atlas.width//8
        tile=atlas.crop(((i%8)*cell,(i//8)*cell,(i%8+1)*cell,(i//8+1)*cell))
    a=cfg['legacy_work_affine'];work=np.array(cfg['legacy_work_size'])
    # source = (legacy_pixel * work/cell - legacy_offset) / legacy_scale
    factors=work/cell/a['scale']*scale
    shift=offset-np.array(a['offset'])/a['scale']*scale
    coefficients=(1/factors[0],0,-shift[0]/factors[0],0,1/factors[1],-shift[1]/factors[1])
    return tile.transform((SIZE,SIZE),Image.Transform.AFFINE,coefficients,Image.Resampling.BICUBIC)


def on_background(frame,color=BG):
    out=Image.new('RGBA',frame.size,(*color,255));out.alpha_composite(frame)
    return out.convert('RGB')


def save_gif(frames,path,ms):
    thumb=Image.new('RGB',(256*4,256*2))
    for j,i in enumerate(np.linspace(0,len(frames)-1,8,dtype=int)):
        thumb.paste(frames[i].resize((256,256),Image.Resampling.LANCZOS),((j%4)*256,(j//4)*256))
    palette=thumb.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    frames=[p.quantize(palette=palette,dither=Image.Dither.NONE) for p in frames]
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=ms,loop=0,disposal=2,optimize=False)


def flight_probes(layers,cfg):
    result=[]
    for i,layer in enumerate(layers[:2]):
        root=np.array(cfg['flight']['roots'][i]);side=-1 if i==0 else 1
        target=root+np.array([side*(cfg['flight']['root_falloff'][1]+65),15])
        ys,xs=np.where(layer.texture[:,:,3]>.98)
        points=np.stack((xs+.5,ys+.5),axis=1)
        result.append(points[np.argmin(np.sum((points-target)**2,axis=1))])
    return result


def connected(frame,layers,cfg,phase,scale,offset,probes):
    support=frame.getchannel('A').point(lambda x:255 if x>=128 else 0)
    centre=layers[-1].field(np.array([cfg['pivot']],dtype=float),phase)[0]*scale+offset
    cx,cy=np.round(centre).astype(int)
    if support.getpixel((cx,cy))!=255:return False
    ImageDraw.floodfill(support,(cx,cy),128)
    for layer,probe in zip(layers[:2],probes):
        x,y=np.round(layer.field(np.array([probe]),phase)[0]*scale+offset).astype(int)
        tile=np.asarray(support.crop((x-3,y-3,x+4,y+4)))
        if not np.any(tile==128):return False
    return True


def pin_check(layers,cfg):
    errors=[]
    for i,layer in enumerate(layers[:2]):
        root=np.array(cfg['flight']['roots'][i]);radius=cfg['flight']['root_falloff'][0]*.8
        a=np.linspace(0,TAU,17);points=np.stack((root[0]+radius*np.cos(a),root[1]+radius*np.sin(a)),axis=-1)
        errors.extend(float(np.max(np.abs(layer.field(points,t)-layers[-1].field(points,t)))) for t in np.linspace(0,TAU,129))
    return max(errors)


def contact(frames,path,cfg):
    out=Image.new('RGB',(4*256,2*285),BG);d=ImageDraw.Draw(out)
    for j,i in enumerate(range(0,len(frames),4)):
        out.paste(on_background(frames[i]).resize((256,256),Image.Resampling.LANCZOS),((j%4)*256,(j//4)*285))
        d.text(((j%4)*256+12,(j//4)*285+253),f'{cfg["label"]} / {i:02d}',font=font(16),fill='#304453')
    out.save(path,quality=94)


def joint_contact(frames,path,cfg,scale,offset):
    if cfg['type']=='flight':
        roots=np.array(cfg['flight']['roots']);lo=roots.min(axis=0)-[70,85];hi=roots.max(axis=0)+[70,100]
    elif cfg['type']=='biped':lo=np.array([385,425]);hi=np.array([880,655])
    else:
        pivots=[op['pivot'] for op in cfg['operations'] if op['id'].endswith('_root')]
        lo=np.array(pivots).min(axis=0)-[40,45];hi=np.array(pivots).max(axis=0)+[40,100]
    box=(*np.floor(lo*scale+offset).astype(int),*np.ceil(hi*scale+offset).astype(int))
    out=Image.new('RGB',(1000,420),BG);d=ImageDraw.Draw(out)
    for j,i in enumerate((0,8,16,24)):
        crop=on_background(frames[i]).crop(box)
        zoom=min(480/crop.width,176/crop.height)
        crop=crop.resize((round(crop.width*zoom),round(crop.height*zoom)),Image.Resampling.LANCZOS)
        x=(j%2)*500+(500-crop.width)//2;y=(j//2)*210+8
        out.paste(crop,(x,y));d.text(((j%2)*500+14,(j//2)*210+183),f'{cfg["label"]} {i:02d} / 连接区',font=font(17),fill='#304453')
    out.save(path,quality=95)


def bake_one(key,cfg,draft=False):
    start=time.monotonic();folder=HERE/key;folder.mkdir(exist_ok=True)
    layers=layers_for(cfg);evidence=geometry_check(layers)
    scale,offset=camera(cfg,evidence)
    evidence['camera']={'scale':scale,'offset':offset.tolist(),'common_with_legacy':True}
    evidence['same_source_image']=True;evidence['game_started']=False
    if cfg['type']=='flight':
        evidence['root_collar_relative_motion_max']=pin_check(layers,cfg)
        if evidence['root_collar_relative_motion_max']>1e-7:raise ValueError('Root collars are not pinned')
    indices=list(range(0,32,8)) if draft else list(range(32))
    frames=[];bounds=[];connections=[];probes=flight_probes(layers,cfg) if cfg['type']=='flight' else []
    for i in indices:
        phase=i/32*TAU
        image=render(layers,phase,scale,offset,SIZE);frames.append(image);bounds.append(image.getbbox())
        if probes:connections.append(connected(image,layers,cfg,phase,scale,offset,probes))
        if not draft:
            (folder/'frames').mkdir(exist_ok=True);image.save(folder/'frames'/f'{key}_{i:03d}.png')
        if i%8==0:print(f'{key}: {i+1}/32 rendered',flush=True)
    evidence['wing_body_connected_frames']=connections
    evidence['visible_bounds']=bounds
    evidence['seconds']=round(time.monotonic()-start,2)
    evidence['mesh_vertices']=sum(len(l.vertices) for l in layers)
    evidence['mesh_triangles']=sum(len(l.triangles) for l in layers)
    if draft:
        out=Image.new('RGB',(SIZE*2,SIZE*2),BG)
        for j,im in enumerate(frames):out.paste(on_background(im),((j%2)*SIZE,(j//2)*SIZE))
        out.save(folder/'draft.jpg',quality=94);json_write(folder/'draft-check.json',evidence)
        print(json.dumps({'id':key,'draft':True,'connected':connections,'minimum_area':evidence['minimum_signed_cross_product'],'seconds':evidence['seconds']},ensure_ascii=False),flush=True)
        return
    if connections and not all(connections):raise ValueError('A wing disconnects from the body in '+key)
    for size in (512,256):
        sheet=Image.new('RGBA',(size*8,size*4))
        for i,im in enumerate(frames):sheet.paste(im.resize((size,size),Image.Resampling.LANCZOS),((i%8)*size,(i//8)*size))
        sheet.save(folder/f'atlas-{size}.png')
        pivot=(np.array(cfg['pivot'])*scale+offset)/SIZE
        json_write(folder/f'atlas-{size}.json',{'id':key,'animation':'fly' if cfg['type']=='flight' else 'walk','frame_count':32,'frame_ms':cfg['cycle_ms']//32,'cycle_ms':cfg['cycle_ms'],'loop':True,'duplicate_endpoint':False,'frame_size':[size,size],'atlas':f'atlas-{size}.png','alpha_mode':'straight','pivot_top_left_normalized':pivot.tolist(),'frames':{f'{key}_{i:03d}':[(i%8)*size,(i//8)*size,size,size] for i in range(32)},'source_sha256':hashlib.sha256((HERE/cfg['input']).read_bytes()).hexdigest(),'technique':'pinned regions; angular rotation fields; fixed UV; premultiplied 2x bake','game_integrated':False})
    save_gif([on_background(im) for im in frames],folder/'preview.gif',cfg['cycle_ms']//32)
    frames[0].save(folder/'preview.apng',format='PNG',save_all=True,append_images=frames[1:],duration=cfg['cycle_ms']//32,loop=0,disposal=0,blend=0)
    on_background(frames[0]).save(folder/'poster.png')
    contact(frames,folder/'contact.jpg',cfg);joint_contact(frames,folder/'joint-details.jpg',cfg,scale,offset)
    comparisons=[]
    for i,im in enumerate(frames):
        pair=Image.new('RGB',(1024,570),BG);d=ImageDraw.Draw(pair)
        pair.paste(on_background(old_frame(cfg,key,i,scale,offset)),(0,42));pair.paste(on_background(im),(512,42))
        d.text((256,18),'旧版',font=font(22),fill='#596165',anchor='mm');d.text((768,18),'新版 · 固定连接区',font=font(22),fill='#244c60',anchor='mm')
        d.line((511,43,511,554),fill='#b8b09c',width=1);comparisons.append(pair)
    save_gif(comparisons,folder/'old-new.gif',cfg['cycle_ms']//32)
    json_write(folder/'validation.json',evidence)
    print(json.dumps({'id':key,'frames':32,'seconds':evidence['seconds'],'connected':all(connections) if connections else 'single continuous layer','minimum_area':evidence['minimum_signed_cross_product']},ensure_ascii=False),flush=True)


def pair_gallery(keys,name,duration,configs):
    frames=[];sources={}
    for key in keys:sources[key]=[Image.open(HERE/key/'frames'/f'{key}_{i:03d}.png').convert('RGBA') for i in range(32)]
    for t in range(0,duration,40):
        image=Image.new('RGB',(1024,570),BG);d=ImageDraw.Draw(image)
        for j,key in enumerate(keys):
            cfg=configs[key];i=int((t%cfg['cycle_ms'])/cfg['cycle_ms']*32)%32
            image.paste(on_background(sources[key][i]),(j*512,43))
            d.text((j*512+256,20),cfg['label']+' · 新版',font=font(22),fill='#244c60',anchor='mm')
        frames.append(image)
    save_gif(frames,HERE/name,40)


def package(configs):
    pair_gallery(['snow_wolf','rift_hound'],'quadruped-new.gif',1280,configs)
    pair_gallery(['eagle','bat'],'flight-new.gif',1920,configs)
    for name,key in [('biped-new.gif','worker')]:
        (HERE/name).write_bytes((HERE/key/'preview.gif').read_bytes())
    write_viewer(configs)
    include=['engine.py','bake.py','prepare.py','rigs.json','sources.json','README.md','preview.html','validate.py','validation-summary.json','asset-sha256.json']
    archive=HERE/'five-monsters-pinned-mesh-v4.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name in include:
            if (HERE/name).is_file():z.write(HERE/name,name)
        for directory in ['inputs','legacy',*configs]:
            for p in sorted((HERE/directory).rglob('*')):
                if p.is_file() and '__pycache__' not in p.parts and p.name not in ('draft.jpg','draft-check.json'):z.write(p,p.relative_to(HERE).as_posix())
        for name in ('biped-new.gif','quadruped-new.gif','flight-new.gif'):z.write(HERE/name,name)
    print('Packaged '+str(round(archive.stat().st_size/1048576,1))+' MiB',flush=True)


def write_viewer(configs):
    data={key:{'label':cfg['label'],'cycle':cfg['cycle_ms'],'camera':json.loads((HERE/key/'validation.json').read_text('utf-8'))['camera'],'legacy':cfg['legacy_work_affine'],'legacySize':cfg['legacy_work_size']} for key,cfg in configs.items()}
    text='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>怪物动作 · 新架构 v4</title>
<style>*{box-sizing:border-box}body{margin:0;background:#14222c;color:#f5efdc;font:16px system-ui}main{max-width:1140px;padding:24px;margin:auto}h1{font-size:25px}p{line-height:1.7;color:#c7d0d3}nav{position:sticky;top:0;padding:14px;background:#14222cf5;display:flex;gap:12px;flex-wrap:wrap;z-index:2}button,select,input{font:inherit;padding:8px}section{margin:20px 0;background:#223743;border-radius:10px;padding:16px}h2{font-size:20px}canvas{display:block;width:100%;height:auto}.labels{display:flex;justify-content:space-around;color:#ffda7a}a{color:#f3cd77}.stage{background:#ede7d6}input{width:200px}</style>
<main><h1>双足 / 四足 / 飞行 · 固定连接区域与角度场 v4</h1><p>左为旧版，右为新版；同原图、同周期、同一套取景与缩放。图像只在本页播放，不启动游戏。可暂停后拖动相位，检查颈部、腋下、髋部和翅根。</p>
<nav><button id="play">暂停</button><select id="speed"><option value="1">正常速度</option><option value="0.5">半速</option><option value="0.25">四分之一速</option></select><select id="bg"><option value="#ede7d6">米色背景</option><option value="#213a4b">深色背景</option><option value="checker">透明棋盘</option></select><label>统一相位 <input id="phase" type="range" min="0" max="31" value="0"></label></nav><div id="cards"></div>
<p><a href="five-monsters-pinned-mesh-v4.zip">下载透明序列帧、图集与源代码</a> · 具体检查范围见 README。</p></main><script>
const data=DATA,cards=[],holder=document.querySelector('#cards');let playing=true,elapsed=0,last=performance.now(),manual=0;
for(const [id,cfg] of Object.entries(data)){const s=document.createElement('section');s.innerHTML=`<h2>${cfg.label} · ${cfg.cycle/1000} 秒 / 32 帧</h2><div class="labels"><span>旧版</span><span>新版 · 固定连接区</span></div><canvas width="1024" height="512"></canvas><p><a href="${id}/preview.gif">新版 GIF</a> · <a href="${id}/old-new.gif">新旧对照 GIF</a> · <a href="${id}/joint-details.jpg">连接区放大</a></p>`;holder.append(s);const current=new Image(),old=new Image();current.src=id+'/atlas-512.png';old.src='legacy/'+id+'.png';cards.push({cfg,current,old,canvas:s.querySelector('canvas')});}
const play=document.querySelector('#play'),speed=document.querySelector('#speed'),bg=document.querySelector('#bg'),slider=document.querySelector('#phase');play.onclick=()=>{playing=!playing;play.textContent=playing?'暂停':'播放'};slider.oninput=()=>{playing=false;manual=Number(slider.value);play.textContent='播放'};document.addEventListener('visibilitychange',()=>last=performance.now());
function draw(now){let dt=Math.min(100,now-last);last=now;if(playing&&!document.hidden)elapsed+=dt*Number(speed.value);for(const c of cards){const {cfg,current,old,canvas}=c,ctx=canvas.getContext('2d'),i=playing?Math.floor((elapsed%cfg.cycle)/cfg.cycle*32):manual;ctx.fillStyle=bg.value==='checker'?'#e4e4e4':bg.value;ctx.fillRect(0,0,1024,512);if(bg.value==='checker'){ctx.fillStyle='#bec4c9';for(let y=0;y<512;y+=24)for(let x=0;x<1024;x+=24)if((x/24+y/24)%2)ctx.fillRect(x,y,24,24)}if(current.complete&&current.naturalWidth)ctx.drawImage(current,i%8*512,Math.floor(i/8)*512,512,512,512,0,512,512);if(old.complete&&old.naturalWidth){const a=cfg.legacy,s=cfg.camera.scale,o=cfg.camera.offset,w=cfg.legacySize;ctx.save();ctx.beginPath();ctx.rect(0,0,512,512);ctx.clip();ctx.drawImage(old,i%8*512,Math.floor(i/8)*512,512,512,o[0]-a.offset[0]/a.scale*s,o[1]-a.offset[1]/a.scale*s,w[0]/a.scale*s,w[1]/a.scale*s);ctx.restore()}ctx.strokeStyle='#a9aa9e';ctx.beginPath();ctx.moveTo(512,0);ctx.lineTo(512,512);ctx.stroke();}requestAnimationFrame(draw)}requestAnimationFrame(draw);
</script></html>'''
    (HERE/'preview.html').write_text(text.replace('DATA',json.dumps(data,ensure_ascii=False)),encoding='utf-8')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='*');parser.add_argument('--draft',action='store_true');parser.add_argument('--package-only',action='store_true');args=parser.parse_args()
    configs=json.loads((HERE/'rigs.json').read_text('utf-8'))
    if not args.package_only:
        for key in (args.only or configs):bake_one(key,configs[key],args.draft)
    if not args.draft and not args.only:package(configs)


if __name__=='__main__':main()
