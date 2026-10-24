"""Keep original cels and add two motion-aligned, premultiplied-alpha seam cels."""
from pathlib import Path
import copy,hashlib,importlib.util,json,math,sys
import numpy as np
from PIL import Image,ImageDraw
try:
    import cv2
except ImportError:
    sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-animation-python-libs'))
    import cv2

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parents[1]
PREVIOUS=ROOT.parent/'hero-key-idles-v102'
OUT=PROJECT/'assets/resources/ux/hero_lobby_idle_v103'
spec=importlib.util.spec_from_file_location('previous',PREVIOUS/'build_idles.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)


def premult(im):
    arr=np.asarray(im).astype('float32')/255
    arr[...,:3]*=arr[...,3:]
    return arr


def flow(a,b):
    def grey(im):
        p=premult(im);rgb=(p[...,:3]+.45*(1-p[...,3:]))*255
        return cv2.cvtColor(rgb.astype('uint8'),cv2.COLOR_RGB2GRAY)
    f=cv2.calcOpticalFlowFarneback(grey(a),grey(b),None,.5,4,25,7,7,1.5,0)
    # Source displacement is small. Reject large unrelated matches in blank regions.
    length=np.linalg.norm(f,axis=2);f*=np.minimum(1,12/np.maximum(.001,length))[...,None]
    return f


def bridge(a,b,t,ab,ba):
    h,w=ab.shape[:2];yy,xx=np.mgrid[:h,:w].astype('float32')
    pa=cv2.remap(premult(a),xx-t*ab[...,0],yy-t*ab[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    pb=cv2.remap(premult(b),xx-(1-t)*ba[...,0],yy-(1-t)*ba[...,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    p=(1-t)*pa+t*pb
    rgb=np.clip(p[...,:3]/np.maximum(1/255,p[...,3:]),0,1)
    rgba=np.dstack([rgb,p[...,3]])
    rgba=(np.clip(rgba,0,1)*255+.5).astype('uint8');rgba[...,:3][rgba[...,3]==0]=0
    return Image.fromarray(rgba)


def main():
    manifest=json.loads((PROJECT/'assets/resources/ux/hero_lobby_idle_v102/archer.frames.json').read_text())
    originals=[Image.open(PREVIOUS/f'archer/frames/{n:03d}.png').convert('RGBA') for n in range(49)]
    source=manifest['source'];crop=source['fixedCrop'];scale=source['fixedScale'];offset=tuple(source['fixedOffset'])
    raw=Image.open(PREVIOUS/'archer/cutouts/055.png').convert('RGBA')
    size=(round((crop[2]-crop[0])*scale),round((crop[3]-crop[1])*scale))
    extra=Image.new('RGBA',(352,576));extra.paste(raw.crop(crop).resize(size,Image.Resampling.LANCZOS),offset)
    cells=originals+[extra];ab=flow(extra,cells[0]);ba=flow(cells[0],extra)
    transition=[bridge(extra,cells[0],t,ab,ba) for t in [1/3,2/3]]
    cells+=transition
    provenance=[{'kind':'source','sourceFrame':n} for n in range(6,56)]+[
      {'kind':'motionCompensatedSeam','fromSource':55,'toSource':6,'fraction':t} for t in [1/3,2/3]]
    folder=ROOT/'archer';dest=folder/'frames';dest.mkdir(parents=True,exist_ok=True)
    cw,ch=352,576;cols=math.ceil(math.sqrt(len(cells)*ch/cw));rows=math.ceil(len(cells)/cols)
    atlas=Image.new('RGBA',(cols*cw,rows*ch));rects={}
    for n,im in enumerate(cells):
        im.save(dest/f'{n:03d}.png');x,y=n%cols*cw,n//cols*ch;atlas.paste(im,(x,y));rects[f'idle{n}']=[x,y,cw,ch]
    OUT.mkdir(exist_ok=True);previous.old.bake.meta(OUT,'directory','1.2.0')
    path=OUT/'archer.png';atlas.save(path,optimize=True);previous.old.bake.image_meta(path,*atlas.size)
    m=copy.deepcopy(manifest);m['frames']=rects;m['animation']={'frames':list(rects),'seconds':len(cells)/30,'frameDurations':[1/30]*len(cells),'loop':True}
    m['source']['indices']=list(range(6,56));m['frameProvenance']=provenance
    m['loopMethod']='50 genuine forward source frames, followed by 2 bidirectional-flow-aligned seam frames; source cels unchanged; 30fps, no reverse or holds'
    path=OUT/'archer.frames.json';path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');previous.old.bake.meta(path,'json','2.0.1')
    # Compare the actual boundary with the same spatial transform, without playing it.
    def feat(im):return previous.old.feature(im)
    oldjump=float(np.abs(feat(originals[-1])-feat(originals[0])).mean())
    ids=[48,49,50,51,0,1];errors=[float(np.abs(feat(cells[a])-feat(cells[b])).mean()) for a,b in zip(ids,ids[1:])]
    report={'sourceFrames':[6,55],'originalFrames':50,'motionCompensatedFrames':2,'frameCount':52,'seconds':52/30,
      'oldDirectSeamMean':oldjump,'newBoundarySteps':errors,'atlasSize':atlas.size,
      'original49CelsByteIdentical':all(np.array_equal(np.asarray(a),np.asarray(b)) for a,b in zip(originals,cells[:49])),
      'flowDisplacement99Percentile':float(np.percentile(np.linalg.norm(ab,axis=2),99)),
      'opencv':cv2.__version__,'gameStarted':False,'visualApproval':'pending user inspection'}
    (ROOT/'seam-report.json').write_text(json.dumps(report,indent=2)+'\n')
    for name,indices in [('seam-contact.jpg',[48,49,50,51,0,1]),('alpha-contact.jpg',[0,10,20,30,40,51])]:
        sheet=Image.new('RGB',(6*cw,2*ch));draw=ImageDraw.Draw(sheet)
        for col,n in enumerate(indices):
            for row,bg in enumerate(['#ecd9b6','#1c3543']):
                tile=Image.new('RGBA',(cw,ch),bg);tile.alpha_composite(cells[n]);sheet.paste(tile.convert('RGB'),(col*cw,row*ch));draw.text((col*cw+5,row*ch+5),f'cel {n} {provenance[n]["kind"]}',fill='#9b3939')
        sheet.save(folder/name,quality=96)
    print(json.dumps(report))


if __name__=='__main__':main()
