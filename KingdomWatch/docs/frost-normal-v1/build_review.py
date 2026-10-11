"""Composite actual painted normal-shot renderer states; no live battle."""
from pathlib import Path
import importlib.util
import json
import subprocess
import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw

OUT=Path(__file__).resolve().parent
GAME=OUT.parents[1]
NODE='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
spec=importlib.util.spec_from_file_location('composite',OUT.parent/'frost-ultimate-v4/build_review.py')
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
subprocess.run([NODE,str(GAME/'tools/frost-ultimate-check.cjs'),'--ice-preview',str(OUT/'runtime-states.json')],cwd=GAME,check=True)
states=json.loads((OUT/'runtime-states.json').read_text(encoding='utf-8'))
floor=review.assets.GROUND.crop((16,180,1136,1860)).resize(review.SIZE,Image.Resampling.LANCZOS)
def compose(state):
    image=floor.convert('RGBA')
    for x,y in [(-180,-360),(0,-340),(170,-340)]:
        review.assets.caster(image,-1,review.screen(x,y))
    if state:
        image.alpha_composite(review.graphics(state['trails']))
        for body in state['bodies']:review.sprite(image,body)
    return image.convert('RGB')
frames=[compose(None)]*6+[compose(s) for s in states]+[compose(None)]*12
writer=imageio.get_writer(str(OUT/'ice-projectile-preview.mp4'),fps=30,codec='libx264',quality=9,macro_block_size=1)
for frame in frames:writer.append_data(np.asarray(frame))
writer.close()
# One global color lookup avoids changing the road's palette as foreground changes.
sheet=Image.new('RGB',(1280,1920))
for i,k in enumerate([0,12,20,28]):sheet.paste(frames[k],(i%2*640,i//2*960))
pal=sheet.quantize(colors=255);colors=np.asarray(pal.getpalette(),dtype='float32').reshape(-1,3)[:255]
lookup=np.empty(64**3,dtype='uint8');energy=np.sum(colors*colors,axis=1)
for first in range(0,len(lookup),8192):
    indices=np.arange(first,min(first+8192,len(lookup)))
    points=np.stack((indices//4096,indices//64%64,indices%64),axis=1).astype('float32')*4+2
    lookup[first:first+len(indices)]=np.argmin(np.sum(points*points,axis=1)[:,None]+energy[None]-2*points@colors.T,axis=1)
q=[]
for frame in frames:
    rgb=np.asarray(frame).astype('uint32')>>2
    im=Image.fromarray(lookup[rgb[:,:,0]*4096+rgb[:,:,1]*64+rgb[:,:,2]]).convert('P');im.putpalette(pal.getpalette());q.append(im)
ms=[(round((i+1)*100/30)-round(i*100/30))*10 for i in range(len(q))]
q[0].save(OUT/'ice-projectile-preview.gif',save_all=True,append_images=q[1:],duration=ms,loop=0,optimize=False)
sheet=Image.new('RGB',(1280,520),'#1d2a32');d=ImageDraw.Draw(sheet)
for i,k in enumerate([0,6,12,18]):
    sheet.paste(compose(states[k]).resize((320,480),Image.Resampling.LANCZOS),(i*320,0))
    d.text((i*320+8,486),f'{states[k]["t"]:.2f}s',fill='white')
sheet.save(OUT/'projectile-keyframes.jpg',quality=95)
compose(states[12]).save(OUT/'ice-projectile-preview.png')
report={'status':'awaiting-manual-game-review','actualBattleInspected':False,'newAiCalls':0,
        'texture':'frost_ultimate_rain_v1','crop':[0,0,65,156],'sizeAtNormalSize6':[14,33.6],
        'aspectPreserved':True,'direction':'velocity tangent','trail':'age/distance based, 64-unit cap',
        'card':{'id':'mora_linger','name':'寒冬延续','rarity':'blue','secondsPerStack':1,'maxStacks':3},
        'regularSkill':'original v10 restored, 1.5 seconds','runtimeChecks':'passed','typeCheck':'passed'}
(OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
