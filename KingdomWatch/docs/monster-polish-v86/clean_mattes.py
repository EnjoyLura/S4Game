"""Remove enclosed source-background holes and pale matte fringe; preserve poses/crops."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
sys.path.insert(0,str(PROJECT/'build/video-processing-deps'))
import cv2

def background(rgb,loose=False):
    r,g,b=[rgb[...,i].astype('float32') for i in range(3)]
    return (rgb.min(2)>(110 if loose else 155))&(r-b<(55 if loose else 44))&(r-b>-9)&(abs(r-g)<(35 if loose else 23))&(abs(g-b)<(38 if loose else 29))

def hole(name,cx,cy,w,h,area):
    if name=='goblin_worker':
        return ((110<=cx<=133 and 180<=cy<=202 and w<=15 and h>=5)
                or (140<=cx<=163 and 199<=cy<=260)) and area>=8
    if name=='orc_axeman':
        return ((155<=cx<=200 and 175<=cy<=300) or (295<=cx<=345 and 175<=cy<=265)) and area>=20
    # Only negative space beside the staff; exclude the actual hanging ivory ornaments.
    return 104<=cx<=136 and 125<=cy<=320 and area>=60

def clean(im,name):
    arr=np.array(im);rgb=arr[...,:3];alpha=arr[...,3]
    bg=background(rgb)&(alpha>128)
    count,labels,stats,centers=cv2.connectedComponentsWithStats(bg.astype('uint8'),8)
    selected=np.zeros(alpha.shape,np.uint8);regions=[]
    for label in range(1,count):
        x,y,w,h,area=map(int,stats[label]);cx,cy=centers[label]
        if hole(name,cx,cy,w,h,area):
            selected[labels==label]=1;regions.append({'bbox':[x,y,w,h],'area':area})
    # Grow through pale compressed background at the hole edge, never through the dark outline.
    selected|=cv2.dilate(selected,np.ones((3,3),np.uint8))&background(rgb,True).astype('uint8')
    distance=cv2.distanceTransform((alpha>32).astype('uint8'),cv2.DIST_L2,3)
    fringe=(distance<=2.1)&background(rgb)&(alpha>0)
    remove=(selected>0)|fringe
    result=arr.copy();result[...,3][remove]=0
    changed=(result[...,3]!=alpha)
    return Image.fromarray(result),{'holes':regions,'alphaPixelsChanged':int(changed.sum()),
        'enclosedPixelsRemoved':int(((selected>0)&(alpha>0)).sum()),'outerFringePixelsRemoved':int((fringe&(alpha>0)).sum())}

def main():
    reports={};atlases={}
    settings=[('v81','goblin_worker'),('v81','goblin_shaman'),('v84','orc_axeman')]
    for version,name in settings:
        prior=PROJECT/'docs'/('monster-video-'+version)
        report=json.loads((prior/'bake-report.json').read_text(encoding='utf-8'))
        loop=report['loops'][name]
        resource=PROJECT/'assets/resources/ux'/('chapter1_mob_walk_'+version)
        manifest=json.loads(Path(str(resource)+'.frames.json').read_text(encoding='utf-8'))
        if version not in atlases:atlases[version]=Image.open(ROOT/'before'/resource.relative_to(PROJECT).with_suffix('.png')).convert('RGBA')
        atlas=atlases[version];details=[]
        folder=ROOT/'frames'/name;folder.mkdir(parents=True,exist_ok=True)
        cutouts=ROOT/'cutouts'/name;cutouts.mkdir(parents=True,exist_ok=True)
        for index,source_frame in enumerate(loop['sourceFrames']):
            im=Image.open(prior/'cutouts'/name/f'{source_frame:03d}.png').convert('RGBA')
            fixed,detail=clean(im,name);fixed.save(cutouts/f'{source_frame:03d}.png')
            cel=Image.new('RGBA',(320,320))
            patch=fixed.crop(loop['fixedSourceUnion']).convert('RGBa').resize(loop['fixedTargetSize'],Image.Resampling.LANCZOS).convert('RGBA')
            cel.paste(patch,loop['fixedOffset']);cel.save(folder/f'{index:03d}.png',optimize=True)
            x,y,w,h=manifest['frames'][name+f'_w{index}'];atlas.paste(cel,(x,y))
            detail.update(sourceFrame=source_frame,frameIndex=index);details.append(detail)
        reports[name]={'atlas':str(resource.relative_to(PROJECT))+'.png','frames':details,
            'fixedTransformUnchanged':True,'sourcePixelsRepainted':False}
    for version,atlas in atlases.items():atlas.save(PROJECT/f'assets/resources/ux/chapter1_mob_walk_{version}.png',optimize=True)
    (ROOT/'matte-cleanup.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Every preview frame uses the final atlas, including unchanged characters.
    all_ids={'goblin_worker':('v81','苦工',22,1),'goblin_shaman':('v81','萨满',24,1),
        'goblin_brute':('v81','盾兵',34,1),'wolf_rider':('v81','狼骑兵 +20%',24,1.2),
        'orc_axeman':('v84','斧兵（略大于盾兵）',22,1.6),'orc_siege_cart':('v84','攻城车',34,1),
        'goblin_slinger':('v84','投石兵 +30%',20,1.3),'goblin_king':('v84','将军',48,1)}
    comparison=Image.new('RGB',(1280,720),'#e5dccb');draw=ImageDraw.Draw(comparison)
    for n,(name,(v,title,radius,scale)) in enumerate(all_ids.items()):
        m=json.loads((PROJECT/f'assets/resources/ux/chapter1_mob_walk_{v}.frames.json').read_text())
        atlas=atlases[v];count=len(m['ground'][name]['feet']);frames=[]
        for i in range(count):
            x,y,w,h=m['frames'][name+f'_w{i}'];cel=atlas.crop((x,y,x+w,y+h))
            bg=Image.new('RGB',cel.size,'#e5dccb');bg.paste(cel,mask=cel.getchannel('A'));frames.append(bg)
        # A common palette prevents palette changes between GIF frames.
        pal=Image.fromarray(np.vstack([np.asarray(f.resize((80,80))) for f in frames])).quantize(colors=256)
        quant=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in frames]
        durations=[round((i+1)*100/12)*10-round(i*100/12)*10 for i in range(count)]
        quant[0].save(ROOT/(name+'.gif'),save_all=True,append_images=quant[1:],duration=durations,loop=0,disposal=2)
        x,y=n%4*320,n//4*360;h=round(radius*3.85*scale*1.5)
        rect=m['frames'][name+'_w0'];cel=atlas.crop((rect[0],rect[1],rect[0]+320,rect[1]+320)).resize((h,h),Image.Resampling.LANCZOS)
        ground=round(h*m['ground'][name]['offset']);comparison.paste(cel,(x+(320-h)//2,y+320-h+ground),cel)
        draw.text((x+14,y+8),title,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19),fill='#273c35')
        draw.line((x+15,y+320,x+305,y+320),fill='#b1a58d')
    comparison.save(ROOT/'size-comparison.png')
    # Detailed before/after frames that previously contained the large trapped patches.
    compare=Image.new('RGB',(1200,840),'#294f69');d=ImageDraw.Draw(compare)
    for row,(v,name,source,index,box) in enumerate([
        ('v81','goblin_worker',39,10,(95,155,180,265)),
        ('v81','goblin_shaman',5,0,(70,100,145,320)),
        ('v84','orc_axeman',38,17,(145,165,350,300))]):
        before=Image.open(PROJECT/f'docs/monster-video-{v}/cutouts/{name}/{source:03d}.png').convert('RGBA')
        after=Image.open(ROOT/f'cutouts/{name}/{source:03d}.png').convert('RGBA')
        for col,im in enumerate([before,after]):
            c=im.crop(box);c.thumbnail((500,240));c=c.resize((round(c.width*min(500/c.width,240/c.height)),round(c.height*min(500/c.width,240/c.height))))
            compare.paste(c,(col*600+20,row*280+35),c)
        d.text((15,row*280+8),name+' BEFORE / AFTER',fill='white')
    compare.save(ROOT/'matte-before-after.png')
    print(json.dumps({n:{'frames':len(v['frames']),'alphaPixelsChanged':sum(f['alphaPixelsChanged'] for f in v['frames'])} for n,v in reports.items()},indent=2))

if __name__=='__main__':main()
