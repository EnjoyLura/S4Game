"""Bake the selected consecutive forward video frames; never synthesize time samples."""
from pathlib import Path
import hashlib,json,math,importlib.util
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
ASSETS=PROJECT/'assets/resources/ux'
ATLAS='forest_mob_walk_v87'
CELL=320;GAP=4;COLS=10;FPS=24
LOOPS={
 'forest_eagle':(17,33,36,'黑羽猛禽',(200,375,560),(330,425)),
 'forest_bat':(14,33,36,'赤翼魔蝠',(800,990,1200),(945,1040)),
 'forest_wasp':(23,39,25,'毒针蜂',(250,385,510),(330,430)),
 'thorn_ancient':(13,47,16,'赤甲蛛王',(730,980,1240),(890,1080)),
}
FLIERS={'forest_eagle','forest_bat','forest_wasp'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def font(s):return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',s)
def contact(im,xr,y0):
 ys,xs=np.where(np.asarray(im.getchannel('A'))[y0:,xr[0]:xr[1]]>128)
 if not len(ys):raise ValueError('Missing contact')
 return float(np.median(xs[ys>=ys.max()-3])+xr[0]),int(ys.max()+y0+1)
def canvas(im,box,target,offset):
 cel=Image.new('RGBA',(CELL,CELL))
 cel.paste(im.crop(box).convert('RGBa').resize(target,Image.Resampling.LANCZOS).convert('RGBA'),offset)
 return cel
def gif(frames,path):
 backgrounds=[]
 for im in frames:
  bg=Image.new('RGB',im.size,'#b8c9cb');bg.paste(im,mask=im.getchannel('A'));backgrounds.append(bg)
 sample=Image.new('RGB',(8*160,4*160),'#b8c9cb')
 for j in range(32):sample.paste(backgrounds[j*len(backgrounds)//32].resize((160,160)),(j%8*160,j//8*160))
 palette=sample.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
 frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in backgrounds]
 durations=[round((i+1)*100/FPS)*10-round(i*100/FPS)*10 for i in range(len(frames))]
 frames[0].save(path,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=False,disposal=2)
def main():
 analysis=json.loads((ROOT/'loop-candidates.json').read_text());count=sum(e-s for s,e,*_ in LOOPS.values())
 width,height=COLS*(CELL+GAP),math.ceil(count/COLS)*(CELL+GAP)
 atlas=Image.new('RGBA',(width,height));manifest={k:{} for k in ['frames','cycles','walkSpeeds','ground','topRatios']}
 report={'source':json.loads((ROOT/'source-info.json').read_text()),'fps':FPS,'canvas':[CELL,CELL],
         'atlas':[width,height],'loops':{},'method':'continuous forward source frames, fixed union crop; spider slow zoom correction, same-video wing caps outside source image only; no blending, reversal or time interpolation'}
 slot=0;all_frames={}
 for name,(start,end,speed,label,ranges,head) in LOOPS.items():
  info=analysis[name];images=[Image.open(ROOT/'cutouts'/name/f'{i:03d}.png').convert('RGBA') for i in range(start,end)]
  boxes=[im.getchannel('A').getbbox() for im in images]
  box=[min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)]
  rw,rh=box[2]-box[0],box[3]-box[1];scale=min((CELL-24)/rw,(CELL-24)/rh,1.25)
  target=(round(rw*scale),round(rh*scale));offset=((CELL-target[0])//2,CELL-12-target[1]);sx,sy=target[0]/rw,target[1]/rh
  folder=ROOT/'frames'/name;folder.mkdir(parents=True,exist_ok=True)
  frames=[];feet=[];tops=[]
  for index,im in enumerate(images):
   cel=canvas(im,box,target,offset);cel.save(folder/f'{index:03d}.png',optimize=True);frames.append(cel)
   x,y=slot%COLS*(CELL+GAP),slot//COLS*(CELL+GAP);slot+=1
   atlas.paste(cel,(x,y));rect=[x,y,CELL,CELL];manifest['frames'][name+f'_w{index}']=rect
   if not index:manifest['frames'][name]=rect
   a,m,b=[n-info['roi'][0] for n in ranges];y0=int(im.height*.67)
   row=[]
   for px,py in [contact(im,(a,m),y0),contact(im,(m,b),y0)]:
    row.extend([round((offset[0]+(px-box[0])*sx-CELL/2)/CELL,6),round((CELL-offset[1]-(py-box[1])*sy)/CELL,6)])
   feet.append(row)
   alpha=np.asarray(im.getchannel('A'))>128;ys,_=np.where(alpha[:,head[0]-info['roi'][0]:head[1]-info['roi'][0]])
   tops.append((CELL-offset[1]-(int(ys.min())-box[1])*sy)/CELL)
  all_frames[name]=frames;manifest['cycles'][name]=(end-start)/FPS;manifest['walkSpeeds'][name]=speed
  manifest['ground'][name]={'offset':min(min(f[1],f[3]) for f in feet),'feet':[] if name in FLIERS else feet}
  manifest['topRatios'][name]=round(max(tops),6)
  candidate=next(c for c in info['candidates'] if c['start']==start and c['end']==end)
  report['loops'][name]={'label':label,'sourceFrames':list(range(start,end)),'seconds':(end-start)/FPS,
    'referenceNextFrame':end,'metrics':candidate,'fixedSourceUnion':box,'fixedTargetSize':target,'fixedOffset':offset,
    'feetBaseline':manifest['ground'][name]['offset'],'topRatio':manifest['topRatios'][name],'airborne':name in FLIERS}
  gif(frames,ROOT/(name+'.gif'))
 atlas_path=ASSETS/(ATLAS+'.png');atlas.save(atlas_path,optimize=True)
 (ASSETS/(ATLAS+'.frames.json')).write_text(json.dumps(manifest,separators=(',',':'))+'\n',encoding='utf-8')
 spec=importlib.util.spec_from_file_location('v85',ROOT.parent/'monster-video-v85/bake_video.py')
 old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old);old.ATLAS=ATLAS;old.make_meta(width,height)
 seam=Image.new('RGB',(5*190,4*225),'#b8c9cb');d=ImageDraw.Draw(seam)
 for row,(name,frames) in enumerate(all_frames.items()):
  b=report['loops'][name];nxt=canvas(Image.open(ROOT/'cutouts'/name/f'{LOOPS[name][1]:03d}.png'),b['fixedSourceUnion'],b['fixedTargetSize'],b['fixedOffset'])
  for col,im in enumerate([frames[-2],frames[-1],frames[0],frames[1],nxt]):
   small=im.resize((185,185),Image.Resampling.LANCZOS);seam.paste(small,(col*190,row*225),small)
   d.text((col*190+5,row*225+190),['last -1','last','FIRST','first +1','source next'][col],font=font(15),fill='#142d2d')
 seam.save(ROOT/'loop-seams.jpg',quality=96)
 import imageio.v2 as iio
 def four(tick):
  preview=Image.new('RGB',(640,700),'#b8c9cb');draw=ImageDraw.Draw(preview)
  for n,(name,frames) in enumerate(all_frames.items()):
   x,y=n%2*320,n//2*350;draw.text((x+12,y+8),LOOPS[name][3],font=font(20),fill='#273d35')
   cel=frames[tick%len(frames)];preview.paste(cel,(x,y+30),cel)
  return preview
 four(0).save(ROOT/'four-monsters-preview.png')
 writer=iio.get_writer(ROOT/'four-monsters-preview.mp4',fps=24,codec='libx264',macro_block_size=1,
  ffmpeg_params=['-crf','19','-pix_fmt','yuv420p','-movflags','+faststart'])
 for tick in range(192):writer.append_data(np.asarray(four(tick)))
 writer.close()
 report['spiderCorrection']=json.loads((ROOT/'spider-stabilization.json').read_text())
 report['wingRestoration']={name:json.loads((ROOT/(name+'-wing-restoration.json')).read_text()) for name in ['forest_eagle','forest_bat']}
 report['atlasSha256']=sha(atlas_path);report['frameCount']=count
 (ROOT/'bake-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'frames':count,'atlas':[width,height],'pngBytes':atlas_path.stat().st_size,
  'loops':{name:{'count':len(f),'seam':report['loops'][name]['metrics']['seamVsMedian']} for name,f in all_frames.items()}},indent=2))
if __name__=='__main__':main()
