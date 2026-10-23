"""Extract original video pixels, stabilize only cart zoom, then rank forward gait loops."""
from pathlib import Path
import sys, json, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import imageio.v2 as iio

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent
sys.path.insert(0, str(PROJECT / 'build/video-processing-deps'))
import cv2
spec = importlib.util.spec_from_file_location('v81', ROOT.parent/'monster-video-v81/analyze_video.py')
old = importlib.util.module_from_spec(spec); spec.loader.exec_module(old)
ROIS = {'orc_axeman':[145,0,610,370], 'orc_siege_cart':[740,0,1225,375],
        'goblin_slinger':[150,370,625,768], 'goblin_king':[735,340,1230,768]}
SEEDS = {'orc_axeman':(410,200), 'orc_siege_cart':(975,210),
         'goblin_slinger':(400,580), 'goblin_king':(980,605)}


def matte(rgb):
    arr=np.asarray(rgb).astype('float32')
    bg=(arr.min(2)>155)&(arr[...,0]-arr[...,2]<44)&(arr[...,0]-arr[...,2]>-9)
    bg&=(np.abs(arr[...,0]-arr[...,1])<23)&(np.abs(arr[...,1]-arr[...,2])<29)
    padded=Image.new('L',(rgb.width+2,rgb.height+2),255)
    padded.paste(Image.fromarray((bg*255).astype('uint8')),(1,1))
    ImageDraw.floodfill(padded,(0,0),128,thresh=0)
    mask=Image.fromarray(((np.asarray(padded)[1:-1,1:-1]!=128)*255).astype('uint8'))
    # Do not morphologically close the tiny gap between the drill tip and the general's crown.
    result=rgb.convert('RGBA');result.putalpha(mask.filter(ImageFilter.GaussianBlur(.28)))
    return result


def stabilize_cart(images):
    # Track fixed chassis details, never the horns, flag, driver, rotating wheels or drill.
    gray = [cv2.cvtColor(np.asarray(im)[...,:3], cv2.COLOR_RGB2GRAY) for im in images]
    mask = np.zeros(gray[0].shape, np.uint8)
    mask[116:155,125:345] = 255  # crossbeam rivets
    mask[155:225,130:172] = 255  # wooden side panel
    mask[155:225,300:342] = 255
    points = cv2.goodFeaturesToTrack(gray[0],120,.015,5,mask=mask,blockSize=5)
    base = points.copy(); tracked = points.copy(); states=[]; samples=[]
    for i, im in enumerate(gray):
        if i:
            nxt,status,err = cv2.calcOpticalFlowPyrLK(gray[i-1],im,tracked,None,
                winSize=(27,27),maxLevel=3,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,40,.005))
            back,ok,_ = cv2.calcOpticalFlowPyrLK(im,gray[i-1],nxt,None,winSize=(27,27),maxLevel=3)
            good=(status.ravel()>0)&(ok.ravel()>0)&(np.linalg.norm(back-tracked,axis=2).ravel()<1.1)
            base=base[good]; tracked=nxt[good]
        if len(base)<8: raise ValueError(f'Lost chassis anchors at {i}')
        matrix,inliers=cv2.estimateAffinePartial2D(base,tracked,method=cv2.RANSAC,ransacReprojThreshold=1.5)
        scale=float(np.hypot(matrix[0,0],matrix[1,0]))
        # The central wood/metal face, in the same fixed ROI coordinate system.
        center=matrix@np.array([235.,205.,1.])
        states.append([scale,*center]); samples.append({'frame':i,'anchors':int(inliers.sum()),
            'scale':scale,'center':center.tolist(),'rotationDegrees':float(np.degrees(np.arctan2(matrix[1,0],matrix[0,0])))})
    states=np.array(states); t=np.arange(len(images),dtype=float)
    # Remove only slow camera-like drift. Residual rolling/bobbing and perspective stay in source pixels.
    trend=np.column_stack([np.polyval(np.polyfit(t,states[:,j],1),t) for j in range(3)])
    reference=trend[0].copy(); factors=trend[:,0]/reference[0]
    result=[]
    for i,im in enumerate(images):
        s=factors[i]; cx,cy=trend[i,1:]; rx,ry=reference[1:]
        # Premultiplied alpha avoids pale/dark color fringes while resampling transparent edges.
        fixed=im.convert('RGBa').transform(im.size,Image.Transform.AFFINE,
            (s,0,cx-s*rx,0,s,cy-s*ry),resample=Image.Resampling.BICUBIC).convert('RGBA')
        result.append(fixed)
        samples[i]['correctionScale']=float(1/s); samples[i]['trendCenter']=[float(cx),float(cy)]
    report={'method':'KLT fixed chassis anchors + RANSAC similarity; remove linear zoom/translation trend only',
        'firstToLastZoom':float(factors[-1]),'reference':reference.tolist(),'samples':samples}
    (ROOT/'cart-stabilization.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    # Show real anchor locations on the first image, so scale estimates are reviewable.
    vis=images[0].copy(); d=ImageDraw.Draw(vis)
    for x,y in points.reshape(-1,2):d.ellipse((x-2,y-2,x+2,y+2),fill='#ff00dd')
    vis.save(ROOT/'cart-chassis-anchors.png')
    return result


def rank(images,roi):
    boxes=[im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox() for im in images]
    feat=np.stack([old.features(im) for im in images]); vel=np.diff(feat,axis=0)
    adjacent=np.mean(np.abs(np.diff(feat,axis=0)),axis=1); median=float(np.median(adjacent))
    candidates=[]
    for start in range(1,len(images)-20):
        for end in range(start+20,min(start+34,len(images)-2)):
            pose=float(np.mean(np.abs(feat[start]-feat[end])))
            context=float(np.mean(np.abs(feat[start-1:start+2]-feat[end-1:end+2])))
            velocity=float(np.mean(np.abs(vel[start]-vel[end])))
            seam=float(np.mean(np.abs(feat[end-1]-feat[start])))
            cuts=sum(b[0]<=0 or b[1]<=0 or b[2]>=images[0].width or b[3]>=images[0].height for b in boxes[start:end])
            score=pose+.8*context+.4*velocity+max(0,seam-median)+cuts*.1
            candidates.append(dict(start=start,end=end,length=end-start,seconds=(end-start)/24,
                pose=pose,context=context,velocity=velocity,seam=seam,seamVsMedian=seam/median,clippedFrames=int(cuts),score=score))
    candidates.sort(key=lambda c:c['score'])
    return dict(roi=roi,boxes=boxes,adjacentMedian=median,candidates=candidates)


def main():
    reader=iio.get_reader(ROOT/'source/user-four-monsters.mp4')
    source=[Image.fromarray(f) for f in reader]; reader.close()
    full=[matte(im) for im in source]; report={}
    for name,roi in ROIS.items():
        images=[]
        for im in full:
            a=np.asarray(im.getchannel('A')); _,labels,stats,_=cv2.connectedComponentsWithStats((a>128).astype('uint8'),8)
            x,y=SEEDS[name]; label=labels[y,x]
            if label==0:raise ValueError('Seed outside '+name)
            selected=Image.fromarray(((labels==label)*255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
            result=im.copy(); result.putalpha(Image.fromarray(np.minimum(a,np.asarray(selected))))
            images.append(result.crop(roi))
        if name=='orc_siege_cart':
            raw=ROOT/'cart-raw';raw.mkdir(exist_ok=True)
            for i,im in enumerate(images):im.save(raw/f'{i:03d}.png')
            images=stabilize_cart(images)
        folder=ROOT/'cutouts'/name;folder.mkdir(parents=True,exist_ok=True)
        for i,im in enumerate(images):im.save(folder/f'{i:03d}.png')
        report[name]=rank(images,roi)
        sheet=Image.new('RGB',(1200,1330),'#a7c4cc');d=ImageDraw.Draw(sheet)
        for i,im in enumerate(images):
            thumb=im.copy();thumb.thumbnail((146,170));x,y=i%8*150,i//8*190
            sheet.paste(thumb,(x+(150-thumb.width)//2,y+(170-thumb.height)//2),thumb)
            d.text((x+4,y+172),str(i),fill='#111111')
        sheet.save(ROOT/f'{name}-all-frames.jpg',quality=95)
    (ROOT/'loop-candidates.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v['candidates'][:4] for k,v in report.items()},indent=2))


if __name__=='__main__':main()
