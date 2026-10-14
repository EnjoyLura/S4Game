"""Use the video's actual 9:16 canvas and generous motion clearance."""
from pathlib import Path
from PIL import Image
import json, shutil
ROOT=Path(__file__).resolve().parent
HOST=Path("D:/AI/S4Game/美术/vfx_host")
report={}
(ROOT/"videos-v2").mkdir(exist_ok=True)
for hero in ["archer","sniper","pyro","volt","mora"]:
    im=Image.open(ROOT/"sources"/(hero+"-ready.png")).convert("RGBA")
    bbox=im.getchannel("A").point(lambda v:255 if v>24 else 0).getbbox()
    im=im.crop(bbox)
    scale=min(620/im.height,570/im.width)
    size=(round(im.width*scale),round(im.height*scale))
    xy=((768-size[0])//2,1030-size[1])
    canvas=Image.new("RGBA",(768,1344),(0,0,0,255))
    canvas.alpha_composite(im.resize(size,Image.Resampling.LANCZOS),xy)
    filename="hero_seq_v2_"+hero+"_ff.png"
    canvas.convert("RGB").save(ROOT/"sources"/filename)
    shutil.copy2(ROOT/"sources"/filename,HOST/filename)
    report[hero]={"size":[768,1344],"firstFrameRect":[*xy,*size],"footY":1030,
        "url":"https://kw-vfx-src.pages.dev/"+filename}
(ROOT/"source-layout-v2.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report))
