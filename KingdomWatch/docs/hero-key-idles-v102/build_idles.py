"""Key the two user-supplied clips and bake genuine forward source intervals."""
from pathlib import Path
import hashlib,importlib.util,json,math,sys
import imageio.v2 as iio
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
OUT=PROJECT/'assets/resources/ux/hero_lobby_idle_v102'
INFO=json.loads((ROOT/'source-info.json').read_text(encoding='utf-8'))
spec=importlib.util.spec_from_file_location('old',ROOT.parent/'hero-key-idle-v99/build_idle.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)


def matte(rgb):
    arr=np.asarray(rgb).astype('float32')
    # Estimate the encoded key color from margins, where neither character reaches.
    plate=np.median(np.concatenate([arr[:,:12].reshape(-1,3),arr[:,-12:].reshape(-1,3)]),axis=0)
    r,g,b=[arr[...,i] for i in range(3)]
    excess=np.minimum(r,b)-g
    alpha=np.clip((165-excess)/90,0,1)
    clean=np.clip((arr-plate*(1-alpha[...,None]))/np.maximum(.015,alpha[...,None]),0,255)
    # No pink fabric or magic exists in these two clips: suppress mixed key only
    # on semi-transparent edges, preserving opaque blue/white/green interiors.
    spill=(alpha<.99)&(np.minimum(clean[...,0],clean[...,2])>clean[...,1]+12)
    clean[...,0][spill]=np.minimum(clean[...,0][spill],clean[...,1][spill])
    clean[alpha==0]=0
    return Image.fromarray(np.dstack([clean,alpha*255]).astype('uint8'))


def features(im):
    return old.feature(im)


def regions(hero):
    # Feature coordinates are fixed 90x160; compare moving parts independently.
    if hero=='archer':return {'cloakLeft':(slice(65,119),slice(4,32)),
      'cloakRight':(slice(65,119),slice(45,77)),
      'upperBody':(slice(3,72),slice(15,76)),
      'feet':(slice(118,158),slice(9,74))}
    return {'staff':(slice(4,130),slice(3,34)),
      'head':(slice(4,57),slice(28,75)),
      'robe':(slice(58,135),slice(10,83)),
      'feet':(slice(130,158),slice(25,75))}


def analyze(hero):
    folder=ROOT/hero;cut=folder/'cutouts';cut.mkdir(parents=True,exist_ok=True)
    reader=iio.get_reader(INFO[hero]['file'],'ffmpeg')
    images=[]
    for n,raw in enumerate(reader):
        im=matte(Image.fromarray(raw))
        im=im.resize((360,round(im.height*360/im.width)),Image.Resampling.LANCZOS)
        # Remove RGB stored in fully transparent pixels after filtering.
        a=np.asarray(im).copy();a[...,:3][a[...,3]==0]=0;im=Image.fromarray(a)
        im.save(cut/f'{n:03d}.png');images.append(im)
    reader.close()
    f=np.stack([features(im) for im in images]);v=np.diff(f,axis=0)
    roi=regions(hero);rank=[]
    for start in range(1,len(images)-30):
        for end in range(start+30,len(images)-1):
            metrics={}
            for name,(ys,xs) in roi.items():
                def error(a,b):return float(np.abs(a[...,ys,xs,:]-b[...,ys,xs,:]).mean())
                pose=error(f[start],f[end]);seam=error(f[start],f[end-1])
                context=error(f[start-1:start+2],f[end-1:end+2])
                velocity=error(v[start],v[end])
                adjacent=np.abs(v[start:end,ys,xs]).mean(axis=(1,2,3))
                typical=float(np.median(adjacent))
                metrics[name]={'pose':pose,'seam':seam,'context':context,'velocity':velocity,
                  'typicalStep':typical,'score':pose+context+.5*velocity+max(0,seam-2*typical)}
            weights={'cloakLeft':1.7,'cloakRight':1.7,'upperBody':1,'feet':.7} if hero=='archer' else {'staff':1.2,'head':1,'robe':1.3,'feet':.7}
            score=sum(metrics[k]['score']*w for k,w in weights.items())/sum(weights.values())
            # A small duration preference only resolves near ties; don't hide a bad seam.
            rank.append({'start':start,'endExclusive':end,'frames':end-start,
              'seconds':(end-start)/INFO[hero]['fps'],'score':score,'regions':metrics})
    rank.sort(key=lambda x:x['score'])
    (folder/'loop-candidates.json').write_text(json.dumps(rank[:40],indent=2)+'\n')
    # Side-by-side candidate endpoints, with the same untransformed source frame.
    sheet=Image.new('RGB',(4*360,5*560),'#243f4b');draw=ImageDraw.Draw(sheet)
    for row,c in enumerate(rank[:5]):
        for col,n in enumerate([c['endExclusive']-2,c['endExclusive']-1,c['start'],c['start']+1]):
            tile=Image.new('RGBA',images[n].size,'#243f4b');tile.alpha_composite(images[n])
            sheet.paste(tile.convert('RGB'),(col*360,row*560+20))
            draw.text((col*360+6,row*560+3),f"{c['start']}-{c['endExclusive']-1} frame {n} score {c['score']:.5f}",fill='white')
    sheet.save(folder/'candidate-seams.jpg',quality=94)
    print(json.dumps({'hero':hero,'top':[{k:c[k] for k in ['start','endExclusive','frames','score']} for c in rank[:5]]}),flush=True)


def bake(hero):
    folder=ROOT/hero;rank=json.loads((folder/'loop-candidates.json').read_text())
    chosen=rank[0];override=folder/'selected-window.json'
    if override.exists():
        window=json.loads(override.read_text());chosen=next(c for c in rank if c['start']==window['start'] and c['endExclusive']==window['endExclusive'])
    else:override.write_text(json.dumps({k:chosen[k] for k in ['start','endExclusive']},indent=2))
    indices=list(range(chosen['start'],chosen['endExclusive']))
    selected=[Image.open(folder/f'cutouts/{n:03d}.png').convert('RGBA') for n in indices]
    boxes=[im.getchannel('A').point(lambda a:255 if a>5 else 0).getbbox() for im in selected]
    box=(min(b[0] for b in boxes)-2,min(b[1] for b in boxes)-2,max(b[2] for b in boxes)+2,max(b[3] for b in boxes)+2)
    w,h=box[2]-box[0],box[3]-box[1];cw,ch=352,576
    scale=min((cw-24)/w,(ch-24)/h);size=(round(w*scale),round(h*scale));offset=((cw-size[0])//2,ch-12-size[1])
    cols=math.ceil(math.sqrt(len(selected)*ch/cw));rows=math.ceil(len(selected)/cols)
    atlas=Image.new('RGBA',(cols*cw,rows*ch));cells=[];rects={};dest=folder/'frames';dest.mkdir(exist_ok=True)
    for n,im in enumerate(selected):
        cel=Image.new('RGBA',(cw,ch));cel.paste(im.crop(box).resize(size,Image.Resampling.LANCZOS),offset)
        cel.save(dest/f'{n:03d}.png');cells.append(cel)
        x,y=n%cols*cw,n//cols*ch;atlas.paste(cel,(x,y));rects[f'idle{n}']=[x,y,cw,ch]
    OUT.mkdir(exist_ok=True);old.bake.meta(OUT,'directory','1.2.0')
    path=OUT/(hero+'.png');atlas.save(path,optimize=True);old.bake.image_meta(path,*atlas.size)
    fps=INFO[hero]['fps']
    manifest={'frames':rects,'animation':{'frames':list(rects),'seconds':len(cells)/fps,
      'frameDurations':[1/fps]*len(cells),'loop':True},'groundAnchor':[cw/2,ch-12],
      'visibleHeightPx':size[1],'visibleWidthPx':size[0],
      'source':{**INFO[hero],'indices':indices,'analysisSize':selected[0].size,
        'fixedCrop':box,'fixedScale':scale,'fixedOffset':offset},
      'loopMethod':'continuous forward interval; source timing; no reverse, holds, interpolation, blending or per-frame repositioning',
      'effects':'full-resolution magenta key, encoded-key unmix and semi-transparent edge despill; no generated effects'}
    path=OUT/(hero+'.frames.json');path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');old.bake.meta(path,'json','2.0.1')
    sheet=Image.new('RGB',(6*cw,2*ch));seam=Image.new('RGB',(4*cw,ch),'#d9c5a0')
    for col,n in enumerate(np.linspace(0,len(cells)-1,6).round().astype(int)):
        for row,bg in enumerate(['#ecd9b6','#1c3543']):
            tile=Image.new('RGBA',(cw,ch),bg);tile.alpha_composite(cells[n]);sheet.paste(tile.convert('RGB'),(col*cw,row*ch))
    sheet.save(folder/'alpha-contact.jpg',quality=96)
    draw=ImageDraw.Draw(seam)
    for col,(cel,caption) in enumerate([(cells[-2],'last - 1'),(cells[-1],'last'),(cells[0],'first'),(cells[1],'first + 1')]):
        tile=Image.new('RGBA',(cw,ch),'#d9c5a0');tile.alpha_composite(cel);seam.paste(tile.convert('RGB'),(col*cw,0));draw.text((col*cw+6,5),caption,fill='black')
    seam.save(folder/'seam-contact.jpg',quality=96)
    report={'chosen':chosen,'atlas':atlas.size,'bytes':(OUT/(hero+'.png')).stat().st_size,
      'source':manifest['source'],'fixedCanvas':[cw,ch],'fixedTransform':True,'gameStarted':False}
    (folder/'bake-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'hero':hero,'frames':len(cells),'sourceIndices':[indices[0],indices[-1]],'atlas':atlas.size}),flush=True)


if __name__=='__main__':
    mode=sys.argv[1]
    for hero in INFO:
        (analyze if mode=='--analyze' else bake)(hero)
