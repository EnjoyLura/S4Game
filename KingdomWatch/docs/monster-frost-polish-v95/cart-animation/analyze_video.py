"""Inspect source pixels and contiguous loop candidates; never runs the game."""
from pathlib import Path
import json
import math
import numpy as np
import imageio.v2 as iio
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
ROIS = {'orc_siege_cart': [400, 40, 675, 315]}
SEEDS = {'orc_siege_cart': (540,205)}


def matte(rgb):
    arr = np.asarray(rgb).astype(np.float32)
    neutral = (arr.min(2) > 155) & (arr[...,0] - arr[...,2] < 44) & (arr[...,0] - arr[...,2] > -9)
    neutral &= (np.abs(arr[...,0] - arr[...,1]) < 23) & (np.abs(arr[...,1] - arr[...,2]) < 29)
    padded = Image.new('L',(rgb.width+2,rgb.height+2),255)
    padded.paste(Image.fromarray((neutral*255).astype('uint8')),(1,1))
    ImageDraw.floodfill(padded,(0,0),128,thresh=0)
    external = np.asarray(padded)[1:-1,1:-1] == 128
    mask = Image.fromarray((~external*255).astype('uint8'))
    mask = mask.filter(ImageFilter.GaussianBlur(.25))
    result = rgb.convert('RGBA'); result.putalpha(mask)
    return result


def select(im, mob):
    binary = im.getchannel('A').point(lambda v: 255 if v>100 else 0)
    ImageDraw.floodfill(binary,SEEDS[mob],128,thresh=0)
    component = Image.fromarray(((np.asarray(binary)==128)*255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
    selected = im.copy()
    selected.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel('A')),np.asarray(component))))
    return selected.crop(ROIS[mob])


def features(im, lower=False):
    arr = np.asarray(im.resize((80,96),Image.Resampling.BILINEAR)).astype('float32')/255
    alpha = arr[...,3:4]
    comp = arr[...,:3]*alpha+.65*(1-alpha)
    weights = np.ones((96,80,1),dtype='float32')
    weights[48:] = 2
    feat = np.concatenate([comp*weights,alpha*1.3],axis=2)
    return (feat[55:] if lower else feat).ravel()


def main():
    reader=iio.get_reader(ROOT.parent/'source/cart-user.mp4','ffmpeg')
    fps=reader.get_meta_data()['fps']; first=math.ceil(.5*fps)
    frames=[Image.fromarray(frame) for frame in reader];reader.close()
    full={i:matte(frames[i]) for i in range(first,len(frames))}
    report={}
    for mob,roi in ROIS.items():
        folder=ROOT/'cutouts'/mob;folder.mkdir(parents=True,exist_ok=True)
        images={i:select(im,mob) for i,im in full.items()}
        boxes={}
        for i,im in images.items():
            im.save(folder/f'{i:03d}.png')
            boxes[i]=im.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
            if boxes[i] is None:raise ValueError('Empty cutout')
        feat=np.stack([features(im) for im in images.values()]);feet=np.stack([features(im,True) for im in images.values()])
        velocity=np.diff(feat,axis=0); adjacent=np.mean(np.abs(velocity),axis=1)
        candidates=[]
        for s in range(1,len(images)-17):
            for e in range(s+24,min(s+80,len(images)-1)):
                pose=float(np.mean(np.abs(feat[s]-feat[e])))
                foot_pose=float(np.mean(np.abs(feet[s]-feet[e])))
                context=float(np.mean(np.abs(feat[s-1:s+2]-feat[e-1:e+2])))
                vel=float(np.mean(np.abs(velocity[s]-velocity[e])))
                seam=float(np.mean(np.abs(feat[e-1]-feat[s])))
                median=float(np.median(adjacent[s:e]))
                cuts=sum(b[0]<=0 or b[1]<=0 or b[2]>=roi[2]-roi[0] or b[3]>=roi[3]-roi[1] for i,b in boxes.items() if first+s<=i<first+e)
                score=pose+.9*context+.5*vel+.4*foot_pose+max(0,seam-median)+cuts*.1
                candidates.append(dict(start=first+s,end=first+e,length=e-s,seconds=(e-s)/fps,pose=pose,feetPose=foot_pose,context=context,velocity=vel,seam=seam,seamVsMedian=seam/median,clippedFrames=int(cuts),score=score))
        candidates.sort(key=lambda item:item['score'])
        report[mob]={'roi':roi,'firstAllowedFrame':first,'boxes':boxes,'candidates':candidates[:30]}
        sheet=Image.new('RGB',(8*160,math.ceil(len(images)/8)*200),'#8aa9b7');draw=ImageDraw.Draw(sheet)
        for offset,(i,im) in enumerate(images.items()):
            thumb=im.copy();thumb.thumbnail((154,172))
            x,y=offset%8*160,offset//8*200
            sheet.paste(thumb,(x+(160-thumb.width)//2,y+(172-thumb.height)//2),thumb)
            draw.text((x+6,y+174),f'{i} / {i/fps:.3f}s',fill='#102432')
        sheet.save(ROOT/(mob+'-all-frames.jpg'),quality=96)
    (ROOT/'loop-candidates.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({mob:value['candidates'][:7] for mob,value in report.items()},indent=2))


if __name__=='__main__':main()
