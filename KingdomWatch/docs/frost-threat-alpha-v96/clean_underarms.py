"""Clear bounded neutral-background pockets; retain RGB, frame order and all other atlas pixels."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
REPAIRS=[
    ('chapter1_mob_walk_v94','goblin_brute',[(85,180,125,236)]),
    ('chapter1_mob_walk_v81','wolf_rider',[(124,96,151,128),(98,72,115,108)]),
    ('chapter1_mob_walk_v95','orc_axeman',[(91,160,145,250),(201,160,253,243)]),
]


def main():
    report=[]
    sheet=Image.new('RGB',(1280,6*290),'#59785c');draw=ImageDraw.Draw(sheet)
    for row,(atlas,mob,regions) in enumerate(REPAIRS):
        source=ROOT/'before/assets/resources/ux'/(atlas+'.png')
        target=PROJECT/'assets/resources/ux'/(atlas+'.png')
        before=Image.open(source).convert('RGBA');out=before.copy()
        manifest=json.loads((PROJECT/'assets/resources/ux'/(atlas+'.frames.json')).read_text())
        keys=sorted((key for key in manifest['frames'] if key.startswith(mob+'_w')),key=lambda k:int(k.rsplit('_w',1)[1]))
        allowed=np.zeros((before.height,before.width),dtype=bool)
        records=[]
        samples={keys[i*len(keys)//4]:i for i in range(4)}
        for key in keys:
            x,y,w,h=manifest['frames'][key];cel=before.crop((x,y,x+w,y+h));arr=np.array(cel)
            rgb=arr[:,:,:3].astype('float32');alpha=arr[:,:,3]
            mask=(rgb.min(2)>145)&(np.abs(rgb[:,:,0]-rgb[:,:,1])<25)&(np.abs(rgb[:,:,1]-rgb[:,:,2])<30)
            mask&=(rgb[:,:,0]-rgb[:,:,2]<46)&(rgb[:,:,0]-rgb[:,:,2]>-9)&(alpha>0)
            local=np.zeros(mask.shape,dtype=bool)
            for l,t,r,b in regions:local[t:b,l:r]=True
            mask&=local
            hard=Image.fromarray((mask*255).astype('uint8'));blur=hard.filter(ImageFilter.GaussianBlur(.3))
            removal=np.maximum(np.asarray(hard),np.asarray(blur)).astype('uint16')
            after=arr.copy();after[:,:,3]=(alpha.astype('uint16')*(255-removal)//255).astype('uint8')
            changed=after[:,:,3]!=alpha
            records.append({'frame':key,'alphaPixelsChanged':int(changed.sum()),'fullyCleared':int(np.sum((alpha>0)&(after[:,:,3]==0)))})
            fixed=Image.fromarray(after);out.paste(fixed,(x,y));allowed[y:y+h,x:x+w]=True
            if key in samples:
                col=samples[key]
                for side,image in enumerate([cel,fixed]):
                    small=image.resize((270,270),Image.Resampling.NEAREST)
                    offset=(col*320+25,(row*2+side)*290)
                    sheet.paste(small,offset,small)
                    draw.text((col*320+4,(row*2+side)*290+270),key+(' BEFORE' if side==0 else ' AFTER'),fill='white')
        old=np.asarray(before);new=np.asarray(out)
        assert np.array_equal(old[:,:,:3],new[:,:,:3])
        assert np.all(new[:,:,3]<=old[:,:,3])
        assert not np.any(np.any(old!=new,axis=2)&~allowed)
        out.save(target,optimize=True)
        assert Image.open(target).convert('RGBA').tobytes()==out.tobytes()
        report.append({'atlas':atlas,'monster':mob,'regions':regions,'frames':records,'rgbUnchanged':True,
                       'otherCelsRGBAUnchanged':True,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    sheet.save(ROOT/'underarm-before-after.png')
    (ROOT/'alpha-clean-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps([{'monster':r['monster'],'frames':len(r['frames']),'alphaPixelsChanged':sum(f['alphaPixelsChanged'] for f in r['frames']),
                       'fullyCleared':sum(f['fullyCleared'] for f in r['frames'])} for r in report]))


if __name__=='__main__':main()
