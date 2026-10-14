from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent
out=Image.new("RGB",(1536,512),"#f3e5c8")
for n,h in enumerate(["pyro","volt","mora"]):
    im=Image.open(ROOT/"frames"/h/"attack-12.png").convert("RGBA").resize((512,512))
    out.paste(im,(n*512,0),im)
out.save(ROOT/"alpha-final-check.jpg",quality=95)
