"""Inspect the generated video assets only; no browser/gameplay checks."""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio

OUT = Path(__file__).resolve().parent
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 15)

def decode(path):
    reader = imageio.get_reader(str(path))
    meta = reader.get_meta_data()
    frames = [Image.fromarray(f).resize((768,768), Image.Resampling.LANCZOS)
              for f in reader]
    reader.close()
    return frames, meta

def inspect(path):
    frames, meta = decode(path)
    fps = float(meta.get('fps', 24))
    picks = np.linspace(0, len(frames)-1, min(24,len(frames))).round().astype(int)
    sheet = Image.new('RGB', (6*256, 4*282), '#20262d')
    draw = ImageDraw.Draw(sheet)
    for k,idx in enumerate(picks):
        x,y=k%6*256,k//6*282
        sheet.paste(frames[idx].resize((256,256),Image.Resampling.LANCZOS),(x,y))
        draw.text((x+8,y+258), f'{idx/fps:.2f}s · #{idx}',font=font,fill='#dcecf2')
    sheet.save(OUT / f'{path.stem}-video-review.jpg', quality=95)
    measures=[]
    for idx,frame in enumerate(frames):
        a=np.asarray(frame).astype(float)
        # One corner-sampled black level, including all four frame corners.
        patches=np.concatenate([a[:24,:24].reshape(-1,3),a[:24,-24:].reshape(-1,3),
                                a[-24:,:24].reshape(-1,3),a[-24:,-24:].reshape(-1,3)])
        ped=np.median(patches,axis=0)
        clean=np.maximum(a-ped,0)
        mass=clean.max(axis=2)
        mask=mass>20
        ys,xs=np.where(mask)
        bounds=[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1] if len(xs) else None
        measures.append({'index':idx,'time':idx/fps,'pedestal':ped.tolist(),
                         'meanLight':float(mass.mean()),'brightPixels':int(mask.sum()),
                         'bounds':bounds})
    report={'video':path.name,'fps':fps,'frameCount':len(frames),
            'duration':len(frames)/fps,'originalSize':list(meta['size']),
            'normalizedSize':[768,768], 'measures':measures}
    (OUT / f'{path.stem}-video-inspection.json').write_text(
        json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='measures'}))
    print('light samples',[(round(m['time'],2),round(m['meanLight'],2))
                           for m in measures[::max(1,len(measures)//12)]])

if __name__ == '__main__':
    for name in sys.argv[1:]: inspect(OUT / 'raw' / name)
