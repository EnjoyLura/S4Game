from pathlib import Path
from PIL import Image,ImageDraw
import imageio_ffmpeg,json
out=Path(r"D:/AI/S4Game/KingdomWatch/docs/archer-idle-v1/reference"); out.mkdir(parents=True,exist_ok=True)
g=imageio_ffmpeg.read_frames(r"C:/Users/user/Downloads/弓箭手姿势描述.mp4",output_params=["-vf","fps=2"])
meta=next(g); frames=[]
for i,raw in enumerate(g):
 im=Image.frombytes("RGB",meta["size"],raw); im.save(out/f"frame-{i:02d}.jpg"); frames.append(im)
sheet=Image.new("RGB",(1280,4*384),(25,28,30)); d=ImageDraw.Draw(sheet)
for i,im in enumerate(frames[:8]):
 x=(i%2)*640;y=(i//2)*384;sheet.paste(im.resize((640,360)),(x,y+24));d.text((x+10,y+5),f"{i/2:.2f}s",fill="white")
sheet.save(out/"contact.jpg");(out/"metadata.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"frames":len(frames),"contact":str(out/"contact.jpg"),"meta":meta},ensure_ascii=False))
