"""Character-safe video extraction, fixed joint framing, atlas and offline review.

Never recenters/rescales individual frames. Idle loop is selected from actual
continuous frames; a reversible breathing loop is used only if the source has
no close endpoint. Character dark interiors stay opaque. Disconnected video
glows are keyed separately from opaque character interiors.
"""
from pathlib import Path
import sys, json, math
import imageio.v2 as iio
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0,"D:/AI/S4Game/美术/tools")
from mob_video2frames import key_frame
ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[1]
UX=GAME/"assets/resources/ux"
SIZE=256
IDS=["archer","sniper","pyro","volt","mora"]
NAMES={"archer":"艾拉 · 风羽","sniper":"凯尔 · 鹰眼","pyro":"焰 · 辉","volt":"沃尔 · 雷霆","mora":"莫拉 · 寒霜"}
FONT=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",18)
SMALL=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",14)
TARGETS={"archer":.72,"sniper":.76,"pyro":.80,"volt":.84,"mora":.84}

def read_video(path):
    r=iio.get_reader(str(path))
    fps=float(r.get_meta_data()["fps"])
    original=[f for f in r];r.close()
    frames=[]
    for f in original:
        im=Image.fromarray(f)
        im=im.resize((512,round(im.height*512/im.width)),Image.Resampling.LANCZOS)
        a=np.asarray(im).copy()
        border=np.concatenate([a[:12].reshape(-1,3),a[-12:].reshape(-1,3)])
        ped=np.median(border,axis=0)
        a=np.clip(a.astype(float)-ped,0,255).astype(np.uint8)
        frames.append(a)
    return frames,fps

def bbox(frame):
    y,x=np.where(frame.max(axis=2)>28)
    return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]

def matting(frame,hero,footX,baseline,bodyTop,bodyProtect):
    out=key_frame(frame,22)
    rgb=np.asarray(out)[:,:,:3].copy()
    alpha=np.asarray(out.getchannel("A")).copy()
    # Truly black enclosed negative spaces (bow/arm gaps), not navy leather.
    alpha[rgb.max(axis=2)<=7]=0
    opaqueRGB=rgb.copy()
    opaqueAlpha=alpha.copy()
    # Video models may bake colored light around staff crystals. Those are
    # translucent light, not opaque character paint. Key only this isolated
    # weapon-tip region as an effect; never use max-channel alpha on the body.
    yy,xx=np.indices(alpha.shape)
    bodyH=baseline-bodyTop
    maximum=rgb.max(axis=2).astype(float)
    minimum=rgb.min(axis=2).astype(float)
    r,g,b=[rgb[:,:,k].astype(float) for k in range(3)]
    if hero=="pyro":ray=(g<8)&(b<5)&(maximum-minimum>15)
    elif hero=="volt":ray=(g<8)&(b>r)&(maximum-minimum>15)
    elif hero=="mora":ray=(r<8)&(b>g)&(maximum-minimum>15)
    else:ray=np.zeros_like(alpha,dtype=bool)
    ray=ray&(yy<bodyTop+bodyH*.44)
    left=(xx<footX-bodyH*.09)&(yy<bodyTop+bodyH*.60)
    if hero=="pyro":candidate=left&(r>155)&(g>65)&(r-b>90)
    elif hero=="volt":candidate=left&(b>140)&(b-g>60)&(r>70)
    elif hero=="mora":candidate=left&(b>150)&(g>95)&(b-r>50)
    else:candidate=np.zeros_like(left)
    cy,cx=np.where(candidate)
    if len(cx)>10:
        # Prefer the leftmost isolated crystal, not orange hair or robe gold.
        group=cx<=cx.min()+bodyH*.14
        top=cy[group].min()+bodyH*.18
        group=group&(cy<=top)
        gemX=float(np.median(cx[group]));gemY=float(np.median(cy[group]))
        zone=(xx-gemX)**2+(yy-gemY)**2<(bodyH*.16)**2
        solid=Image.fromarray(np.where(zone&(maximum>150),255,0).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
        effect=zone&(maximum<150)&(np.asarray(solid)<1)&(alpha>0)
        effectA=maximum/255
        alpha[effect]=np.minimum(alpha[effect],maximum[effect]).astype(np.uint8)
        rgb[effect]=np.clip(rgb[effect].astype(float)/np.maximum(effectA[effect,None],.001),0,255).astype(np.uint8)
    if hero in ["pyro","volt","mora"]:
        # Whole tip excursion, including rays separated from the crystal.
        # AI flashes cannot be tracked reliably by a single bright centroid.
        zone=(xx<footX+bodyH*.02)&(yy<baseline-bodyH*.27)&((~bodyProtect)|ray)
        wood=(r>g)&(g>b*1.2+2)&(r<g*3+20)&(maximum-minimum>18)
        light=zone&((~wood)|ray)&(alpha>0)
        a=maximum/255
        alpha[light]=np.minimum(alpha[light],maximum[light]).astype(np.uint8)
        rgb[light]=np.clip(frame[light].astype(float)/np.maximum(a[light,None],.001),0,255).astype(np.uint8)
        # A baked flash can reach the source camera's edge. Fade that light
        # before the edge rather than exporting a visibly clipped rectangle.
        edge=np.minimum(np.minimum(xx,frame.shape[1]-1-xx),yy)
        alpha[light]=(alpha[light]*np.clip(edge[light]/36,0,1)).astype(np.uint8)
    if hero=="sniper":
        # Low-value neutral smoke outside Kael's colored costume/metal is
        # background residue. Preserve colored cloth and nearby hard armor.
        solid=((maximum>115)|((maximum-minimum)>28))
        solid=np.asarray(Image.fromarray(solid.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(7)))>0
        residue=(~solid)&(maximum<90)&(yy<bodyTop+bodyH*.60)&(xx>footX+bodyH*.08)&(~bodyProtect)&(alpha>0)
        a=maximum/255
        alpha[residue]=np.minimum(alpha[residue],maximum[residue]).astype(np.uint8)
        rgb[residue]=np.clip(rgb[residue].astype(float)/np.maximum(a[residue,None],.001),0,255).astype(np.uint8)
    restore=bodyProtect&(~ray)
    rgb[restore]=opaqueRGB[restore]
    alpha[restore]=opaqueAlpha[restore]
    out=Image.fromarray(np.dstack([rgb,alpha]))
    out.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.35)))
    return out

def choose_idle(frames,foot):
    tiny=[np.asarray(Image.fromarray(f).resize((96,168),Image.Resampling.BILINEAR)).astype(float) for f in frames]
    occupied=tiny[0].max(axis=2)>25
    scores=[]
    for end in range(24,len(frames)):
        cost=np.abs(tiny[end]-tiny[0])[occupied].mean()
        scores.append((float(cost),end))
    cost,end=min(scores)
    # Whole frame endpoint matching, not arbitrary per-frame alignment.
    if cost<12:
        picks=np.linspace(0,end-1,24).round().astype(int).tolist()
        return picks,list(range(24)),round(end/24,3),"continuous endpoint matched",cost
    picks=np.linspace(0,len(frames)-1,24).round().astype(int).tolist()
    return picks,list(range(24))+list(range(22,0,-1)),3.0,"continuous frames, breathing ping-pong",cost

def save_gif(samples,path,ms):
    combined=Image.new("RGB",(samples[0].width*3,samples[0].height))
    for k,index in enumerate([0,len(samples)//2,len(samples)-1]):
        combined.paste(samples[index],(samples[0].width*k,0))
    palette=combined.quantize(colors=256)
    q=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in samples]
    durations=[round((k+1)*ms/10)*10-round(k*ms/10)*10 for k in range(len(q))]
    q[0].save(path,save_all=True,append_images=q[1:],duration=durations,loop=0,disposal=2,optimize=False)

def world_sprite(cell,meta,height):
    s=height/meta["readyHeightPx"]
    return cell.resize((round(SIZE*s),round(SIZE*s)),Image.Resampling.LANCZOS),s

def build_hero(hero):
    idlePath=ROOT/"videos-v2"/(hero+"-idle"+("-v3" if hero=="sniper" else "")+".mp4")
    attackPath=ROOT/"videos-v2"/(hero+"-attack"+("-v3" if hero=="sniper" else "")+".mp4")
    if not idlePath.exists() or not attackPath.exists():
        print("pending",hero,flush=True);return
    dest=ROOT/"frames"/hero
    dest.mkdir(parents=True,exist_ok=True)
    idle,idleFPS=read_video(idlePath)
    attack,attackFPS=read_video(attackPath)
    # The service ignored idle instructions for Kael. Use only the verified
    # quiet tail, never the firing or weapon-morphing part of that video.
    idleSourceOffset=40 if hero=="sniper" else 0
    if idleSourceOffset:idle=idle[idleSourceOffset:]
    first=bbox(idle[0])
    baseline=first[3]
    footMask=idle[0].max(axis=2)>28
    fy,fx=np.where(footMask & (np.indices(footMask.shape)[0]>=baseline-round((baseline-first[1])*.18)))
    footX=(int(fx.min())+int(fx.max()))/2
    gy,gx=np.indices(footMask.shape)
    bodyH=baseline-first[1]
    protect=footMask&((gx>footX-bodyH*.14)|(gy>first[1]+bodyH*.40))
    pm=Image.fromarray(protect.astype(np.uint8)*255)
    # Near the crystal use a tight silhouette guard: a large dilation also
    # protects empty air beside the hood, making low-value flash rays opaque.
    pm=pm.resize((128,round(pm.height/4)),Image.Resampling.NEAREST).filter(ImageFilter.MaxFilter(9 if hero in ["pyro","volt","mora"] else 25))
    bodyProtect=np.asarray(pm.resize((footMask.shape[1],footMask.shape[0]),Image.Resampling.NEAREST))>0
    if hero in ["pyro","volt","mora"]:
        # The casting arm moves beyond its idle silhouette. Below the head,
        # keep those solid sleeve/skin shapes opaque; pure-color light rays
        # are still handled separately by matting's ray override.
        bodyProtect |= gy > first[1]+bodyH*.33
    if hero=="sniper":
        ipicks=np.linspace(0,len(idle)-1,24).round().astype(int).tolist()
        iloop=list(range(24))+list(range(22,0,-1))
        iduration=2.4
        loopMode="verified quiet tail, reversible cloak/breathing loop"
        loopCost=float(np.abs(idle[0].astype(float)-idle[-1].astype(float)).mean())
    else:
        ipicks,iloop,iduration,loopMode,loopCost=choose_idle(idle,(footX,baseline))
    apicks=np.linspace(0,len(attack)-1,24).round().astype(int).tolist()
    clips={"idle":(idle,ipicks),"attack":(attack,apicks)}
    boxes=[bbox(frames[i]) for frames,picks in clips.values() for i in picks]
    L=min(b[0] for b in boxes)-3;T=min(b[1] for b in boxes)-3
    R=max(b[2] for b in boxes)+3;B=max(b[3] for b in boxes)+2
    L=max(0,L);T=max(0,T)
    R=min(idle[0].shape[1],R);B=min(idle[0].shape[0],B)
    extent=max(footX-L,R-footX)
    scale=min((SIZE-18)/(2*extent),(SIZE-18)/(baseline-T))
    dw,dh=round((R-L)*scale),round((B-T)*scale)
    tx=round(SIZE/2-(footX-L)*scale)
    ty=round(SIZE-5-(baseline-T)*scale)
    cells={}
    rects={}
    atlas=Image.new("RGBA",(SIZE*8,SIZE*6),(0,0,0,0))
    footboxes=[]
    n=0
    for kind,(frames,picks) in clips.items():
        cells[kind]=[]
        for k,index in enumerate(picks):
            im=matting(frames[index],hero,footX,baseline,first[1],bodyProtect).crop((L,T,R,B)).resize((dw,dh),Image.Resampling.LANCZOS)
            cell=Image.new("RGBA",(SIZE,SIZE),(0,0,0,0))
            cell.alpha_composite(im,(tx,ty))
            cell.save(dest/(kind+"-"+str(k).zfill(2)+".png"))
            cells[kind].append(cell)
            x,y=(n%8)*SIZE,(n//8)*SIZE
            atlas.paste(cell,(x,y))
            rects[hero+"_"+kind+str(k)]=[x,y,SIZE,SIZE]
            n+=1
            # Feet diagnostics compare actual alpha, not an arbitrary crop edge.
            a=np.asarray(cell.getchannel("A"))
            ys,xs=np.where((a>180)&(np.indices(a.shape)[0]>220))
            if len(xs):footboxes.append([int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())])
    atlas.save(dest/(hero+"-atlas.png"),optimize=True)
    idleTimeline=[hero+"_idle"+str(k) for k in iloop]
    attackTimeline=[hero+"_attack"+str(k) for k in range(24)]
    readyHeight=(first[3]-first[1])*scale
    meta={"frames":rects,"hero":hero,"name":NAMES[hero],"cellSize":SIZE,"groundAnchor":[SIZE/2,SIZE-5],
        "readyHeightPx":round(readyHeight,3),"displayReadyHeight":146,
        "animations":{"idle":{"frames":idleTimeline,"seconds":iduration,"loop":True,"loopMethod":loopMode},
            "attack":{"frames":attackTimeline,"seconds":TARGETS[hero],"loop":False,"releaseFrame":12}},
        "source":{"idle":str(idlePath.relative_to(ROOT)).replace("\\","/"),
            "attack":str(attackPath.relative_to(ROOT)).replace("\\","/"),
            "fps":[idleFPS,attackFPS],"idleIndices":[i+idleSourceOffset for i in ipicks],"attackIndices":apicks,
            "jointCrop":[L,T,R,B],"fixedScale":scale,"fixedFoot":[footX,baseline]},
        "status":"material review only, not integrated","blend":"straight RGBA; SRC_ALPHA / ONE_MINUS_SRC_ALPHA",
        "diagnostics":{"idleEndpointMeanError":round(loopCost,3),
            "footBottomRange":[min(b[3] for b in footboxes),max(b[3] for b in footboxes)] if footboxes else None}}
    (dest/(hero+".frames.json")).write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding="utf-8")
    # Full 48-frame contact sheet, all cells share exactly the same canvas.
    sheet=Image.new("RGB",(SIZE*8,(SIZE+28)*6+45),"#eaddbf")
    d=ImageDraw.Draw(sheet)
    d.text((14,10),NAMES[hero]+" · 上三行待机 / 下三行攻击",font=FONT,fill="#28343f")
    for kind in ["idle","attack"]:
        offset=0 if kind=="idle" else 24
        for k,cell in enumerate(cells[kind]):
            n=offset+k;x=(n%8)*SIZE;y=(n//8)*(SIZE+28)+45
            sheet.paste(cell,(x,y),cell)
            d.text((x+10,y+SIZE+2),kind+" #"+str(k),font=SMALL,fill="#615947")
    sheet.save(ROOT/(hero+"-contact.jpg"),quality=93)
    # Two-row idle/attack review at 1.65x actual game size.
    preview=[]
    count=96
    for k in range(count):
        t=k/24
        im=Image.new("RGB",(450,650),"#f3e5c8")
        d=ImageDraw.Draw(im)
        d.text((20,15),NAMES[hero],font=FONT,fill="#28343f")
        for kind,footY in [("idle",305),("attack",620)]:
            anim=meta["animations"][kind]
            if kind=="idle":
                idx=iloop[int((t%iduration)/iduration*len(iloop))%len(iloop)]
            else:
                phase=t%1.55
                idx=min(23,int(phase/TARGETS[hero]*24)) if phase<TARGETS[hero] else 0
            sprite,s=world_sprite(cells[kind][idx],meta,220)
            x=round(225-128*s);y=round(footY-251*s)
            d.ellipse((165,footY-6,285,footY+10),fill="#ccbd9b")
            im.paste(sprite,(x,y),sprite)
            d.text((20,footY-255),"待机（循环）" if kind=="idle" else "攻击 → 回位",font=FONT,fill="#70644d")
        preview.append(im)
    save_gif(preview,ROOT/(hero+"-preview.gif"),1000/24)
    print("built",hero,"48 RGBA frames",iduration,"idle",TARGETS[hero],"attack",meta["diagnostics"],flush=True)

def compose_team():
    if not all((ROOT/"frames"/h/(h+".frames.json")).exists() for h in IDS):return
    metas={h:json.loads((ROOT/"frames"/h/(h+".frames.json")).read_text(encoding="utf-8")) for h in IDS}
    cells={h:{kind:[Image.open(ROOT/"frames"/h/(kind+"-"+str(i).zfill(2)+".png")).convert("RGBA") for i in range(24)] for kind in ["idle","attack"]} for h in IDS}
    floor=Image.open(GAME/"assets/resources/scenes/scene_1_1.png").convert("RGB")
    floor=floor.crop((0,500,1152,1415)).resize((750,596),Image.Resampling.LANCZOS)
    wall=Image.open(UX/"defense_wall.png").convert("RGBA").resize((750,321),Image.Resampling.LANCZOS)
    avatars={}
    for hero in IDS:
        folder="hero_comic_v1" if hero=="archer" else "shop_comic_v1"
        avatars[hero]=Image.open(UX/folder/("comic_hero_"+hero+"_v1.png")).convert("RGBA").resize((72,72),Image.Resampling.LANCZOS)
    montage=[];battle=[]
    for k in range(120):
        t=k/24
        im=Image.new("RGB",(1100,660),"#f3e5c8")
        d=ImageDraw.Draw(im)
        d.text((18,12),"新英雄序列帧 · 头像对照 / 待机 / 攻击",font=FONT,fill="#28343f")
        for n,hero in enumerate(IDS):
            cx=n*220+110
            im.paste(avatars[hero],(cx-36,47),avatars[hero])
            d.text((cx-68,121),NAMES[hero],font=SMALL,fill="#28343f")
            for kind,footY in [("idle",380),("attack",640)]:
                meta=metas[hero];a=meta["animations"][kind]
                if kind=="idle":
                    seq=a["frames"];name=seq[int((t%a["seconds"])/a["seconds"]*len(seq))%len(seq)]
                    idx=int(name.split("idle")[-1])
                else:
                    phase=(t-n*.15)%1.6
                    idx=min(23,int(phase/a["seconds"]*24)) if phase<a["seconds"] else 0
                sprite,s=world_sprite(cells[hero][kind][idx],meta,175)
                d.ellipse((cx-45,footY-4,cx+45,footY+7),fill="#cfbf9d")
                im.paste(sprite,(round(cx-128*s),round(footY-251*s)),sprite)
            if n==0:
                d.text((12,165),"待机",font=FONT,fill="#70644d")
                d.text((12,422),"攻击",font=FONT,fill="#70644d")
        montage.append(im)
        field=floor.copy();fd=ImageDraw.Draw(field)
        field.paste(wall,(0,365),wall)
        team=["archer","pyro","volt","mora"] if k<60 else ["sniper","pyro","volt","mora"]
        fd.text((18,15),"游戏素材合成 · 原显示尺寸 · 待机与错峰攻击",font=FONT,fill="#fff6d9",stroke_width=2,stroke_fill="#28343f")
        for n,hero in enumerate(team):
            meta=metas[hero];phase=(t-n*.18)%1.55;a=meta["animations"]["attack"]
            kind="attack" if phase<a["seconds"] else "idle"
            if kind=="attack":idx=min(23,int(phase/a["seconds"]*24))
            else:
                ia=meta["animations"]["idle"];seq=ia["frames"]
                idx=int(seq[int((t%ia["seconds"])/ia["seconds"]*len(seq))%len(seq)].split("idle")[-1])
            sprite,s=world_sprite(cells[hero][kind][idx],meta,146)
            cx=[125,290,460,625][n];fy=550
            fd.ellipse((cx-28,fy-6,cx+28,fy+7),fill="#756953")
            field.paste(sprite,(round(cx-128*s),round(fy-251*s)),sprite)
        # Existing line HUD baseline is 198 above the physical bottom.
        # HUD WYB(198,20) means center 208 above bottom, not center 198.
        fd.rounded_rectangle((55,377,695,399),radius=11,fill="#82af2e",outline="#b27f16",width=2)
        fd.text((375,388),"1000/1000",anchor="mm",font=FONT,fill="white",stroke_width=1,stroke_fill="#566c27")
        battle.append(field)
    save_gif(montage,ROOT/"all-heroes-preview.gif",1000/24)
    save_gif(battle,ROOT/"battle-composite-preview.gif",1000/24)
    montage[15].save(ROOT/"all-heroes-preview.jpg",quality=94)
    battle[15].save(ROOT/"battle-composite-preview.jpg",quality=94)
    print("team previews saved",flush=True)

if __name__=="__main__":
    for hero in (sys.argv[1:] or IDS):build_hero(hero)
    compose_team()
