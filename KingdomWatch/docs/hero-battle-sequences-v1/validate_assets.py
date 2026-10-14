"""Validate staged assets and fixed framing; does not start a real battle."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
report={"heroes":[],"totalCells":0,"gameIntegrated":False}
for hero in ["archer","sniper","pyro","volt","mora"]:
    folder=ROOT/"frames"/hero
    meta=json.loads((folder/(hero+".frames.json")).read_text(encoding="utf-8"))
    atlas=Image.open(folder/(hero+"-atlas.png")).convert("RGBA")
    assert atlas.size==(2048,1536)
    assert len(meta["frames"])==48
    assert meta["groundAnchor"]==[128,251]
    assert meta["displayReadyHeight"]==146
    corners=[]
    for kind in ["idle","attack"]:
        for k in range(24):
            cell=Image.open(folder/(kind+"-"+str(k).zfill(2)+".png"))
            assert cell.mode=="RGBA" and cell.size==(256,256)
            a=np.asarray(cell)
            assert a[:,:,3].min()==0 and a[:,:,3].max()==255
            name=hero+"_"+kind+str(k)
            x,y,w,h=meta["frames"][name]
            assert np.array_equal(a,np.asarray(atlas.crop((x,y,x+w,y+h))))
            corners.append(int(a[0,0,3]))
        assert all(n in meta["frames"] for n in meta["animations"][kind]["frames"])
    foot=meta["diagnostics"]["footBottomRange"]
    assert foot[1]-foot[0]<=2,(hero,foot)
    assert max(corners)==0
    assert meta["animations"]["idle"]["seconds"]>1
    assert .5<=meta["animations"]["attack"]["seconds"]<=1
    if hero=="sniper":
        assert min(meta["source"]["idleIndices"])>=40
    report["heroes"].append({"id":hero,"cells":48,"atlasSize":atlas.size,
        "atlasBytes":(folder/(hero+"-atlas.png")).stat().st_size,
        "footBottomRange":foot,"idleSeconds":meta["animations"]["idle"]["seconds"],
        "attackSeconds":meta["animations"]["attack"]["seconds"],
        "releaseFrame":meta["animations"]["attack"]["releaseFrame"],
        "loopMethod":meta["animations"]["idle"]["loopMethod"]})
    report["totalCells"]+=48
for preview in ["all-heroes-preview.gif","battle-composite-preview.gif"]:
    im=Image.open(ROOT/preview)
    duration=0
    for k in range(im.n_frames):
        im.seek(k);duration+=im.info.get("duration",0)
    assert im.n_frames>60
    report[preview]={"frames":im.n_frames,"durationMs":duration,"size":im.size}
(ROOT/"asset-validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False))
