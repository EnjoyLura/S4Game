"""Apply one fixed ground-plane correction to a continuous video.

Expand the ground-depth band while keeping the rear crystal-tip band at
its original height. The same smooth row map is used for every frame.
"""
from pathlib import Path
import json
import imageio.v2 as imageio
import numpy as np
from PIL import Image

OUT=Path(__file__).resolve().parent
reader=imageio.get_reader(str(OUT/'raw/seedance-4s.mp4'))
meta=reader.get_meta_data()
width,height=meta['size']
ground_top,ground_bottom=160.0,435.0
depth_scale=1.68
transition=18.0
padding=48

# Integrate a smooth spatial scale; there are no moving control points.
source_y=np.arange(height,dtype=np.float32)
def smoothstep(values):
    values=np.clip(values,0,1)
    return values*values*(3-2*values)
ground_weight=smoothstep((source_y-ground_top+transition)/(2*transition))*smoothstep((ground_bottom+transition-source_y)/(2*transition))
row_scale=1+(depth_scale-1)*ground_weight
mapped_y=np.concatenate(([0],np.cumsum((row_scale[:-1]+row_scale[1:])/2)))
corrected_height=round(float(mapped_y[-1]))+1
if corrected_height%2: corrected_height+=1
inverse_y=np.interp(np.arange(corrected_height),mapped_y,source_y)
low=np.floor(inverse_y).astype(int)
high=np.minimum(low+1,height-1)
fraction=(inverse_y-low)[:,None,None]

dest=OUT/'raw/ground-projection-corrected.mp4'
writer=imageio.get_writer(str(dest),fps=meta['fps'],codec='libx264rgb',
                         pixelformat='rgb24',macro_block_size=1,
                         ffmpeg_params=['-crf','0','-preset','fast'])
count=0
for index,frame in enumerate(reader):
    corrected=np.rint(frame[low].astype(np.float32)*(1-fraction)+frame[high].astype(np.float32)*fraction).astype('uint8')
    padded=np.pad(corrected,((padding,padding),(padding,padding),(0,0)),mode='constant')
    writer.append_data(padded)
    if index==43: Image.fromarray(padded).save(OUT/'raw/expanded-projection-corrected.png')
    count+=1
writer.close()
reader.close()
report={'source':'raw/seedance-4s.mp4','corrected':'raw/ground-projection-corrected.mp4',
        'sourceSize':[width,height],'correctedSize':[width+padding*2,corrected_height+padding*2],
        'frameCount':count,'fps':meta['fps'],'groundBand':[ground_top,ground_bottom],
        'groundDepthScale':depth_scale,'transitionPixels':transition,'padding':padding,
        'fixedMapForEntireClip':True,'cameraOrFrameTracking':False,
        'method':'smooth fixed row projection; rear crystal-tip height band preserved'}
(OUT/'projection-correction.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
