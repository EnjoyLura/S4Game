"""Measure the runtime burst footprint against the actual radius, using recorded draw calls."""
import json,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
records=json.loads((OUT/'sprite-frames.json').read_text('utf8'))
cache={}
def extents(record,kinds):
    radii=np.zeros(72,np.float64)
    for sprite in record['sprites']:
        if not any('_'+kind+'_' in sprite['texture'] for kind in kinds):continue
        if sprite['texture'] not in cache:cache[sprite['texture']]=Image.open(ROOT/'assets/resources'/sprite['texture']).convert('RGBA')
        rect=sprite['rect'];x,y,w,h=[rect[k] for k in ['x','y','width','height']]
        rgba=np.asarray(cache[sprite['texture']].crop((x,y,x+w,y+h)),np.float32)/255
        yy,xx=np.nonzero((rgba[:,:,3]*sprite['alpha']>.08)&(rgba[:,:,:3].max(axis=2)>.5))
        px=((xx+.5)/w-sprite['anchor'][0])*sprite['size'][0]+sprite['x']
        py=(1-(yy+.5)/h-sprite['anchor'][1])*sprite['size'][1]+sprite['y']-400
        a=np.mod(np.arctan2(py,px),2*np.pi);indices=np.minimum(71,np.floor(a/2/np.pi*72).astype(int))
        np.maximum.at(radii,indices,np.hypot(px,py)/250)
    return radii
measurements=[]
for index in [78,80,84,87,90,96,101,110,120]:
    record=records['frames'][index];radii=extents(record,['impact','wave','ground'])
    burst=extents(record,['impact'])
    measurements.append({'age':record['time']-record['contact'],'allDirectionsMinRadiusRatio':float(radii.min()),
      'medianRadiusRatio':float(np.median(radii)),'maxRadiusRatio':float(radii.max()),
      'burstOnlyMinRadiusRatio':float(burst.min()),'coveredAngleBinsOf72':int(np.count_nonzero(radii>=1))})
peak=max(measurements,key=lambda m:m['allDirectionsMinRadiusRatio'])
assert peak['coveredAngleBinsOf72']==72,'Peak explosion does not reach the damage boundary in every direction'
assert peak['allDirectionsMinRadiusRatio']>1.03,'Peak footprint has no outward margin'
body=[]
for i in range(48):
    image=Image.open(OUT/'layers/body'/f'{i:03d}.png').convert('RGBA')
    body.append(np.asarray(image.crop((165,190,219,850)),np.float32))
motion=[float(np.abs(body[i]-body[i-1]).mean()) for i in range(1,48)]
assert min(motion)>1,'Central current appears static'
report={'damageRadius':250,'measurement':'72 angular bins, actual drawn straight-alpha pixels > .08 and RGB > .5',
 'peak':peak,'samples':measurements,'centerMotionMinMeanPixelDelta':min(motion),
 'centerMotionMeanPixelDelta':float(np.mean(motion)),'gameStarted':False}
(OUT/'coverage-and-motion.json').write_text(json.dumps(report,indent=2)+'\n','utf8')
im=Image.open(OUT/'ultimate-087.jpg').convert('RGB');d=ImageDraw.Draw(im)
# Diagnostic only: this dashed circle is not drawn by the game.
cx,cy,r=375,440,250
for deg in range(0,360,12):d.arc((cx-r,cy-r,cx+r,cy+r),deg,deg+6,fill=(110,255,225),width=2)
d.text((22,72),'青色虚线：真实伤害半径 250（仅检查图）',font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18),fill=(150,255,225))
im.save(OUT/'damage-coverage.jpg',quality=95)
print(json.dumps(report,ensure_ascii=False))
