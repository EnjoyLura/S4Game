"""Four supplied videos: chroma key, separate emissive spill, select genuine forward loops."""
from pathlib import Path
import importlib.util,json,math,sys
import imageio.v2 as iio
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]
spec=importlib.util.spec_from_file_location('old',ROOT.parent/'hero-key-idle-v99/build_idle.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
OUT=PROJECT/'assets/resources/ux/hero_lobby_idle_v100'
INFO=json.loads((ROOT/'source-info.json').read_text(encoding='utf-8'))


def matte(rgb,hero,physical=None):
    arr=np.asarray(rgb).astype('float32');r,g,b=[arr[...,i] for i in range(3)]
    excess=np.minimum(r,b)-g
    alpha=np.clip((165-excess)/90,0,1)
    key=np.array([255,0,255],dtype='float32')
    roi=np.zeros(alpha.shape,dtype=bool)
    if hero=='volt':roi[:210,:135]=True;roi[:220,240:]=True
    elif hero=='mora':roi[:165,:140]=True
    if physical is not None:
        # The solid robe and staff keep their original opacity and facets.
        solid=physical&(excess<145)
        alpha[solid]=1
        # Green carries the light added over magenta. Recover transparent blue/white emission.
        background=(excess>170)&(r>180)&(b>180)
        weights=np.asarray(Image.fromarray((background*255).astype('uint8')).filter(ImageFilter.GaussianBlur(16))).astype('float32')/255
        numerator=np.asarray(Image.fromarray((arr*background[...,None]).astype('uint8')).filter(ImageFilter.GaussianBlur(16))).astype('float32')
        plate=numerator/np.maximum(.01,weights[...,None])
        plate[weights<.06]=np.median(arr[background],axis=0)
        light=np.maximum(g-plate[...,1],plate[...,0]-r)
        emission=np.clip((light-12)/220,0,1);emission[emission<.04]=0
        yy,xx=np.indices(alpha.shape)
        # The source clips a few lightning tips: soften only emission at the source boundary.
        edge=np.minimum.reduce([xx,yy,alpha.shape[1]-1-xx,alpha.shape[0]-1-yy])
        emission*=np.clip(edge/5,0,1)
        fx=roi&~physical
        alpha[fx]=emission[fx]
    clean=np.clip((arr-key*(1-alpha[...,None]))/np.maximum(.015,alpha[...,None]),0,255)
    if physical is not None:
        clean[fx]=np.clip((arr[fx]-plate[fx]*(1-alpha[fx,None]))/np.maximum(.015,alpha[fx,None]),0,255)
    clean[alpha==0]=0
    return Image.fromarray(np.dstack([clean,alpha*255]).astype('uint8'))


def physical_mask(first):
    a=np.asarray(first).astype('float32')
    solid=(np.minimum(a[...,0],a[...,2])-a[...,1])<145
    mask=Image.fromarray((solid*255).astype('uint8')).copy()
    # Keep the body component, not the first-frame detached energy bolt.
    ImageDraw.floodfill(mask,(first.width//2,first.height//2),128,thresh=0)
    return np.asarray(Image.fromarray(((np.asarray(mask)==128)*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0


def run(hero):
    directory=ROOT/hero;directory.mkdir(exist_ok=True)
    cut=directory/'cutouts';cut.mkdir(exist_ok=True)
    reader=iio.get_reader(INFO[hero]['file'],'ffmpeg');fps=INFO[hero]['fps'];images=[];raw_frames=[];physical=None
    for n,raw in enumerate(reader):
        im=Image.fromarray(raw);size=(360,round(im.height*360/im.width))
        im=im.resize(size,Image.Resampling.LANCZOS)
        if n==0 and hero in ['mora','volt']:physical=physical_mask(im)
        result=matte(im,hero,physical);result.save(cut/f'{n:03d}.png');images.append(result)
        raw_frames.append(im)
    reader.close()
    f=np.stack([old.feature(im) for im in images]);velocity=np.diff(f,axis=0)
    adjacent=np.mean(np.abs(velocity),axis=(1,2,3));rank=[]
    for start in range(1,len(images)-30):
        for end in range(start+30,len(images)-1):
            pose=float(np.abs(f[start]-f[end]).mean())
            seam=float(np.abs(f[start]-f[end-1]).mean())
            context=float(np.abs(f[start-1:start+2]-f[end-1:end+2]).mean())
            speed=float(np.abs(velocity[start]-velocity[end]).mean())
            fx=float(np.abs(f[start,:65]-f[end,:65]).mean())
            median=float(np.median(adjacent[start:end]))
            score=pose+context+.4*speed+.4*fx+max(0,seam-2*median)
            rank.append({'start':start,'endExclusive':end,'frames':end-start,'seconds':(end-start)/fps,
              'poseMean':pose,'seamMean':seam,'contextMean':context,'velocityMean':speed,'upperFXMean':fx,
              'medianAdjacentMean':median,'score':score})
    rank.sort(key=lambda r:r['score']);(directory/'loop-candidates.json').write_text(json.dumps(rank[:30],indent=2)+'\n')
    chosen=rank[0];override=directory/'selected-window.json'
    if override.exists():
        picked=json.loads(override.read_text());chosen=next(r for r in rank if r['start']==picked['start'] and r['endExclusive']==picked['endExclusive'])
    selected=images[chosen['start']:chosen['endExclusive']]
    boxes=[im.getchannel('A').point(lambda a:255 if a>5 else 0).getbbox() for im in selected]
    box=(min(b[0] for b in boxes)-2,min(b[1] for b in boxes)-2,max(b[2] for b in boxes)+2,max(b[3] for b in boxes)+2)
    w,h=box[2]-box[0],box[3]-box[1];cw,ch=352,576
    scale=min((cw-24)/w,(ch-24)/h);size=(round(w*scale),round(h*scale));offset=((cw-size[0])//2,ch-12-size[1])
    cells=[];rects={};cols=math.ceil(math.sqrt(len(selected)*ch/cw));rows=math.ceil(len(selected)/cols)
    atlas=Image.new('RGBA',(cols*cw,rows*ch));dest=directory/'frames';dest.mkdir(exist_ok=True)
    for n,im in enumerate(selected):
        cel=Image.new('RGBA',(cw,ch));cel.paste(im.crop(box).resize(size,Image.Resampling.LANCZOS),offset)
        cel.save(dest/f'{n:03d}.png');cells.append(cel)
        x,y=n%cols*cw,n//cols*ch;atlas.paste(cel,(x,y));rects[f'idle{n}']=[x,y,cw,ch]
    OUT.mkdir(exist_ok=True);old.bake.meta(OUT,'directory','1.2.0')
    atlas_path=OUT/(hero+'.png');atlas.save(atlas_path,optimize=True);old.bake.image_meta(atlas_path,*atlas.size)
    manifest={'frames':rects,'animation':{'frames':list(rects),'seconds':len(cells)/fps,'frameDurations':[1/fps]*len(cells),'loop':True},
      'groundAnchor':[cw/2,ch-12],'visibleHeightPx':size[1],'visibleWidthPx':size[0],
      'source':{**INFO[hero],'indices':list(range(chosen['start'],chosen['endExclusive'])),
        'analysisSize':images[0].size,'fixedCrop':box,'fixedScale':scale,'fixedOffset':offset},
      'loopMethod':'continuous forward source interval; original timing; no reverse, holds, interpolation or crossfade',
      'effects':'solid character protection, separate cyan/white emission with magenta unmixing' if hero in ['volt','mora'] else 'magenta chroma key and edge unmixing'}
    path=OUT/(hero+'.frames.json');path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');old.bake.meta(path,'json','2.0.1')
    sheet=Image.new('RGB',(6*cw,2*ch),'#ddc8a2')
    for col,n in enumerate(np.linspace(0,len(cells)-1,6).round().astype(int)):
        for row,bg in enumerate(['#ecd9b6','#1c3543']):
            tile=Image.new('RGBA',(cw,ch),bg);tile.alpha_composite(cells[n]);sheet.paste(tile.convert('RGB'),(col*cw,row*ch))
    sheet.save(directory/'alpha-contact.jpg',quality=96)
    seam=Image.new('RGB',(4*cw,ch),'#d9c5a0');draw=ImageDraw.Draw(seam)
    for col,(im,caption) in enumerate([(cells[-2],'last - 1'),(cells[-1],'last'),(cells[0],'first'),(cells[1],'first + 1')]):
        tile=Image.new('RGBA',(cw,ch),'#d9c5a0');tile.alpha_composite(im);seam.paste(tile.convert('RGB'),(col*cw,0));draw.text((col*cw+8,8),caption,fill='black')
    seam.save(directory/'seam-contact.jpg',quality=96)
    report={'chosen':chosen,'atlas':atlas.size,'bytes':atlas_path.stat().st_size,'source':manifest['source'],
      'fixedCanvas':[cw,ch],'fixedTransform':True,'aspectRatioPreserved':True,'sourceDirectionAndTimingPreserved':True,'gameStarted':False}
    (directory/'bake-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'hero':hero,'chosen':chosen,'atlas':atlas.size,'bytes':atlas_path.stat().st_size}),flush=True)
    return report


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    heroes=[sys.argv[2]] if len(sys.argv)>2 and sys.argv[1]=='--hero' else list(INFO)
    reports={hero:run(hero) for hero in heroes}
    path=ROOT/'bake-report.json'
    if path.exists():reports={**json.loads(path.read_text(encoding='utf-8')),**reports}
    path.write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
