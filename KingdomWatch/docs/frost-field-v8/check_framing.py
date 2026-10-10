"""Check native full-expansion frames for bright content at image borders."""
from pathlib import Path
import json
import imageio.v2 as imageio
import numpy as np
from PIL import Image

OUT=Path(__file__).resolve().parent
reader=imageio.get_reader(str(OUT/'raw/seedance-4s.mp4'))
count=reader.count_frames()
meta=reader.get_meta_data()
report={'sourceSize':list(meta['size']),'sourceFrames':count,'threshold':40,'samples':[]}
for fraction in (.28,.36,.45,.55):
    index=round((count-1)*fraction)
    frame=reader.get_data(index)
    mask=frame.max(axis=2)>40
    ys,xs=np.where(mask)
    report['samples'].append({'frame':index,'bounds':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())] if len(xs) else None,
                              'leftEdgePixels':int(mask[:,:2].sum()),
                              'rightEdgePixels':int(mask[:,-2:].sum()),
                              'topEdgePixels':int(mask[:2,:].sum()),
                              'bottomEdgePixels':int(mask[-2:,:].sum())})
    if fraction==.36: Image.fromarray(frame).save(OUT/'raw/expanded-native.png')
reader.close()
report['expansionTouchesBorder']=any(s[k]>0 for s in report['samples'] for k in ('leftEdgePixels','rightEdgePixels','topEdgePixels','bottomEdgePixels'))
(OUT/'framing-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
