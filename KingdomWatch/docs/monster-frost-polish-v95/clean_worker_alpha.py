"""Repair only the enclosed pale backdrop in the worker's left underarm, across all cels."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
ATLAS=PROJECT/'assets/resources/ux/chapter1_mob_walk_v94.png'
BEFORE=ROOT/'before/assets/resources/ux/chapter1_mob_walk_v94.png'


def main():
    original=Image.open(BEFORE).convert('RGBA');out=original.copy()
    manifest=json.loads((PROJECT/'assets/resources/ux/chapter1_mob_walk_v94.frames.json').read_text())
    records=[];previews=[]
    keys=sorted((key for key in manifest['frames'] if key.startswith('goblin_worker_w')),key=lambda key:int(key.rsplit('_w',1)[1]))
    for key in keys:
        x,y,w,h=manifest['frames'][key];before=original.crop((x,y,x+w,y+h));arr=np.asarray(before)
        # Only the screen-left elbow/torso pocket, excluding head, shoulder metal, buckle and weapon.
        rgb=arr[160:232,109:143,:3].astype('float32');alpha=arr[160:232,109:143,3]
        background=(rgb.min(2)>150)&(np.abs(rgb[:,:,0]-rgb[:,:,1])<24)&(np.abs(rgb[:,:,1]-rgb[:,:,2])<30)
        background&=(rgb[:,:,0]-rgb[:,:,2]<46)&(rgb[:,:,0]-rgb[:,:,2]>-9)&(alpha>0)
        mask=Image.new('L',(w,h));mask.paste(Image.fromarray((background*255).astype('uint8')),(109,160))
        # A tiny transition clears codec interpolation in the pocket while retaining the dark silhouette.
        feather=mask.filter(ImageFilter.GaussianBlur(.3))
        removal=np.maximum(np.asarray(mask),np.asarray(feather)).astype('uint16')
        after=arr.copy();after[:,:,3]=(arr[:,:,3].astype('uint16')*(255-removal)//255).astype('uint8')
        assert np.array_equal(arr[:,:,:3],after[:,:,:3])
        assert np.all(after[:,:,3]<=arr[:,:,3])
        changed=after[:,:,3]!=arr[:,:,3]
        ys,xs=np.where(changed)
        if not len(xs):raise ValueError('Missing underarm repair: '+key)
        records.append({'frame':key,'alphaPixelsChanged':int(changed.sum()),'fullyCleared':int(np.sum((arr[:,:,3]>0)&(after[:,:,3]==0))),
                        'changedBounds':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]})
        out.paste(Image.fromarray(after),(x,y))
        if key.endswith(('_w0','_w7','_w14','_w21')):previews.append((before,Image.fromarray(after)))
    # Other monsters, padding and unused atlas pixels must remain byte-for-byte RGBA identical.
    old=np.asarray(original);new=np.asarray(out);changed=np.any(old!=new,axis=2)
    permitted=np.zeros(changed.shape,dtype=bool)
    for key in keys:
        x,y,w,h=manifest['frames'][key];permitted[y:y+h,x:x+w]=True
    assert not np.any(changed&~permitted)
    assert np.array_equal(old[:,:,:3],new[:,:,:3])
    out.save(ATLAS,optimize=True)
    check=Image.open(ATLAS).convert('RGBA');assert check.tobytes()==out.tobytes()
    sheet=Image.new('RGB',(1280,720),'#6b825e');draw=ImageDraw.Draw(sheet)
    for i,(before,after) in enumerate(previews):
        for row,im in enumerate([before,after]):
            crop=im.crop((50,125,180,245)).resize((320,296),Image.Resampling.NEAREST)
            sheet.paste(crop,(i*320,row*355),crop)
            draw.text((i*320+8,row*355+300),('BEFORE' if row==0 else 'AFTER')+' '+str([0,7,14,21][i]),fill='white')
    sheet.save(ROOT/'worker-underarm-before-after.png')
    report={'frames':records,'workerFrames':len(records),'allRGBPixelsUnchanged':True,'otherCelsAndPaddingRGBAUnchanged':True,
            'manifestTimingAndMetaUnchanged':True,'removedAlphaOnly':True,'atlasSha256':hashlib.sha256(ATLAS.read_bytes()).hexdigest()}
    (ROOT/'alpha-clean-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'frames':len(records),'alphaPixelsChanged':sum(r['alphaPixelsChanged'] for r in records),'fullyCleared':sum(r['fullyCleared'] for r in records),'rgbUnchanged':True,'otherCelsUnchanged':True}))


if __name__=='__main__':main()
