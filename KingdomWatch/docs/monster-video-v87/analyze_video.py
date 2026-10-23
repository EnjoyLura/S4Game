"""Extract source pixels, correct the spider's slow zoom, rank continuous forward loops."""
from pathlib import Path
import sys, json, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import imageio.v2 as iio
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
sys.path.insert(0,str(PROJECT/'build/video-processing-deps'))
import cv2
spec=importlib.util.spec_from_file_location('v81',ROOT.parent/'monster-video-v81/analyze_video.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
ROIS={'forest_eagle':[0,0,740,390], 'forest_bat':[600,0,1344,460],
      'forest_wasp':[120,380,640,768], 'thorn_ancient':[715,380,1245,768]}
SEEDS={'forest_eagle':(375,225),'forest_bat':(990,230),'forest_wasp':(385,575),'thorn_ancient':(990,555)}

def matte(rgb):
    arr=np.asarray(rgb).astype('float32')
    bg=(arr.min(2)>155)&(arr[...,0]-arr[...,2]<44)&(arr[...,0]-arr[...,2]>-9)
    bg&=(np.abs(arr[...,0]-arr[...,1])<23)&(np.abs(arr[...,1]-arr[...,2])<29)
    padded=Image.new('L',(rgb.width+2,rgb.height+2),255)
    padded.paste(Image.fromarray((bg*255).astype('uint8')),(1,1));ImageDraw.floodfill(padded,(0,0),128,thresh=0)
    mask=Image.fromarray(((np.asarray(padded)[1:-1,1:-1]!=128)*255).astype('uint8'))
    result=rgb.convert('RGBA');result.putalpha(mask.filter(ImageFilter.GaussianBlur(.28)))
    return result

def stabilize(images):
    gray=[cv2.cvtColor(np.asarray(im)[...,:3],cv2.COLOR_RGB2GRAY) for im in images]
    mask=np.zeros(gray[0].shape,np.uint8)
    # Central carapace/face plates only: exclude moving mandibles and all legs.
    mask[90:200,190:345]=255
    points=cv2.goodFeaturesToTrack(gray[0],160,.015,4,mask=mask,blockSize=5)
    base=points.copy();tracked=points.copy();states=[];rows=[]
    for i,g in enumerate(gray):
        if i:
            nxt,status,_=cv2.calcOpticalFlowPyrLK(gray[i-1],g,tracked,None,winSize=(29,29),maxLevel=3)
            back,ok,_=cv2.calcOpticalFlowPyrLK(g,gray[i-1],nxt,None,winSize=(29,29),maxLevel=3)
            good=(status.ravel()>0)&(ok.ravel()>0)&(np.linalg.norm(back-tracked,axis=2).ravel()<1.0)
            base=base[good];tracked=nxt[good]
        if len(base)<8:raise ValueError('Lost body anchors at '+str(i))
        matrix,inside=cv2.estimateAffinePartial2D(base,tracked,method=cv2.RANSAC,ransacReprojThreshold=1.3)
        if matrix is None or inside.sum()<8:raise ValueError('Unreliable spider body tracking')
        scale=float(np.hypot(matrix[0,0],matrix[1,0]));center=matrix@np.array([270.,150.,1.])
        states.append([scale,*center]);rows.append({'frame':i,'anchors':int(inside.sum()),'scale':scale,'center':center.tolist()})
    t=np.arange(len(images),dtype=float);states=np.array(states)
    trend=np.column_stack([np.polyval(np.polyfit(t,states[:,j],1),t) for j in range(3)])
    ref=trend[0].copy();factors=trend[:,0]/ref[0];fixed=[]
    for i,im in enumerate(images):
        s=factors[i];cx,cy=trend[i,1:];rx,ry=ref[1:]
        fixed.append(im.convert('RGBa').transform(im.size,Image.Transform.AFFINE,
            (s,0,cx-s*rx,0,s,cy-s*ry),resample=Image.Resampling.BICUBIC).convert('RGBA'))
        rows[i]['correctionScale']=float(1/s);rows[i]['residualScale']=float(states[i,0]/s)
        rows[i]['trendCenter']=[float(cx),float(cy)]
    report={'method':'KLT central carapace/face anchors + RANSAC similarity; remove linear scale and translation trends only',
            'firstToLastZoom':float(factors[-1]),'reference':ref.tolist(),'samples':rows}
    (ROOT/'spider-stabilization.json').write_text(json.dumps(report,indent=2)+'\n')
    vis=images[0].copy();d=ImageDraw.Draw(vis)
    for x,y in points.reshape(-1,2):d.ellipse((x-2,y-2,x+2,y+2),fill='#ff00dd')
    vis.save(ROOT/'spider-body-anchors.png')
    return fixed

def boundary_cap(target,reference,pad=80):
    """Register a complete same-wing tip against the clipped boundary's first 14 rows."""
    tar=np.array(target.convert('RGBa'));ref=np.array(reference.convert('RGBa'))
    edge=np.flatnonzero(tar[0,:,3]>128)
    if not len(edge):return None,None
    tx1,tx2=int(edge.min()),int(edge.max())+1
    x0=max(0,tx1-18);x3=min(target.width,tx2+18);actual=tar[:14,x0:x3].astype('float32')
    box=reference.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
    if box is None:return None,None
    best=None
    for ry in range(box[1]+1,min(box[1]+pad-5,reference.height-16)):
        xs=np.flatnonzero(ref[ry,:,3]>128)
        if not len(xs):continue
        rx1,rx2=int(xs.min()),int(xs.max())+1;sx=(tx2-tx1)/(rx2-rx1)
        if not .65<sx<1.5:continue
        for sy in [.85,1.,1.15]:
            matrix=np.array([[sx,0,tx1-sx*rx1-x0],[0,sy,-sy*ry]],dtype='float64')
            sample=cv2.warpAffine(ref,matrix,(x3-x0,14),flags=cv2.INTER_LINEAR).astype('float32')
            difference=np.abs(sample-actual);difference[...,3]*=1.5
            score=float(difference.mean()+3*abs(np.log(sx))+2*abs(np.log(sy)))
            if best is None or score<best[0]:best=(score,ry,sx,sy,rx1)
    if best is None:return None,None
    score,ry,sx,sy,rx1=best
    matrix=np.array([[sx,0,tx1-sx*rx1],[0,sy,pad-sy*ry]],dtype='float64')
    warped=cv2.warpAffine(ref,matrix,(target.width,target.height+pad),flags=cv2.INTER_CUBIC)
    warped[pad:]=0
    record={'method':'same-wing boundary profile registration','boundaryFitError':score,'referenceCutRow':ry,
        'scale':[sx,sy],'restoredPixels':int((warped[...,3]>128).sum()),'transform':matrix.tolist()}
    return Image.fromarray(warped,mode='RGBa').convert('RGBA'),record

def restore_wing_edges(images,name):
    """Fill outside the source rectangle only, with registered pixels from this same wing."""
    pad=80;right=80 if name=='forest_bat' else 0
    gray=[cv2.cvtColor(np.asarray(im)[...,:3],cv2.COLOR_RGB2GRAY) for im in images]
    boxes=[im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox() for im in images]
    w,h=images[0].size
    good_refs=[i for i,b in enumerate(boxes) if b[1]>1 and b[2]<w-1]
    features=np.stack([old.features(im) for im in images])
    result=[];rows=[]
    for i,im in enumerate(images):
        restored=Image.new('RGBA',(w+right,h+pad));row={'frame':i,'sourceTopClipped':boxes[i][1]==0,
            'sourceRightClipped':boxes[i][2]>=w,'wings':[]}
        if row['sourceTopClipped'] or (right and row['sourceRightClipped']):
            refs=sorted(good_refs,key=lambda j:float(np.mean(np.abs(features[j]-features[i]))))[:12]
            for wing in [0,1]:
                target=np.array(im);target[270:,:,3]=0
                if wing==0:target[:,int(w*.4):,3]=0
                else:target[:,:int(w*.6),3]=0
                target=Image.fromarray(target)
                if not np.any(np.array(target.getchannel('A'))[0]>128):continue
                best=None
                for ref in refs[:8]:
                    original=np.array(images[ref]);original[270:,:,3]=0
                    if wing==0:original[:,int(w*.4):,3]=0
                    else:original[:,:int(w*.6),3]=0
                    cap,rec=boundary_cap(target,Image.fromarray(original),pad)
                    if rec and rec['restoredPixels'] and (best is None or rec['boundaryFitError']<best[2]['boundaryFitError']):best=(cap,ref,rec)
                if best is None:
                    row['wings'].append({'wing':wing,'unresolved':True,'restoredPixels':0});continue
                cap,ref,rec=best;restored.alpha_composite(cap,(0,0));row['wings'].append({'wing':wing,'referenceFrame':ref,**rec})
            if right and row['sourceRightClipped']:
                target=im.transpose(Image.Transpose.ROTATE_90);best=None
                for ref in refs[:5]:
                    cap,rec=boundary_cap(target,images[ref].transpose(Image.Transpose.ROTATE_90),right)
                    if rec and rec['restoredPixels'] and (best is None or rec['boundaryFitError']<best[2]['boundaryFitError']):best=(cap,ref,rec)
                if best is None:row['wings'].append({'wing':1,'edge':'right','unresolved':True,'restoredPixels':0})
                else:
                    cap,ref,rec=best;restored.alpha_composite(cap.transpose(Image.Transpose.ROTATE_270),(0,pad))
                    row['wings'].append({'wing':1,'edge':'right','referenceFrame':ref,**rec})
        restored.paste(im,(0,pad));result.append(restored);rows.append(row)
    (ROOT/(name+'-wing-restoration.json')).write_text(json.dumps({'method':'same-video same-wing tip pixels; boundary profile registration; only outside original source rectangle',
        'paddingTop':pad,'paddingRight':right,'frames':rows},indent=2)+'\n')
    return result

def rank(images,roi):
    boxes=[im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox() for im in images]
    feat=np.stack([old.features(im) for im in images]);vel=np.diff(feat,axis=0)
    median=float(np.median(np.mean(np.abs(vel),axis=1)));candidates=[]
    for start in range(1,len(images)-10):
        for end in range(start+10,min(start+41,len(images)-2)):
            pose=float(np.mean(np.abs(feat[start]-feat[end])))
            context=float(np.mean(np.abs(feat[start-1:start+2]-feat[end-1:end+2])))
            velocity=float(np.mean(np.abs(vel[start]-vel[end])))
            seam=float(np.mean(np.abs(feat[end-1]-feat[start])))
            cuts=sum(b[0]<=0 or b[1]<=0 or b[2]>=images[0].width or b[3]>=images[0].height for b in boxes[start:end])
            score=pose+.8*context+.4*velocity+max(0,seam-median)+cuts*.1
            candidates.append(dict(start=start,end=end,length=end-start,seconds=(end-start)/24,pose=pose,
                context=context,velocity=velocity,seam=seam,seamVsMedian=seam/median,clippedFrames=int(cuts),score=score))
    candidates.sort(key=lambda c:c['score'])
    return dict(roi=roi,boxes=boxes,adjacentMedian=median,candidates=candidates)

def main():
    reader=iio.get_reader(ROOT/'source/user-monsters.mp4');source=[Image.fromarray(f) for f in reader];reader.close()
    full=[matte(im) for im in source];report={}
    for name,roi in ROIS.items():
        images=[]
        for im in full:
            a=np.array(im.getchannel('A'))
            rgb=np.asarray(im)[...,:3].astype('float32')
            # Occasionally adjacent wings touch. Hue isolates only the overlapping outer-wing region.
            if name=='forest_eagle':
                own=((rgb[...,0]-rgb[...,1]<14)&(rgb[...,0]-rgb[...,2]<8)&(a>128)).astype('uint8')
                own=cv2.dilate(own,np.ones((5,5),np.uint8))
                a[:390,640:]*=own[:390,640:]
            if name=='forest_bat':
                own=((rgb[...,0]-rgb[...,1]>12)&(a>128)).astype('uint8')
                own=cv2.dilate(own,np.ones((5,5),np.uint8))
                a[:460,:780]*=own[:460,:780]
            _,labels,stats,_=cv2.connectedComponentsWithStats((a>128).astype('uint8'),8)
            x,y=SEEDS[name];label=labels[y,x]
            if label==0:raise ValueError('Seed outside '+name)
            selected=Image.fromarray(((labels==label)*255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
            result=im.copy();result.putalpha(Image.fromarray(np.minimum(a,np.asarray(selected))))
            images.append(result.crop(roi))
        if name in {'forest_eagle','forest_bat'}:
            raw=ROOT/(name+'-raw');raw.mkdir(exist_ok=True)
            for i,im in enumerate(images):im.save(raw/f'{i:03d}.png')
            images=restore_wing_edges(images,name)
        if name=='thorn_ancient':
            raw=ROOT/'spider-raw';raw.mkdir(exist_ok=True)
            for i,im in enumerate(images):im.save(raw/f'{i:03d}.png')
            images=stabilize(images)
        folder=ROOT/'cutouts'/name;folder.mkdir(parents=True,exist_ok=True)
        for i,im in enumerate(images):im.save(folder/f'{i:03d}.png')
        report[name]=rank(images,roi)
        if name in {'forest_eagle','forest_bat'}:report[name]['sourcePaddingTop']=80
        sheet=Image.new('RGB',(1200,1330),'#a7c4cc');d=ImageDraw.Draw(sheet)
        for i,im in enumerate(images):
            thumb=im.copy();thumb.thumbnail((146,170));x,y=i%8*150,i//8*190
            sheet.paste(thumb,(x+(150-thumb.width)//2,y+(170-thumb.height)//2),thumb);d.text((x+4,y+172),str(i),fill='black')
        sheet.save(ROOT/f'{name}-all-frames.jpg',quality=95)
    (ROOT/'loop-candidates.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v['candidates'][:4] for k,v in report.items()},indent=2))
if __name__=='__main__':main()
