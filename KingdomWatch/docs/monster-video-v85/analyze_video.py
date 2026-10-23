"""Extract only three selected forest monsters. The boar is deliberately excluded."""
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
ROIS = {'forest_wolf':[135,0,640,400], 'forest_spider':[135,380,640,768],
        'forest_vine':[740,365,1240,768]}
SEEDS = {'forest_wolf':(380,190), 'forest_spider':(385,550), 'forest_vine':(990,580)}


def matte(rgb):
    arr=np.asarray(rgb).astype('float32')
    bg=(arr.min(2)>155)&(arr[...,0]-arr[...,2]<44)&(arr[...,0]-arr[...,2]>-9)
    bg&=(np.abs(arr[...,0]-arr[...,1])<23)&(np.abs(arr[...,1]-arr[...,2])<29)
    padded=Image.new('L',(rgb.width+2,rgb.height+2),255)
    padded.paste(Image.fromarray((bg*255).astype('uint8')),(1,1))
    ImageDraw.floodfill(padded,(0,0),128,thresh=0)
    mask=Image.fromarray(((np.asarray(padded)[1:-1,1:-1]!=128)*255).astype('uint8'))
    # Preserve narrow leg gaps; background flood keeps enclosed bone/fur highlights opaque.
    result=rgb.convert('RGBA');result.putalpha(mask.filter(ImageFilter.GaussianBlur(.28)))
    return result


def restore_wolf_tip(images):
    """Restore only pixels cut by the source top edge, using the same video's complete fur tip."""
    ref=8;pad=32
    gray=[cv2.cvtColor(np.asarray(im)[...,:3],cv2.COLOR_RGB2GRAY) for im in images]
    mask=np.zeros(gray[ref].shape,np.uint8);mask[65:175,150:345]=255
    points=cv2.goodFeaturesToTrack(gray[ref],100,.015,5,mask=mask)
    cap=np.array(images[ref].convert('RGBa'));cap[85:]=0
    result=[];rows=[]
    for i,im in enumerate(images):
        fixed=Image.new('RGBA',(im.width,im.height+pad))
        box=im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
        added=0
        if box[1]==0:
            nxt,status,_=cv2.calcOpticalFlowPyrLK(gray[ref],gray[i],points,None,winSize=(35,35),maxLevel=3)
            back,ok,_=cv2.calcOpticalFlowPyrLK(gray[i],gray[ref],nxt,None,winSize=(35,35),maxLevel=3)
            good=(status.ravel()>0)&(ok.ravel()>0)&(np.linalg.norm(back-points,axis=2).ravel()<1)
            transform,inside=cv2.estimateAffinePartial2D(points[good],nxt[good],method=cv2.RANSAC,ransacReprojThreshold=1.2)
            if transform is None or int(inside.sum())<8:raise ValueError('Missing wolf head anchors')
            transform[1,2]+=pad
            restore=cv2.warpAffine(cap,transform,(im.width,im.height+pad),flags=cv2.INTER_CUBIC)
            restore[pad:]=0  # Never replace any original source-video face, limbs or clothing.
            added=int((restore[...,3]>128).sum())
            fixed=Image.fromarray(restore,mode='RGBa').convert('RGBA')
        fixed.paste(im,(0,pad))
        result.append(fixed);rows.append({'frame':i,'sourceTopClipped':box[1]==0,'restoredPixels':added})
    (ROOT/'wolf-tip-restoration.json').write_text(json.dumps({'referenceSourceFrame':ref,'paddingTop':pad,
        'method':'same-video fur tip, tracked head anchors, fill outside source top edge only','frames':rows},indent=2))
    return result


def rank(images,roi):
    boxes=[im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox() for im in images]
    feat=np.stack([old.features(im) for im in images]); vel=np.diff(feat,axis=0)
    adjacent=np.mean(np.abs(np.diff(feat,axis=0)),axis=1); median=float(np.median(adjacent))
    candidates=[]
    for start in range(1,len(images)-12):
        for end in range(start+12,min(start+41,len(images)-2)):
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
    reader=iio.get_reader(ROOT/'source/user-monsters.mp4')
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
        if name=='forest_wolf':images=restore_wolf_tip(images)
        folder=ROOT/'cutouts'/name;folder.mkdir(parents=True,exist_ok=True)
        for i,im in enumerate(images):im.save(folder/f'{i:03d}.png')
        report[name]=rank(images,roi)
        if name=='forest_wolf':report[name]['sourcePaddingTop']=32
        sheet=Image.new('RGB',(1200,1330),'#a7c4cc');d=ImageDraw.Draw(sheet)
        for i,im in enumerate(images):
            thumb=im.copy();thumb.thumbnail((146,170));x,y=i%8*150,i//8*190
            sheet.paste(thumb,(x+(150-thumb.width)//2,y+(170-thumb.height)//2),thumb)
            d.text((x+4,y+172),str(i),fill='#111111')
        sheet.save(ROOT/f'{name}-all-frames.jpg',quality=95)
    (ROOT/'loop-candidates.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v['candidates'][:4] for k,v in report.items()},indent=2))


if __name__=='__main__':main()
