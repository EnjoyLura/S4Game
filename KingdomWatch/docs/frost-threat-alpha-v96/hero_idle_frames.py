"""User lobby videos to transparent, fixed-foot forward-only idle sheets. Offline pixel processing."""
from pathlib import Path
import hashlib, json, math, sys, uuid
import imageio.v2 as iio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
OUT=PROJECT/'assets/resources/ux/hero_lobby_idle_v96'
VIDEOS={'archer':'游戏英雄待机动作视频生成.mp4','pyro':'游戏英雄待机动作视频生成 (1).mp4',
        'sniper':'游戏英雄待机动作视频生成 (2).mp4','volt':'游戏英雄待机动作视频生成 (3).mp4'}
CELL=(352,576)


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def matte(im,hero):
    a=np.asarray(im).astype('int16');r,g,b=[a[...,i] for i in range(3)]
    if hero=='archer':
        # The supplied archer has a neutral blue-grey studio backdrop; clothing is warm/green.
        bg=(b-r>3)&(g-r>-10)&(a.max(2)<175)&(a.min(2)>19)&(a.max(2)-a.min(2)<43)
    elif hero=='pyro':
        bg=(a.min(2)>232)&(a.max(2)-a.min(2)<17)
    else:
        bg=a.max(2)<19
    # Outside and enclosed background are separated from ink by a solid silhouette.
    # Flood filling only neutral connected regions preserves the character's internal darks/highlights.
    padded=Image.new('L',(im.width+2,im.height+2),255)
    padded.paste(Image.fromarray((bg*255).astype('uint8')),(1,1))
    ImageDraw.floodfill(padded,(0,0),128,thresh=0)
    exterior=np.asarray(padded)[1:-1,1:-1]==128
    # Actual enclosed voids: bow and coat/legs for archer; staff/arm for mages; legs for sniper.
    seeds={'archer':[(645,450),(625,500),(550,1000),(329,1034)],
           'pyro':[(565,595),(341,1082)],'sniper':[(600,590),(355,1045)],
           'volt':[(549,606),(560,800),(560,900),(550,430),(350,1058)]}[hero]
    gaps=Image.fromarray((bg*255).astype('uint8')).copy()
    for x,y in seeds:
        if bg[y,x]:ImageDraw.floodfill(gaps,(x,y),128,thresh=0)
    clear=exterior|(np.asarray(gaps)==128)
    mask=Image.fromarray((~clear*255).astype('uint8'))
    # Keep only the character, excluding the supplied watermark and detached background flecks.
    component=mask.point(lambda v:255 if v>127 else 0)
    ImageDraw.floodfill(component,(360,650),128,thresh=0)
    keep=np.asarray(component)==128
    mask=Image.fromarray((keep*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.3))
    result=im.convert('RGBA');result.putalpha(mask)
    if hero=='volt':
        # The staff's animated light is emission over black, not an opaque purple/black disk.
        arr=np.asarray(result).copy();yy,xx=np.indices((im.height,im.width))
        strength=np.clip((a.max(2).astype('float32')-10)/180,0,1)
        glow=(xx>545)&(yy>150)&(yy<420)&(b-r>15)&(b-g>15)
        physical=Image.new('L',im.size)
        ImageDraw.Draw(physical).polygon([(634,210),(682,244),(704,314),(690,373),(648,405),(603,361),(580,301)],fill=255)
        glow&=np.asarray(physical)==0
        arr[...,3][glow]=(arr[...,3][glow]*strength[glow]).astype('uint8')
        arr[...,:3][glow]=np.clip(arr[...,:3][glow]/np.maximum(.01,strength[glow,None]),0,255).astype('uint8')
        result=Image.fromarray(arr)
    return result


def meta(path,importer,ver):
    target=Path(str(path)+'.meta')
    if target.exists():return
    target.write_text(json.dumps({'ver':ver,'importer':importer,'imported':True,'uuid':str(uuid.uuid4()),
      'files':['.json'] if importer=='json' else [],'subMetas':{},'userData':{}},indent=2)+'\n',encoding='utf-8')


def image_meta(path,w,h):
    sample=json.loads((PROJECT/'assets/resources/ux/chapter1_cart_walk_v95.png.meta').read_text())
    target=Path(str(path)+'.meta');old=sample['uuid']
    new=json.loads(target.read_text())['uuid'] if target.exists() else str(uuid.uuid4())
    sample=json.loads(json.dumps(sample).replace(old,new).replace('chapter1_cart_walk_v95',path.stem))
    d=sample['subMetas']['f9941']['userData'];d.update(width=w,height=h,rawWidth=w,rawHeight=h)
    d['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
      uv=[0,h,w,h,0,0,w,0],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    target.write_text(json.dumps(sample,indent=2)+'\n',encoding='utf-8')


def main():
    preview='--preview' in sys.argv
    OUT.mkdir(exist_ok=True);meta(OUT,'directory','1.2.0')
    reports={}
    for hero,file in VIDEOS.items():
        if '--hero' in sys.argv and hero!=sys.argv[sys.argv.index('--hero')+1]:continue
        source=Path('C:/Users/user/Downloads')/file
        reader=iio.get_reader(str(source),'ffmpeg');info=reader.get_meta_data();fps=info['fps']
        if preview:
            ims=[matte(Image.fromarray(reader.get_data(i)),hero) for i in [0,48,96]]
            sheet=Image.new('RGB',(1080,1280),'#C8B99B')
            for i,im in enumerate(ims):
                for row,bg in enumerate(['#F3DFC1','#1B3444']):
                    tile=Image.new('RGBA',im.size,bg);tile.alpha_composite(im);tile.thumbnail((360,640))
                    sheet.paste(tile.convert('RGB'),(i*360,row*640))
            sheet.save(ROOT/(hero+'-alpha-preview.jpg'),quality=95);reader.close();print(hero,flush=True);continue
        frames=[];indices=[];count=0
        for i,frame in enumerate(reader):
            count=i+1
            if i%2:continue
            frames.append(matte(Image.fromarray(frame),hero));indices.append(i)
        reader.close()
        # All source time is retained, in its original direction and at the source speed.
        boxes=[im.getchannel('A').point(lambda v:255 if v>127 else 0).getbbox() for im in frames]
        box=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        width,height=box[2]-box[0],box[3]-box[1]
        scale=min((CELL[0]-24)/width,(CELL[1]-24)/height)
        size=(round(width*scale),round(height*scale));offset=((CELL[0]-size[0])//2,CELL[1]-12-size[1])
        cols=math.ceil(math.sqrt(len(frames)*CELL[1]/CELL[0]));rows=math.ceil(len(frames)/cols)
        atlas=Image.new('RGBA',(cols*CELL[0],rows*CELL[1]));rects={};cells=[]
        dest=ROOT/'hero-frames'/hero;dest.mkdir(parents=True,exist_ok=True)
        for n,im in enumerate(frames):
            cel=Image.new('RGBA',CELL);cel.paste(im.crop(box).resize(size,Image.Resampling.LANCZOS),offset)
            cel.save(dest/f'{n:03d}.png');cells.append(cel)
            x,y=n%cols*CELL[0],n//cols*CELL[1];atlas.paste(cel,(x,y));rects[f'idle{n}']=[x,y,*CELL]
        durations=[((indices[n+1] if n+1<len(indices) else count)-i)/fps for n,i in enumerate(indices)]
        manifest={'frames':rects,'animation':{'frames':list(rects),'seconds':count/fps,'frameDurations':durations,'loop':True},
          'groundAnchor':[CELL[0]/2,CELL[1]-12],'visibleHeightPx':size[1], 'visibleWidthPx':size[0],
          'source':{'file':file,'sha256':sha(source),'fps':fps,'totalFrames':count,'indices':indices,
                    'fixedCrop':box,'fixedScale':scale,'fixedOffset':offset},
          'loopMethod':'full source, forward only, source timing; no reverse, hold, blend or frame warping'}
        path=OUT/(hero+'.png');atlas.save(path,optimize=True);image_meta(path,*atlas.size)
        mp=OUT/(hero+'.frames.json');mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');meta(mp,'json','2.0.1')
        comp=[]
        for im in cells:
            v=np.asarray(im.resize((88,144),Image.Resampling.BILINEAR)).astype('float32')/255
            comp.append(np.concatenate([v[...,:3]*v[...,3:]+.4*(1-v[...,3:]),v[...,3:]],axis=2))
        adjacent=[float(np.abs(b-a).mean()) for a,b in zip(comp,comp[1:])]
        report={'source':manifest['source'],'frames':len(cells),'seconds':count/fps,'atlas':atlas.size,'bytes':path.stat().st_size,
          'seamMean':float(np.abs(comp[-1]-comp[0]).mean()),'adjacentMedian':float(np.median(adjacent)),
          'fixedCanvas':CELL,'fixedTransform':True,'gameStarted':False}
        reports[hero]=report
        sheets=Image.new('RGB',(6*CELL[0],2*CELL[1]),'#BCAA8E')
        for k,n in enumerate(np.linspace(0,len(cells)-1,6).round().astype(int)):
            for row,bg in enumerate(['#F4DEC0','#1A3445']):
                tile=Image.new('RGBA',CELL,bg);tile.alpha_composite(cells[n]);sheets.paste(tile.convert('RGB'),(k*CELL[0],row*CELL[1]))
        sheets.save(ROOT/(hero+'-idle-contact.jpg'),quality=95)
        print(json.dumps({hero:report},ensure_ascii=False),flush=True)
    if not preview:
        report_path=ROOT/'hero-idle-report.json'
        if '--hero' in sys.argv and report_path.exists():reports={**json.loads(report_path.read_text(encoding='utf-8')),**reports}
        report_path.write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');main()
