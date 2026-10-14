from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[1]
UX=GAME/"assets/resources/ux"
font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",26)
small=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",18)
ids=["archer","sniper","pyro","volt","mora"]
names=["艾拉 · 风羽","凯尔 · 鹰眼","焰 · 辉","沃尔 · 雷霆","莫拉 · 寒霜"]
canvas=Image.new("RGB",(1500,780),"#f4e8ce")
d=ImageDraw.Draw(canvas)
d.text((25,20),"头像与新战斗形象 · 外观对照",font=font,fill="#28343f")
for k,(hero,name) in enumerate(zip(ids,names)):
    folder="hero_comic_v1" if hero=="archer" else "shop_comic_v1"
    avatar=Image.open(UX/folder/("comic_hero_"+hero+"_v1.png")).convert("RGBA")
    avatar=avatar.resize((150,150),Image.Resampling.LANCZOS)
    canvas.paste(avatar,(k*300+75,75),avatar)
    im=Image.open(ROOT/"sources"/(hero+"-ready.png")).convert("RGBA")
    im=im.crop(im.getchannel("A").point(lambda v:255 if v>20 else 0).getbbox())
    s=min(270/im.width,410/im.height)
    im=im.resize((round(im.width*s),round(im.height*s)),Image.Resampling.LANCZOS)
    canvas.paste(im,(k*300+(300-im.width)//2,660-im.height),im)
    d.text((k*300+42,690),name,font=font,fill="#28343f")
    d.text((k*300+65,737),"待机 / 攻击两套动作",font=small,fill="#6f6959")
canvas.save(ROOT/"identity-comparison.jpg",quality=94)
print(ROOT/"identity-comparison.jpg")
