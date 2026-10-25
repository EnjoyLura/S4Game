"""Image-only offscreen composition. No game, browser, shader, audio or WASM."""
import json,hashlib,sys,subprocess
from pathlib import Path
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'))
import numpy as np
from PIL import Image,ImageDraw,ImageFont

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
W,H=512,568;CELL=384;FPS=12;MS=83
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
sheet=Image.open(OUT/'tornado-16frames.png').convert('RGBA')
frames=[sheet.crop((i%4*CELL,i//4*CELL,(i%4+1)*CELL,(i//4+1)*CELL)) for i in range(16)]
bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
bg=bg.crop((int(bg.width*.2),int(bg.height*.25),int(bg.width*.8),int(bg.height*.72))).resize((W,H),Image.Resampling.LANCZOS)
bg.convert('RGB').save(OUT/'forest-background.jpg',quality=92)
mob_data=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf8'))['frames']
mob_sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA')
for name,x,y,w in [('forest_guard',124,315,92),('forest_wasp',322,203,70),('forest_spider',276,393,72)]:
    xx,yy,ww,hh=mob_data[name]
    mob=mob_sheet.crop((xx,yy,xx+ww,yy+hh)).resize((w,round(w*hh/ww)),Image.Resampling.LANCZOS)
    bg.alpha_composite(mob,(x,y))
bg.save(OUT/'forest-composition.png')

def composition(frame,index):
    output=Image.new('RGB',(W*2,H))
    for panel in range(2):
        surface=bg.copy() if panel else Image.new('RGBA',(W,H),'#19282d')
        surface.alpha_composite(frame,(64,84))
        d=ImageDraw.Draw(surface)
        d.rectangle((0,0,W,48),fill='#142129')
        d.text((18,13),'游戏背景 · 离屏合成' if panel else '深色底 · 原始序列帧',font=font,fill='#e5f4ec')
        d.rectangle((0,H-56,W,H),fill='#142129')
        d.text((18,H-47),f'{index+1:02d}/16    12帧/秒    约1.33秒循环',font=small,fill='#d0e4dc')
        d.text((18,H-25),'仅切帧、脚点对齐；无补间、变形或淡化',font=small,fill='#9cafac')
        output.paste(surface.convert('RGB'),(W*panel,0))
    return output

composites=[composition(frame,i) for i,frame in enumerate(frames)]
composites[0].save(OUT/'offscreen-preview.webp',save_all=True,append_images=composites[1:],duration=MS,loop=0,quality=91,method=5)
composites[0].save(OUT/'offscreen-preview.gif',save_all=True,append_images=composites[1:],duration=80,loop=0,optimize=False,disposal=2)
composites[3].save(OUT/'preview-still.jpg',quality=95)
contact=Image.new('RGB',(384*4,410*4),'#19282d')
for i,frame in enumerate(frames):
    cell=Image.new('RGBA',(384,410),'#19282d');cell.alpha_composite(frame,(0,0))
    ImageDraw.Draw(cell).text((12,384),f'{i+1:02d}',font=small,fill='#e5f4ec')
    contact.paste(cell.convert('RGB'),(i%4*384,i//4*410))
contact.resize((1152,1230),Image.Resampling.LANCZOS).save(OUT/'contact-sheet.jpg',quality=95)

arrays=[np.asarray(f).astype(np.float32)/255 for f in frames]
premult=[np.concatenate((a[:,:,:3]*a[:,:,3:4],a[:,:,3:4]),axis=2) for a in arrays]
steps=[float(np.abs(premult[(i+1)%16]-premult[i]).mean()) for i in range(16)]
stats=[]
for i,a in enumerate(arrays):
    alpha=a[:,:,3];p=np.argwhere(alpha>.25)
    assert alpha.min()==0 and alpha.max()>0 and not alpha[0,:].any() and not alpha[-1,:].any()
    assert not alpha[:,0].any() and not alpha[:,-1].any()
    stats.append({'index':i,'alphaZeroFraction':round(float((alpha==0).mean()),4),'semiTransparentFraction':round(float(((alpha>0)&(alpha<1)).mean()),4),
      'alphaGT64Bounds':[int(p[:,1].min()),int(p[:,0].min()),int(p[:,1].max()+1),int(p[:,0].max()+1)]})
game_changes=subprocess.check_output(['git','diff','--name-only','HEAD','--','assets'],cwd=ROOT,text=True).strip()
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','assets'],cwd=ROOT,text=True).strip()
assert not game_changes and not untracked
report={'previewOnly':True,'tool':'built-in image_gen','selectedCandidate':1,'frameCount':16,'fps':FPS,'nominalLoopSeconds':16/FPS,
 'actualWebpLoopSeconds':16*MS/1000,'actualGifLoopSeconds':16*.08,'atlasPixels':[1536,1536],'cellPixels':[384,384],
 'sourcePixelsPerFrameApprox':[314,314],'nativeDetailUpscaled':False,'packing':'source gap-based rectangles, integer foot registration; original RGBA unchanged',
 'playback':'original generated frame order, no interpolation/morph/crossfade/reversal','frameChecks':stats,
 'adjacentPremultipliedRGBA_MAE':steps,'loopSeamMAE':steps[-1],'medianAdjacentMAE':float(np.median(steps[:-1])),
 'limitations':['Generated poses are not controlled time samples. Some similar phases repeat across rows.',
  'Frame shape and brightness still change; a finite MAE is not a seamless-animation certificate.',
  'Cell padding in the original generation is uneven; measured row cuts and foot alignment are preview packing, not production-ready frame layout.',
  'Only 16 original raster poses; more coherent frames or dedicated animation would be needed before game integration.'],
 'gameAssetsModified':False,'gameBrowserCombatAudioOrWasmStarted':False,'gameBuildRun':False,'deployed':False,
 'artifacts':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.iterdir() if p.is_file() and p.suffix in ['.png','.webp','.gif','.jpg']}}
(OUT/'preview-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({k:report[k] for k in ['frameCount','nominalLoopSeconds','loopSeamMAE','medianAdjacentMAE','gameAssetsModified','deployed']}))
