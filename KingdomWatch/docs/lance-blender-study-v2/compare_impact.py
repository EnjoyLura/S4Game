"""Synchronized previous/current offline renders, normal then half-speed impact replay."""
from pathlib import Path
import json
import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
PREV=OUT.parent/'lance-blender-study-v1'
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
old=imageio.get_reader(PREV/'golden-thunder-lance.mp4')
new=imageio.get_reader(OUT/'golden-thunder-lance.mp4')
# Same absolute frame on each side; contact remains 1.50s in both revisions.
frames=list(range(24,72))
sequence=[(f,'正常速度') for f in frames]+[(f,'0.5× 落地回放') for f in frames for repeat in range(2)]
cache={}
with imageio.get_writer(OUT/'impact-comparison.mp4',fps=24,codec='libx264',quality=9,macro_block_size=16,ffmpeg_log_level='error') as writer:
    for f,label in sequence:
        if f not in cache:
            a=Image.fromarray(old.get_data(f)).resize((640,640),Image.Resampling.LANCZOS)
            b=Image.fromarray(new.get_data(f)).resize((640,640),Image.Resampling.LANCZOS)
            cache[f]=(a,b)
        im=Image.new('RGB',(1280,720),(7,12,18))
        im.paste(cache[f][0],(0,80));im.paste(cache[f][1],(640,80))
        d=ImageDraw.Draw(im)
        d.text((28,15),'上一版 · 电弧为主',font=font,fill=(165,177,187))
        d.text((668,15),'本次 · 贯地雷爆 + 游离雷电丝',font=font,fill=(243,207,126))
        d.text((28,51),label+'  |  同步触地时刻 1.50s',font=small,fill=(127,142,153))
        d.line((640,0,640,720),fill=(55,63,74),width=1)
        writer.append_data(np.asarray(im))
        if f==40 and label=='正常速度':im.save(OUT/'impact-comparison.jpg',quality=95)
old.close();new.close()
(OUT/'comparison-info.json').write_text(json.dumps({'seconds':6,'fps':24,'size':[1280,720],'frames':144,'normalPlaybackSeconds':2,'halfSpeedPlaybackSeconds':4,'sourceIntervalSeconds':[1,3],'alignment':'same absolute frame; contact at 1.50s','left':'v1','right':'v2'},indent=2))
print('COMPARISON_COMPLETE')
