"""Extract one continuous AI video and create an offline material review.

Uses the established video2atlas pipeline: a single union crop for the whole
clip, fixed scale, black-level correction and soft transparent edges.
"""
from pathlib import Path
import json
import math
import subprocess
import sys
import imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
GAME = OUT.parents[1]
video = OUT / 'raw/text-only-2s.mp4'
reader = imageio.get_reader(str(video))
meta = reader.get_meta_data()
count = reader.count_frames()
reader.close()
# Preserve all native pictures while conforming the deliverable to exactly
# two seconds; the provider returned a slightly longer clip than requested.
reader=imageio.get_reader(str(video))
conformed=OUT/'frost-domain-video-2s.mp4'
writer=imageio.get_writer(str(conformed),fps=count/2,codec='libx264',quality=9,
                         macro_block_size=1)
for source_frame in reader: writer.append_data(source_frame)
writer.close()
reader.close()
prefix='frost_domain_video_v6'
dest=OUT / 'sequence'
subprocess.run([sys.executable, str(ROOT/'美术/tools/video2atlas.py'),
                '--video',str(video),'--prefix',prefix,'--outdir',str(dest),
                '--cells',str(count),'--size','384','--grid','8',
                '--window','all','--margin','0.10','--pedestal','9'],check=True)
data=json.loads((dest/f'{prefix}.frames').read_text(encoding='utf-8'))
atlas=Image.open(dest/f'{prefix}.png').convert('RGBA')
frames=[atlas.crop((x,y,x+w,y+h)) for x,y,w,h in data['frames'].values()]
duration=1.0
native_fps=float(meta.get('fps',24))
# The native clip leaves wisps in its last frame. A short opacity taper ends
# the one-shot cleanly without altering any crystal shapes or positions.
tail=max(2,round(len(frames)*.12))
for k in range(len(frames)-tail,len(frames)):
    progress=(k-(len(frames)-tail))/(tail-1)
    rgba=np.array(frames[k])
    rgba[:,:,3]=(rgba[:,:,3].astype(float)*(1-progress)**2).round().astype('uint8')
    frames[k]=Image.fromarray(rgba)
for frame,(x,y,w,h) in zip(frames,data['frames'].values()): atlas.paste(frame,(x,y))
atlas.save(dest/f'{prefix}.png')
data.update({'frameCount':len(frames), 'cellSize':[384,384],
             'duration':duration,'frameDuration':duration/len(frames),
             'sourceVideo':'../raw/text-only-2s.mp4',
             'sourceDuration':count/native_fps,
             'sourceFps':native_fps,'referenceImages':[], 'tailOpacityFadeSeconds':.12,
             'status':'awaiting-manual-review','gameIntegrated':False,
             'cropPolicy':'one union bbox across the entire original clip',
             'blend':'straight alpha, SRC_ALPHA / ONE_MINUS_SRC_ALPHA'})
(dest/f'{prefix}.frames.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
(dest/'frames-alpha').mkdir(exist_ok=True)
for k,frame in enumerate(frames):
    frame.save(dest/'frames-alpha'/f'frost-{k:03d}.png')

font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
picked=np.linspace(0,len(frames)-1,16).round().astype(int)
sheet=Image.new('RGB',(1024,4*278+48),'#202c35')
d=ImageDraw.Draw(sheet)
d.text((16,12),'冰领域 · 连续 AI 视频抽帧 / 完整释放约 1 秒',font=font,fill='#d8edf7')
for k,idx in enumerate(picked):
    cell=Image.new('RGBA',(256,256),'#303d46')
    cell.alpha_composite(frames[idx].resize((256,256),Image.Resampling.LANCZOS))
    x,y=k%4*256,48+k//4*278
    sheet.paste(cell.convert('RGB'),(x,y))
    d.text((x+10,y+258),f'#{idx:02d} · {idx/len(frames):.2f}s',font=small,fill='#d8edf7')
sheet.save(OUT/'contact-sheet.jpg',quality=94)

floor=Image.open(GAME/'assets/resources/scenes/scene_1_1.png').convert('RGB')
floor=floor.crop((90,600,1060,1376)).resize((640,512),Image.Resampling.LANCZOS)
center=(320,275)
layer_size=384
# One shared placement for every extracted frame; no per-frame centering.
offset=(center[0]-layer_size//2,center[1]-layer_size//2)
def compose(idx):
    canvas=floor.convert('RGBA')
    if idx is not None: canvas.alpha_composite(frames[idx],offset)
    return canvas.convert('RGB')

samples=[compose(None)]*10+[compose(k) for k in range(len(frames))]+[compose(None)]*25
palette_source=Image.new('RGB',(1280,1024))
for k,idx in enumerate((picked[2],picked[5],picked[9],picked[12])):
    palette_source.paste(compose(idx),(k%2*640,k//2*512))
palette=palette_source.quantize(colors=256)
quantized=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in samples]
# GIF durations are multiples of 10 ms. Distribute rounding, preserving the
# complete sequence's one-second duration rather than dropping video frames.
ticks=[round((k+1)*100/len(frames))-round(k*100/len(frames)) for k in range(len(frames))]
timing=[20]*10+[t*10 for t in ticks]+[20]*25
quantized[0].save(OUT/'frost-domain-preview.gif',save_all=True,
                  append_images=quantized[1:],duration=timing,loop=0,optimize=True)
energy=[np.asarray(im.getchannel('A')).sum() for im in frames]
peak=int(np.argmax(energy))
compose(peak).save(OUT/'frost-domain-preview.png')
review=Image.new('RGB',(1280,1080),'#202c35')
d=ImageDraw.Draw(review)
for k,(fraction,title) in enumerate(((.14,'结冰起手'),(.36,'冰领域生效'),
                                     (.72,'碎冰与寒气消散'),(.98,'释放结束'))):
    idx=min(len(frames)-1,round(fraction*(len(frames)-1)))
    x,y=k%2*640,k//2*540
    review.paste(compose(idx),(x,y))
    d.text((x+14,y+516),title,font=font,fill='#d8edf7')
review.save(OUT/'preview-keyframes.jpg',quality=94)

report={'input':'pure text-to-video; no reference image submitted',
        'frameCount':len(frames),'sourceFps':native_fps,
        'sourceDuration':count/native_fps,'playbackDuration':1.0,
        'nativeFrameOrderPreserved':True,'fixedCropAndScale':True,
        'atlasSize':list(atlas.size),'tailOpacityFadeSeconds':.12,
        'lastFrameAlphaMax':frames[-1].getchannel('A').getextrema()[1],
        'preview':'offline ground-texture composite','gameIntegrated':False}
(OUT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
print(OUT/'frost-domain-preview.gif')
