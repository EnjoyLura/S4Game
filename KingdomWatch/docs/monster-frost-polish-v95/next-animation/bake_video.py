"""Bake three consecutive source cycles using one fixed transform per monster."""
from pathlib import Path
import hashlib
import json
import math
import uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
ART=PROJECT/'assets/resources/ux'
ATLAS='chapter1_mob_walk_v95'
CELL=320
GAP=4
COLS=12
FPS=24
# Source intervals are half-open. The following source frame is inspected, not appended.
LOOPS={
    'orc_axeman':(46,95,30,'兽族斧兵',(145,210,280),(170,265)),
    'goblin_slinger':(50,93,22.5,'兽族投石兵',(115,195,285),(155,260)),
    'goblin_king':(42,81,17.5,'骑猪将军',(440,535,630),(495,580)),
}


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def font(size):return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size)


def contact(im,left,right,start_y):
    alpha=np.asarray(im.getchannel('A'))>128
    ys,xs=np.where(alpha[start_y:,left:right])
    if not len(ys):raise ValueError('Missing foot contact')
    bottom=int(ys.max())+start_y
    return float(np.median(xs[ys>=ys.max()-3]+left)),bottom+1


def save_meta(width,height):
    for extension in ['.png.meta','.frames.json.meta']:
        source=ART/('chapter1_mob_walk_v84'+extension)
        target=ART/(ATLAS+extension)
        original=json.loads(source.read_text(encoding='utf-8-sig'))
        old_uuid=original['uuid']
        new_uuid=json.loads(target.read_text(encoding='utf-8-sig'))['uuid'] if target.exists() else str(uuid.uuid4())
        meta=json.loads(json.dumps(original).replace(old_uuid,new_uuid).replace('chapter1_mob_walk_v84',ATLAS))
        if extension=='.png.meta':
            data=meta['subMetas']['f9941']['userData']
            data.update(width=width,height=height,rawWidth=width,rawHeight=height)
            data['vertices'].update(rawPosition=[-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
                                    uv=[0,height,width,height,0,0,width,0],minPos=[-width/2,-height/2,0],maxPos=[width/2,height/2,0])
        target.write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')


def main():
    analysis=json.loads((ROOT/'loop-candidates.json').read_text())
    old_manifest=json.loads((ART/'chapter1_mob_walk_v84.frames.json').read_text())
    old_atlas=Image.open(ART/'chapter1_mob_walk_v84.png').convert('RGBA')
    count=sum(end-start for start,end,*_ in LOOPS.values())
    width,height=COLS*(CELL+GAP),math.ceil(count/COLS)*(CELL+GAP)
    atlas=Image.new('RGBA',(width,height))
    manifest={'frames':{},'cycles':{},'walkSpeeds':{},'ground':{},'topRatios':{}}
    report={'source':json.loads((ROOT.parent/'next-source-info.json').read_text(encoding='utf-8')),'loops':{},'frames':count,
            'atlas':[width,height],'canvas':[CELL,CELL],'runtimePlaybackRate':1,
            'method':'full consecutive source frames; one fixed crop, scale and placement; no reversed, synthesized, interpolated or crossfaded frames'}
    all_frames={};slot=0
    for mob,(start,end,speed,label,foot_ranges,head_range) in LOOPS.items():
        if start/FPS<.5:raise ValueError('Excluded introductory frames cannot enter the cycle')
        images=[Image.open(ROOT/'cutouts'/mob/f'{i:03d}.png').convert('RGBA') for i in range(start,end)]
        boxes=[im.getchannel('A').getbbox() for im in images]
        box=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        old_boxes=[]
        for key,rect in old_manifest['frames'].items():
            if key.startswith(mob+'_w'):
                x,y,w,h=rect;old_boxes.append(old_atlas.crop((x,y,x+w,y+h)).getbbox())
        old_height=max(b[3] for b in old_boxes)-min(b[1] for b in old_boxes)
        rw,rh=box[2]-box[0],box[3]-box[1]
        scale=min(old_height/rh,(CELL-24)/rw,(CELL-24)/rh)
        target=(round(rw*scale),round(rh*scale));offset=((CELL-target[0])//2,CELL-12-target[1])
        sx,sy=target[0]/rw,target[1]/rh
        folder=ROOT/'frames'/mob;folder.mkdir(parents=True,exist_ok=True)
        frames=[];feet=[];tops=[];margins=[]
        for index,im in enumerate(images):
            cel=Image.new('RGBA',(CELL,CELL));cel.paste(im.crop(box).resize(target,Image.Resampling.LANCZOS),offset)
            cel.save(folder/f'{index:03d}.png',optimize=True);frames.append(cel)
            b=cel.getchannel('A').getbbox();margins.append([b[0],b[1],CELL-b[2],CELL-b[3]])
            if min(margins[-1])<12:raise ValueError('Insufficient transparent movement margin')
            x,y=slot%COLS*(CELL+GAP),slot//COLS*(CELL+GAP);atlas.paste(cel,(x,y))
            manifest['frames'][mob+f'_w{index}']=[x,y,CELL,CELL]
            if index==0:manifest['frames'][mob]=[x,y,CELL,CELL]
            slot+=1
            rx=analysis[mob]['roi'][0];a,m,b=[v-rx for v in foot_ranges]
            contacts=[contact(im,a,m,int(im.height*.67)),contact(im,m,b,int(im.height*.67))]
            row=[]
            for px,py in contacts:
                row.extend([round((offset[0]+(px-box[0])*sx-CELL/2)/CELL,6),round((CELL-offset[1]-(py-box[1])*sy)/CELL,6)])
            feet.append(row)
            alpha=np.asarray(im.getchannel('A'))>128
            ys,_=np.where(alpha[:,head_range[0]-rx:head_range[1]-rx])
            tops.append((CELL-offset[1]-(int(ys.min())-box[1])*sy)/CELL)
        manifest['cycles'][mob]=(end-start)/FPS;manifest['walkSpeeds'][mob]=speed
        manifest['ground'][mob]={'offset':min(min(f[1],f[3]) for f in feet),'feet':feet}
        manifest['topRatios'][mob]=round(max(tops),6)
        candidate=next(c for c in analysis[mob]['candidates'] if c['start']==start and c['end']==end)
        report['loops'][mob]={'label':label,'sourceFrames':list(range(start,end)),'firstSeconds':start/FPS,'lastSeconds':(end-1)/FPS,
                              'referenceNextFrame':end,'sourceCycleSeconds':(end-start)/FPS,'gameDefaultCycleSeconds':(end-start)/FPS,
                              'fixedSourceUnion':box,'fixedTargetSize':target,'fixedOffset':offset,'sourceUnionPixels':[rw,rh],
                              'oldVisibleUnionHeight':old_height,'minTransparentMargin':min(min(m) for m in margins),'metrics':candidate}
        all_frames[mob]=frames
        preview=[]
        for im in frames:
            bg=Image.new('RGB',im.size,'#d6e5db');bg.paste(im,mask=im.getchannel('A'));preview.append(bg)
        durations=[round((i+1)*100/FPS)*10-round(i*100/FPS)*10 for i in range(len(frames))]
        palette=Image.new('RGB',(320*len(preview),320))
        for i,im in enumerate(preview):palette.paste(im,(i*320,0))
        palette=palette.quantize(colors=256)
        quantized=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in preview]
        quantized[0].save(ROOT/(mob+'.gif'),save_all=True,append_images=quantized[1:],duration=durations,loop=0,optimize=False,disposal=2)
    atlas_path=ART/(ATLAS+'.png');atlas.save(atlas_path,optimize=True)
    (ART/(ATLAS+'.frames.json')).write_text(json.dumps(manifest,separators=(',',':'))+'\n',encoding='utf-8');save_meta(width,height)
    seam=Image.new('RGB',(5*224,3*270),'#88aab7');draw=ImageDraw.Draw(seam)
    for row,(mob,frames) in enumerate(all_frames.items()):
        info=report['loops'][mob];nxt=Image.new('RGBA',(CELL,CELL))
        nxt.paste(Image.open(ROOT/'cutouts'/mob/f"{info['referenceNextFrame']:03d}.png").crop(info['fixedSourceUnion']).resize(info['fixedTargetSize'],Image.Resampling.LANCZOS),info['fixedOffset'])
        for col,im in enumerate([frames[-2],frames[-1],frames[0],frames[1],nxt]):
            thumb=im.resize((220,220),Image.Resampling.LANCZOS);seam.paste(thumb,(col*224,row*270),thumb)
            draw.text((col*224+5,row*270+220),['last -1','LAST','FIRST','first +1','source next'][col],font=font(17),fill='#122737')
    seam.save(ROOT/'loop-seams.jpg',quality=96)
    compare=Image.new('RGB',(6*224,3*250),'#8aaab7')
    for row,(mob,frames) in enumerate(all_frames.items()):
        for col in range(6):
            im=frames[col*len(frames)//6].resize((220,220),Image.Resampling.LANCZOS);compare.paste(im,(col*224,row*250),im)
    compare.save(ROOT/'cycle-samples.jpg',quality=96)
    report['atlasSha256']=sha(atlas_path);report['pngBytes']=atlas_path.stat().st_size
    (ROOT/'bake-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'frames':count,'atlas':[width,height],'bytes':report['pngBytes'],'loops':{k:[v['sourceFrames'][0],v['sourceFrames'][-1],v['gameDefaultCycleSeconds']] for k,v in report['loops'].items()}},indent=2))


if __name__=='__main__':main()
