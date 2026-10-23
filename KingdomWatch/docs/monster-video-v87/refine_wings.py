"""Recompute wing-edge extraction from cached source cutouts, without re-decoding the video."""
from pathlib import Path
import json
from PIL import Image,ImageDraw
import analyze_video as a
ROOT=Path(__file__).resolve().parent
report=json.loads((ROOT/'loop-candidates.json').read_text())
for name in ['forest_eagle','forest_bat']:
 images=[Image.open(ROOT/(name+'-raw')/f'{i:03d}.png').convert('RGBA') for i in range(56)]
 images=a.restore_wing_edges(images,name)
 for i,im in enumerate(images):im.save(ROOT/'cutouts'/name/f'{i:03d}.png')
 report[name]=a.rank(images,a.ROIS[name]);report[name]['sourcePaddingTop']=80
 sheet=Image.new('RGB',(1200,1330),'#a7c4cc');d=ImageDraw.Draw(sheet)
 for i,im in enumerate(images):
  thumb=im.copy();thumb.thumbnail((146,170));x,y=i%8*150,i//8*190
  sheet.paste(thumb,(x+(150-thumb.width)//2,y+(170-thumb.height)//2),thumb);d.text((x+4,y+172),str(i),fill='black')
 sheet.save(ROOT/f'{name}-all-frames.jpg',quality=95)
(ROOT/'loop-candidates.json').write_text(json.dumps(report,indent=2)+'\n')
im=images[0]
im=Image.open(ROOT/'cutouts/forest_eagle/017.png');bg=Image.new('RGB',im.size,'#388197');bg.paste(im,mask=im.getchannel('A'));bg.save(ROOT/'eagle-frame17-blue.png')
