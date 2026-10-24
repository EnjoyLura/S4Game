"""Key supplied magenta video and rank continuous forward loops, without game execution."""
from pathlib import Path
import importlib.util,json,math,sys
import imageio.v2 as iio
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
SOURCE=Path('C:/Users/user/Documents/Qoder/2026-10-24/1ab30149/vibe_videos/__1792849458.mp4')
spec=importlib.util.spec_from_file_location('bake',ROOT.parent/'frost-threat-alpha-v96/hero_idle_frames.py')
bake=importlib.util.module_from_spec(spec);spec.loader.exec_module(bake)
OUT=PROJECT/'assets/resources/ux/hero_lobby_idle_v99'


def matte(rgb):
    a=np.asarray(rgb).astype('float32')
    excess=np.minimum(a[...,0],a[...,2])-a[...,1]
    alpha=np.clip((165-excess)/90,0,1)
    # Recover straight RGB from the magenta-backed mixed edge, rather than leaving pink fringes.
    key=np.array([255,0,255],dtype='float32')
    clean=np.clip((a-key*(1-alpha[...,None]))/np.maximum(.015,alpha[...,None]),0,255)
    clean[alpha==0]=0
    return Image.fromarray(np.dstack([clean,(alpha*255)]).astype('uint8'))


def feature(im):
    arr=np.asarray(im.resize((90,160),Image.Resampling.BILINEAR)).astype('float32')/255
    alpha=arr[...,3:];comp=arr[...,:3]*alpha+.5*(1-alpha)
    return np.concatenate([comp,alpha],axis=2)


def main():
    cut=ROOT/'cutouts';cut.mkdir(exist_ok=True)
    reader=iio.get_reader(str(SOURCE),'ffmpeg');fps=reader.get_meta_data()['fps']
    images=[]
    for n,raw in enumerate(reader):
        path=cut/f'{n:03d}.png'
        if path.exists():im=Image.open(path).convert('RGBA')
        else:
            im=matte(Image.fromarray(raw)).resize((360,640),Image.Resampling.LANCZOS)
            im.save(path)
        images.append(im)
    reader.close()
    f=np.stack([feature(im) for im in images]);v=np.diff(f,axis=0)
    adjacent=np.mean(np.abs(v),axis=(1,2,3));rank=[]
    # Windows remain contiguous; compare pose, three-frame context and the direction of motion.
    for start in range(1,len(images)-30):
        for end in range(start+30,len(images)-1):
            pose=float(np.mean(np.abs(f[start]-f[end])))
            seam=float(np.mean(np.abs(f[start]-f[end-1])))
            context=float(np.mean(np.abs(f[start-1:start+2]-f[end-1:end+2])))
            velocity=float(np.mean(np.abs(v[start]-v[end])))
            flame=float(np.mean(np.abs(f[start,50:90,:45]-f[end,50:90,:45])))
            median=float(np.median(adjacent[start:end]))
            score=pose+context+.4*velocity+.2*flame+max(0,seam-2*median)
            rank.append({'start':start,'endExclusive':end,'frames':end-start,'seconds':(end-start)/fps,
              'poseMean':pose,'seamMean':seam,'contextMean':context,'velocityMean':velocity,
              'flameMean':flame,'medianAdjacentMean':median,'score':score})
    rank.sort(key=lambda r:r['score'])
    (ROOT/'loop-candidates.json').write_text(json.dumps(rank[:30],indent=2)+'\n')
    chosen=rank[0]
    override=ROOT/'selected-window.json'
    if override.exists():
        selected=json.loads(override.read_text());chosen=next(r for r in rank if r['start']==selected['start'] and r['endExclusive']==selected['endExclusive'])
    selected=images[chosen['start']:chosen['endExclusive']]
    boxes=[im.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox() for im in selected]
    box=(min(b[0] for b in boxes)-2,min(b[1] for b in boxes)-2,max(b[2] for b in boxes)+2,max(b[3] for b in boxes)+2)
    w,h=box[2]-box[0],box[3]-box[1];cw,ch=352,576
    scale=min((cw-24)/w,(ch-24)/h);size=(round(w*scale),round(h*scale));offset=((cw-size[0])//2,ch-12-size[1])
    cells=[];rects={};cols=math.ceil(math.sqrt(len(selected)*ch/cw));rows=math.ceil(len(selected)/cols)
    atlas=Image.new('RGBA',(cols*cw,rows*ch));dest=ROOT/'frames';dest.mkdir(exist_ok=True)
    for n,im in enumerate(selected):
        cel=Image.new('RGBA',(cw,ch));cel.paste(im.crop(box).resize(size,Image.Resampling.LANCZOS),offset)
        cel.save(dest/f'{n:03d}.png');cells.append(cel)
        x,y=n%cols*cw,n//cols*ch;atlas.paste(cel,(x,y));rects[f'idle{n}']=[x,y,cw,ch]
    OUT.mkdir(exist_ok=True);bake.meta(OUT,'directory','1.2.0')
    atlas_path=OUT/'pyro.png';atlas.save(atlas_path,optimize=True);bake.image_meta(atlas_path,*atlas.size)
    manifest={'frames':rects,'animation':{'frames':list(rects),'seconds':len(cells)/fps,'frameDurations':[1/fps]*len(cells),'loop':True},
      'groundAnchor':[cw/2,ch-12],'visibleHeightPx':size[1],'visibleWidthPx':size[0],
      'source':{'file':str(SOURCE),'sha256':bake.sha(SOURCE),'fps':fps,'totalFrames':len(images),
        'indices':list(range(chosen['start'],chosen['endExclusive'])),'fixedCrop':box,'fixedScale':scale,'fixedOffset':offset},
      'loopMethod':'continuous forward source interval; no reverse, held pose, interpolation or crossfade'}
    path=OUT/'pyro.frames.json';path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');bake.meta(path,'json','2.0.1')
    sheet=Image.new('RGB',(6*cw,2*ch),'#ddc8a2')
    for col,n in enumerate(np.linspace(0,len(cells)-1,6).round().astype(int)):
        for row,bg in enumerate(['#ecd9b6','#1c3543']):
            tile=Image.new('RGBA',(cw,ch),bg);tile.alpha_composite(cells[n]);sheet.paste(tile.convert('RGB'),(col*cw,row*ch))
    sheet.save(ROOT/'alpha-contact.jpg',quality=96)
    seam=Image.new('RGB',(4*cw,ch),'#d9c5a0');draw=ImageDraw.Draw(seam)
    for col,(im,caption) in enumerate([(cells[-2],'last - 1'),(cells[-1],'last'),(cells[0],'first'),(cells[1],'first + 1')]):
        tile=Image.new('RGBA',(cw,ch),'#d9c5a0');tile.alpha_composite(im);seam.paste(tile.convert('RGB'),(col*cw,0));draw.text((col*cw+8,8),caption,fill='black')
    seam.save(ROOT/'seam-contact.jpg',quality=96)
    report={'chosen':chosen,'atlas':atlas.size,'bytes':atlas_path.stat().st_size,'source':manifest['source'],
      'fixedCanvas':[cw,ch],'fixedTransform':True,'sourceDirectionAndTimingPreserved':True,'gameStarted':False}
    (ROOT/'bake-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'chosen':chosen,'atlas':atlas.size,'bytes':atlas_path.stat().st_size},ensure_ascii=False))


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');main()
