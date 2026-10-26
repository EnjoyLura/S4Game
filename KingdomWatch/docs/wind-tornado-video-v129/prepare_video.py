"""User video -> fixed-canvas straight-alpha flipbook + image-only preview.
No game/engine/browser/audio execution. Original order plus six seam-only flow frames.
"""
import argparse, hashlib, json, shutil, uuid, sys
from pathlib import Path
import imageio.v2 as iio
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-wind-video-deps'))
import cv2

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
COLS=8
CONFIGS={
    'tornado':{'cell':(320,360),'crop':(0,255,720,1055),'ground':(360,940),'speed':1.5,'widthPerRadius':3.0,'size':(720,1280)},
    'eye':{'cell':(384,224),'crop':(90,35,1190,665),'ground':(640,340),'speed':1.0,'widthPerRadius':2.7,'size':(1280,720)},
}

def key(frame,cfg):
    rgb=frame.astype(np.float32)
    spill=np.maximum(0,np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1])
    saturation=spill/np.maximum(16,np.maximum(rgb[:,:,0],rgb[:,:,2]))
    # This source has a textured magenta plate, not a black matte. Reject
    # magenta saturation, retaining neutral dust, green light and yellow leaves.
    alpha=np.clip(1-saturation/.23,0,1)
    alpha=alpha*alpha*(3-2*alpha)
    # Chroma rejection alone retains the video's gray-purple backing as opaque
    # smoke. Wind light needs positive green/cyan or an actually bright core.
    # Keep the neutral base dust separately instead of keying all gray alike.
    signal=np.maximum((rgb[:,:,1]-np.minimum(rgb[:,:,0],rgb[:,:,2])-12)/60,
        (rgb[:,:,1]-110)/130)
    wind=np.clip(signal,0,1)
    yy,xx=np.indices(alpha.shape)
    if cfg['size']==(720,1280):
        dust_y=np.clip((yy-790)/110,0,1);dust_y=dust_y*dust_y*(3-2*dust_y)
        dust_oval=np.clip(1-((xx-360)/300)**4-((yy-905)/160)**4,0,1)
        coverage=np.maximum(wind,dust_y*dust_oval*.68)
    else:coverage=wind
    alpha*=coverage
    # Soft low-alpha cleanup, rather than eroding or adding a dark outline.
    knee=np.clip((alpha-.015)/.055,0,1);alpha*=knee*knee*(3-2*knee)
    rgb[:,:,0]-=spill;rgb[:,:,2]-=spill
    alpha*=np.clip(np.max(rgb,axis=2)/85,.4,1)
    # The supplied video clips wisps at its left/right edges. Only soften the
    # outer 12 source pixels; all cels use the same mask and registration.
    edge=np.minimum(xx,alpha.shape[1]-1-xx)/12
    edge=np.clip(edge,0,1);alpha*=edge*edge*(3-2*edge)
    rgba=np.dstack([np.clip(rgb,0,255),alpha*255]).round().astype(np.uint8)
    crop,cell=cfg['crop'],cfg['cell']
    image=Image.fromarray(rgba).crop(crop)
    scale=min((cell[0]-8)/(crop[2]-crop[0]),(cell[1]-8)/(crop[3]-crop[1]))
    size=(round(image.width*scale),round(image.height*scale))
    image=image.resize(size,Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',cell);tile.paste(image,((cell[0]-size[0])//2,4))
    # Four-pixel RGB bleed for standard straight-alpha bilinear filtering.
    data=np.array(tile);known=data[:,:,3]>0
    for _ in range(4):
        total=np.zeros(data.shape[:2]+(3,),np.uint16);count=np.zeros(data.shape[:2],np.uint16)
        for axis,step in [(0,-1),(0,1),(1,-1),(1,1)]:
            support=np.roll(known,step,axis)
            total+=np.roll(data[:,:,:3],step,axis).astype(np.uint16)*support[:,:,None]
            count+=support
        fill=~known&(count>0)
        data[fill,:3]=(total[fill]/count[fill,None]).round().astype(np.uint8)
        known|=fill
    return Image.fromarray(data)

def bridge(last,first,count=6):
    """Only the boundary is synthesized; keep all 60 source cels in order.
    Bidirectional flow warps associated RGBA before blending to avoid dark rims.
    This is an explicit production repair, not a claim of a native seamless clip.
    """
    a=np.array(last).astype(np.float32)/255;b=np.array(first).astype(np.float32)/255
    a[:,:,:3]*=a[:,:,3:4];b[:,:,:3]*=b[:,:,3:4]
    ga=cv2.cvtColor((a[:,:,:3]*255).astype(np.uint8),cv2.COLOR_RGB2GRAY)
    gb=cv2.cvtColor((b[:,:,:3]*255).astype(np.uint8),cv2.COLOR_RGB2GRAY)
    flow=lambda x,y:cv2.calcOpticalFlowFarneback(x,y,None,.5,4,25,6,7,1.5,0)
    ab=flow(ga,gb);ba=flow(gb,ga)
    yy,xx=np.indices(ga.shape,dtype=np.float32);result=[]
    for i in range(count):
        t=(i+1)/(count+1)
        aa=cv2.remap(a,xx-t*ab[:,:,0],yy-t*ab[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        bb=cv2.remap(b,xx-(1-t)*ba[:,:,0],yy-(1-t)*ba[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        p=aa*(1-t)+bb*t
        p[:,:,:3]/=np.maximum(p[:,:,3:4],1/255)
        p[:3,:,3]=p[-3:,:,3]=p[:,:3,3]=p[:,-3:,3]=0
        result.append(Image.fromarray((np.clip(p,0,1)*255).round().astype(np.uint8)))
    return result

def meta(path,kind,w=0,h=0):
    m=path.with_name(path.name+'.meta')
    if m.exists():return
    ident=str(uuid.uuid4())
    if kind=='json':
        data={'ver':'2.0.1','importer':'json','imported':True,'uuid':ident,'files':['.json'],'subMetas':{},'userData':{}}
    else:
        data=json.loads((ROOT/'assets/resources/fx/frost_domain_video_v10.png.meta').read_text('utf8'))
        old=data['uuid'];raw=json.dumps(data).replace(old,ident).replace('frost_domain_video_v10',path.stem)
        data=json.loads(raw);sf=data['subMetas']['f9941']['userData']
        sf.update(width=w,height=h,rawWidth=w,rawHeight=h,offsetX=0,offsetY=0,trimX=0,trimY=0)
        sf['vertices']={'rawPosition':[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
            'indexes':[0,1,2,2,1,3],'uv':[0,h,w,h,0,0,w,0],
            'nuv':[0,0,1,0,0,1,1,1],'minPos':[-w/2,-h/2,0],'maxPos':[w/2,h/2,0]}
    m.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n','utf8')

def run(source,kind):
    cfg=CONFIGS[kind];cell=cfg['cell'];crop=cfg['crop'];ground=cfg['ground'];speed=cfg['speed']
    asset=ROOT/('assets/resources/fx/wind_'+kind+'_video_v129.png')
    manifest_path=asset.with_suffix('.frames.json')
    archive=ROOT/'local/art-archive/wind-tornado-video-v129';archive.mkdir(parents=True,exist_ok=True)
    copy=archive/source.name
    if not copy.exists():shutil.copyfile(source,copy)
    sha=hashlib.sha256(source.read_bytes()).hexdigest()
    assert hashlib.sha256(copy.read_bytes()).hexdigest()==sha
    reader=iio.get_reader(str(source));info=reader.get_meta_data();tiles=[]
    for frame in reader:tiles.append(key(frame,cfg))
    reader.close()
    assert info['fps']==30 and len(tiles)==60 and info['size']==cfg['size']
    tiles+=bridge(tiles[-1],tiles[0])
    count=len(tiles);rows=(count+COLS-1)//COLS
    atlas=Image.new('RGBA',(COLS*cell[0],rows*cell[1]))
    for i,tile in enumerate(tiles):atlas.paste(tile,(i%COLS*cell[0],i//COLS*cell[1]))
    atlas.save(asset,optimize=True)
    scale=min((cell[0]-8)/(crop[2]-crop[0]),(cell[1]-8)/(crop[3]-crop[1]))
    dw=round((crop[2]-crop[0])*scale)
    anchor=[((cell[0]-dw)//2+(ground[0]-crop[0])*scale)/cell[0],1-(4+(ground[1]-crop[1])*scale)/cell[1]]
    manifest={'schema':1,'framePrefix':kind+'_','frameCount':count,'fps':info['fps'],
        'playbackSpeed':speed,'cellSize':cell,'groundAnchor':anchor,'visualWidthPerRadius':cfg['widthPerRadius'],
        'frames':{kind+'_'+str(i):[i%COLS*cell[0],i//COLS*cell[1],*cell] for i in range(count)}}
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n','utf8')
    meta(asset,'image',*atlas.size);meta(manifest_path,'json')
    # Existing metadata can be reused on repeated packing with a new row count.
    image_meta=asset.with_name(asset.name+'.meta');m=json.loads(image_meta.read_text('utf8'));sf=m['subMetas']['f9941']['userData']
    w,h=atlas.size;sf.update(width=w,height=h,rawWidth=w,rawHeight=h)
    sf['vertices']={'rawPosition':[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],'indexes':[0,1,2,2,1,3],
        'uv':[0,h,w,h,0,0,w,0],'nuv':[0,0,1,0,0,1,1,1],'minPos':[-w/2,-h/2,0],'maxPos':[w/2,h/2,0]}
    image_meta.write_text(json.dumps(m,indent=2)+'\n','utf8')
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
    bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
    bg=bg.crop((int(bg.width*.25),int(bg.height*.25),int(bg.width*.75),int(bg.height*.72))).resize((440,510),Image.Resampling.LANCZOS)
    scenes=[]
    for i,tile in enumerate(tiles):
        sheet=Image.new('RGB',(880,510))
        for panel in range(2):
            canvas=bg.copy() if panel else Image.new('RGBA',(440,510),'#19282d')
            canvas.alpha_composite(tile,((440-cell[0])//2,(460-cell[1])//2));d=ImageDraw.Draw(canvas)
            d.rectangle((0,0,440,43),fill='#19282d')
            d.text((14,12),'森林背景 · 离屏合成' if panel else f'{kind} · {speed}倍速',font=font,fill='#e5f4ec')
            d.rectangle((0,460,440,510),fill='#19282d')
            d.text((14,467),f'{i+1:02d}/{count} · 60原帧 + 6接缝过渡帧',font=font,fill='#c9e3d5')
            d.text((14,488),'固定比例与脚点；无倒放、无静止等帧',font=font,fill='#9cafac')
            sheet.paste(canvas.convert('RGB'),(panel*440,0))
        scenes.append(sheet)
    # Alternate 22/23ms keeps this preview at exactly 1.333 sec per loop.
    durations=[round((i+1)*1000/(30*speed))-round(i*1000/(30*speed)) for i in range(count)]
    scenes[0].save(OUT/(kind+'-preview.webp'),save_all=True,append_images=scenes[1:],duration=durations,loop=0,quality=88,method=4)
    scenes[8].save(OUT/(kind+'-still.jpg'),quality=94)
    contact=Image.new('RGB',(960,5*205),'#19282d')
    for j,i in enumerate(range(0,count,4)):
        cell=Image.new('RGBA',(240,205),'#19282d');small=tiles[i].resize((160,180),Image.Resampling.LANCZOS)
        cell.alpha_composite(small,(40,0));ImageDraw.Draw(cell).text((10,182),str(i),font=font,fill='white')
        contact.paste(cell.convert('RGB'),(j%4*240,j//4*205))
    contact.save(OUT/(kind+'-contact-sheet.jpg'),quality=92)
    arrays=[np.array(t).astype(np.float32)/255 for t in tiles]
    pm=[np.dstack([a[:,:,:3]*a[:,:,3:4],a[:,:,3]]) for a in arrays]
    differences=[float(np.abs(pm[(i+1)%count]-pm[i]).mean()) for i in range(count)]
    source_seam=float(np.abs(pm[59]-pm[0]).mean())
    checks=[]
    for i,a in enumerate(arrays):
        alpha=a[:,:,3]
        assert not alpha[:3,:].any() and not alpha[-3:,:].any() and not alpha[:,:3].any() and not alpha[:,-3:].any()
        checks.append({'frame':i,'transparentFraction':float((alpha==0).mean()),'partialAlphaFraction':float(((alpha>0)&(alpha<1)).mean())})
    report={'source':str(source),'sourceLocalArchive':str(copy),'sourceSha256':sha,'sourceBytes':source.stat().st_size,
        'sourcePixels':info['size'],'sourceFPS':30,'sourceFrames':60,'sourceAudioUsed':False,'frameCount':count,
        'originalFrameOrder':True,'synthesizedBridgeFrames':6,'reverseOrFreezeFrames':False,'fixedCrop':crop,'fixedSourceGround':ground,
        'nativeAspectScaleXY':[scale,scale],'atlasPixels':atlas.size,'atlasRGBABytes':atlas.width*atlas.height*4,'playbackFPS':30*speed,'visualLoopSeconds':count/(30*speed),
        'sourceSeamMAE':source_seam,
        'adjacentMAE':differences,'seamMAE':differences[-1],'medianStepMAE':float(np.median(differences[:-1])),
        'frameAlphaChecks':checks,'keying':'magenta chroma + positive green/cyan/bright-core coverage + separate soft base-dust matte; despill; straight RGBA, standard blend',
        'limitations':['Source smoke/leaf movement is baked in. Chroma key may thin magenta-contaminated wisps.',
            'Six flow-aligned boundary frames may slightly soften moving leaves. Numerical seam metric is not visual approval.'],
        'assets':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,
            'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'uuid':json.loads(p.with_name(p.name+'.meta').read_text('utf8'))['uuid']} for p in [asset,manifest_path]],
        'gameBrowserCombatAudioOrWasmStarted':False}
    (OUT/('art-manifest-'+kind+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
    print(json.dumps({k:report[k] for k in ['sourceFrames','atlasPixels','atlasRGBABytes','playbackFPS','visualLoopSeconds','seamMAE','medianStepMAE']}))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('video',type=Path);ap.add_argument('--kind',choices=CONFIGS,default='tornado');args=ap.parse_args();run(args.video,args.kind)
