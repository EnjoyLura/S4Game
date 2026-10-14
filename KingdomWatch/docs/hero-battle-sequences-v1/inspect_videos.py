"""Decode actual video frames and make contact sheets before choosing animation windows."""
from pathlib import Path
import sys
import json, imageio.v2 as iio, numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
FONT=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",16)
for video in sorted((ROOT/(sys.argv[1] if len(sys.argv)>1 else "videos")).glob("*.mp4")):
    out=video.with_name(video.stem+"-contact.jpg")
    if out.exists(): continue
    reader=iio.get_reader(str(video))
    meta=reader.get_meta_data()
    frames=[frame for frame in reader]
    reader.close()
    fps=float(meta["fps"])
    picks=np.linspace(0,len(frames)-1,12).round().astype(int)
    sheet=Image.new("RGB",(1200,960),"#283540")
    draw=ImageDraw.Draw(sheet)
    boxes=[]
    for k,index in enumerate(picks):
        frame=frames[index]
        mask=frame.max(axis=2)>28
        y,x=np.where(mask)
        box=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)] if len(x)>0 else None
        boxes.append(box)
        im=Image.fromarray(frame)
        im.thumbnail((296,282),Image.Resampling.LANCZOS)
        px,py=(k%4)*300,(k//4)*320
        sheet.paste(im,(px+(300-im.width)//2,py+(284-im.height)//2))
        draw.text((px+8,py+286),f"{video.stem} #{index} {index/fps:.2f}s",font=FONT,fill="white")
    sheet.save(out,quality=93)
    info={"frames":len(frames),"fps":fps,"size":[frames[0].shape[1],frames[0].shape[0]],
          "duration":len(frames)/fps,"sampleBoxes":boxes,
          "firstLastMeanAbsoluteDifference":round(float(np.abs(frames[-1].astype(float)-frames[0].astype(float)).mean()),3)}
    video.with_name(video.stem+"-meta.json").write_text(json.dumps(info,indent=2),encoding="utf-8")
    print(video.stem,info["frames"],info["fps"],info["size"],info["duration"],flush=True)
