"""Bake the supplied frost mage lobby idle. No generated imagery or game execution."""
from pathlib import Path
import importlib.util,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('lobby_bake',ROOT.parent/'frost-threat-alpha-v96/hero_idle_frames.py')
bake=importlib.util.module_from_spec(spec);spec.loader.exec_module(bake)


def matte(im,hero):
    arr=np.asarray(im).astype('int16')
    neutral=(arr.min(2)>232)&(arr.max(2)-arr.min(2)<19)
    field=Image.new('L',(im.width+2,im.height+2),255)
    field.paste(Image.fromarray((neutral*255).astype('uint8')),(1,1))
    ImageDraw.floodfill(field,(0,0),128,thresh=0)
    clear=np.asarray(field)[1:-1,1:-1]==128
    # Only neutral components connected to verified body/staff/boot voids are cleared.
    gaps=Image.fromarray((neutral*255).astype('uint8')).copy()
    for x,y in [(324,508),(392,1057),(210,759)]:
        if neutral[y,x]:ImageDraw.floodfill(gaps,(x,y),128,thresh=0)
    clear|=np.asarray(gaps)==128
    mask=Image.fromarray((~clear*255).astype('uint8')).copy()
    ImageDraw.floodfill(mask,(450,580),128,thresh=0)
    alpha=Image.fromarray(((np.asarray(mask)==128)*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.3))
    result=im.convert('RGBA');result.putalpha(alpha)
    # Cyan emission baked onto the white source must not become an opaque white patch.
    physical=Image.new('L',im.size)
    ImageDraw.Draw(physical).polygon([(54,98),(121,168),(121,229),(151,220),(165,239),(130,298),
      (128,327),(100,354),(38,306),(27,220),(44,236),(34,207)],fill=255)
    protected=np.asarray(physical.filter(ImageFilter.MaxFilter(5)))>0
    yy,xx=np.indices(arr.shape[:2])
    glow=(xx<177)&(yy>65)&(yy<365)&~protected
    strength=np.clip((255-arr.min(2).astype('float32'))/150,0,1)
    rgba=np.asarray(result).copy()
    rgba[...,3][glow]=(rgba[...,3][glow]*strength[glow]).astype('uint8')
    rgba[...,:3][glow]=np.clip((arr[...,:3][glow]-255*(1-strength[glow,None]))/
      np.maximum(.01,strength[glow,None]),0,255).astype('uint8')
    result=Image.fromarray(rgba)
    return result


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    bake.ROOT=ROOT
    bake.OUT=ROOT.parents[1]/'assets/resources/ux/hero_lobby_idle_v96'
    bake.VIDEOS={'mora':'游戏英雄待机动作视频生成 (4).mp4'}
    bake.matte=matte
    bake.main()
