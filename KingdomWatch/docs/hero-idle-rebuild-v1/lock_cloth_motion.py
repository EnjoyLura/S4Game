"""Retain AI cape-tip motion while fixing the rest of the character to frame zero."""
from pathlib import Path
import argparse, json, shutil
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--take',choices=['idle-v3'],required=True)
args=ap.parse_args()
folder=ROOT/'sniper'/args.take
raw=folder/'ai-source.mp4'
source=folder/'source.mp4'
if not raw.exists():
    shutil.copy2(source,raw)
reader=imageio_ffmpeg.read_frames(str(raw))
info=next(reader)
size=tuple(info['size'])
first=next(reader)
base=np.asarray(Image.frombytes('RGB',size,first)).copy()
rgb=base.astype(np.float32)
r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
visible=rgb.max(2)>28
ys,xs=np.where(visible)
top,bottom=int(ys.min()),int(ys.max())+1
height=bottom-top
yy,xx=np.indices(visible.shape)
fy,fx=np.where(visible&(yy>=bottom-round(height*.16)))
foot_x=(float(fx.min())+float(fx.max()))/2
blue=(b>75)&(b>r*1.65)&(b>g*1.08)&(b-r>45)
region=(yy>=top+height*.52)&(yy<=bottom-height*.10)&(xx>=foot_x-height*.14)
seed=blue&region
if not np.any(seed):
    raise RuntimeError('No lower blue cape region was found; original video preserved')
mask=Image.fromarray(seed.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.5))
weight=np.asarray(mask).astype(np.float32)/255.0
# Colored non-cape material in frame zero remains fixed, including gloves,
# leather, armor and trouser fabric. Upper body and weapon are outside region.
protected=visible&(~blue)
weight[protected|(~region)]=0
outpath=folder/'idle-locked.mp4'
writer=imageio_ffmpeg.write_frames(str(outpath),size,fps=float(info['fps']),
    codec='libx264',quality=None,output_params=['-crf','12','-preset','medium'])
writer.send(None)
count=0

def emit(data):
    global count
    current=np.asarray(Image.frombytes('RGB',size,data)).astype(np.float32)
    cr,cg,cb=current[:,:,0],current[:,:,1],current[:,:,2]
    cloth=(cb>cr*1.25)&(cb>cg*.95)&(cb-cr>25)
    black=current.max(2)<=28
    alpha=weight*(cloth|black)
    output=np.rint(rgb*(1-alpha[:,:,None])+current*alpha[:,:,None]).clip(0,255).astype(np.uint8)
    writer.send(output.tobytes())
    count+=1

try:
    emit(first)
    for data in reader:
        emit(data)
finally:
    writer.close()
shutil.copy2(outpath,source)
report={
    'rawVideo':'ai-source.mp4','outputVideo':'source.mp4','intermediate':'idle-locked.mp4',
    'sourceSize':size,'fps':float(info['fps']),'frames':count,
    'staticReference':'First full video frame, unchanged outside the lower cape mask',
    'motion':'AI-generated motion restricted to lower blue cape cloth and its immediate edge',
    'region':{'bodyTop':top,'bodyBottom':bottom,'lowerStartRatio':.52,'lowerEndRatio':.90},
    'processing':'Pixel compositing only. No drawing, limb splitting, skeletal deformation, warping, tracking or per-frame resizing. Original AI video preserved.',
    'manualReview':'Pending user review; no game or browser verification performed'
}
(folder/'cloth-lock.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))

