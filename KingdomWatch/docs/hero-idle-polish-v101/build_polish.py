"""Prioritize cloak closure and remove frost-staff chroma spill, using the same source videos."""
from pathlib import Path
import importlib.util,json,sys
import numpy as np
from PIL import Image,ImageFilter

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('previous',ROOT.parent/'hero-key-idles-v100/build_idles.py')
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
original_matte=previous.matte
counts=[]


def matte(rgb,hero,physical=None):
    result=original_matte(rgb,hero,physical)
    if hero!='mora':return result
    src=np.asarray(rgb).astype('float32');arr=np.asarray(result).copy();before=arr.copy()
    r,g,b=[src[...,i] for i in range(3)]
    excess=np.minimum(r,b)-g
    staff=np.zeros(excess.shape,dtype=bool);staff[:165,:145]=True
    # The ice staff has no magenta material. Remove magenta-backed glow instead of protecting it as solid.
    strength=np.clip((excess-15)/35,0,1)
    alpha=arr[...,3].astype('float32')
    alpha[staff]*=(1-strength[staff])
    # Thin pink fringe around hair/cloth is also background, not a luminous character outline.
    opaque=Image.fromarray(arr[...,3])
    edge=np.asarray(opaque.filter(ImageFilter.MinFilter(3)))<245
    fringe=edge&(excess>30)&(arr[...,3]>0)
    edge_strength=np.clip((excess-30)/65,0,1)
    alpha[fringe]*=(1-edge_strength[fringe])
    arr[...,3]=np.clip(alpha,0,255).astype('uint8')
    # Residual low-saturation pink on the staff becomes the existing blue/white light tone.
    pink=staff&(strength>0)&(arr[...,3]>0)
    arr[...,0][pink]=np.minimum(arr[...,0][pink],arr[...,1][pink])
    arr[...,:3][arr[...,3]==0]=0
    allowed=staff|fringe
    assert not np.any(np.any(arr!=before,axis=2)&~allowed)
    assert np.all(arr[...,3]<=before[...,3])
    counts.append({'frame':len(counts),'alphaPixelsChanged':int(np.sum(arr[...,3]!=before[...,3])),
      'staffPinkPixelsBefore':int(np.sum(staff&(excess>55)&(before[...,3]>100))),
      'staffPinkPixelsAfter':int(np.sum(staff&(excess>55)&(arr[...,3]>100))),
      'outsideRepairMaskRGBAUnchanged':True})
    return Image.fromarray(arr)


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    previous.ROOT=ROOT;previous.OUT=ROOT.parents[1]/'assets/resources/ux/hero_lobby_idle_v101'
    previous.matte=matte
    windows={'archer':{'start':13,'endExclusive':50},'mora':{'start':7,'endExclusive':56}}
    for hero,window in windows.items():
        folder=ROOT/hero;folder.mkdir(exist_ok=True)
        (folder/'selected-window.json').write_text(json.dumps(window,indent=2)+'\n')
    reports={hero:previous.run(hero) for hero in windows}
    (ROOT/'bake-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'mora-spill-repair.json').write_text(json.dumps(counts,indent=2)+'\n')
