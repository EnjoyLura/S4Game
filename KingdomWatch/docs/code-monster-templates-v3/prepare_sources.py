"""Normalize the archived still cutouts without changing original game art.

The cutouts are canonical inputs: quadrupeds were cropped from existing RGBA
atlases; the flyers were keyed from their existing flat-green reference PNGs.
No generated image/video frames are used to make the motion.
"""
from pathlib import Path
import hashlib
import json

from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[1]
BG=(237,231,214)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    rows=json.loads((HERE/'sources.json').read_text('utf-8'))
    for row in rows:
        key=row['id']
        cut_path=HERE/'sources'/f'{key}-cutout.png'
        cutout=Image.open(cut_path).convert('RGBA')
        crop=cutout.crop(row['source_crop'])
        w,h=crop.size
        small=crop.resize((round(w*row['scale']),round(h*row['scale'])),Image.Resampling.LANCZOS)
        work=Image.new('RGBA',tuple(row['work_size']))
        work.alpha_composite(small,tuple(row['work_position']))
        dest=HERE/'sources'/f'{key}.png'
        work.save(dest)
        grid=Image.new('RGBA',work.size,BG+(255,))
        grid.alpha_composite(work)
        grid=grid.convert('RGB')
        d=ImageDraw.Draw(grid)
        font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',18)
        for p in range(0,1024,64):
            d.line((p,0,p,1024),fill='#bc9984',width=1)
            d.line((0,p,1024,p),fill='#bc9984',width=1)
            d.text((p+2,3),str(p),font=font,fill='#364533')
            d.text((3,p+3),str(p),font=font,fill='#364533')
        grid.save(HERE/'sources'/f'{key}-grid.jpg',quality=94)
        row['original_sha256']=sha(PROJECT/row['path']) if (PROJECT/row['path']).exists() else row.get('original_sha256')
        row['cutout_sha256']=sha(cut_path)
        row['normalized_sha256']=sha(dest)
        row['preprocessing']='existing atlas alpha' if row['atlas_rect'] else 'green chroma key; archived RGBA cutout'
        print(key,small.size,row['normalized_sha256'][:16])
    (HERE/'sources.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding='utf-8')


if __name__=='__main__':
    main()
