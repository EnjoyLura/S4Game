"""Artifact-only verification. Does not import or run any part of the game."""
import hashlib
import json
from pathlib import Path
import imageio.v2 as imageio
import numpy as np
from PIL import Image

OUT=Path(__file__).resolve().parent
files=sorted((OUT/'frames').glob('frame_*.png'))
assert [p.name for p in files]==[f'frame_{i:04d}.png' for i in range(1,193)]
boxes=[]
for p in files:
    im=Image.open(p)
    assert im.mode=='RGBA' and im.size==(1280,1280),(p.name,im.mode,im.size)
    a=np.asarray(im)[:,:,3]
    # Keep visible geometry inside a safe export border, including the entire lance.
    edge=max(a[:3].max(),a[-3:].max(),a[:,:3].max(),a[:,-3:].max())
    assert edge==0,(p.name,'clipped visible alpha',int(edge))
    box=im.getchannel('A').getbbox()
    boxes.append({'frame':p.name,'bbox':box,'visiblePixels':int((a>2).sum())})
assert boxes[-1]['visiblePixels']==0,'Last frame must be transparent'
videos={}
for name in ['golden-thunder-lance.mp4','game-context.mp4']:
    reader=imageio.get_reader(OUT/name)
    m=reader.get_meta_data()
    count=reader.count_frames()
    reader.close()
    assert count==192 and abs(m['fps']-24)<1e-6 and abs(m['duration']-8)<.05
    assert tuple(m['size'])==(1280,1280)
    videos[name]={'frames':count,'fps':m['fps'],'seconds':m['duration'],'size':m['size']}
source=(OUT/'build_scene.py').read_text('utf8')
assert 'for k in range(13):\n    rng=random.Random(410+k)' not in source
assert 'Wave %d crest' not in source
assert 'Wandering sheath' in source and 'Surge %d leader' in source
names=['build_scene.py','compose_preview.py','golden-thunder-lance.blend','golden-thunder-lance.mp4','game-context.mp4','golden-thunder-lance.gif','contact-sheet.jpg']
hashes={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in names}
report={'status':'PASS','scope':'independent art artifacts only','transparentFrames':len(files),'size':[1280,1280],'allBordersTransparent':True,'finalFrameClear':True,'videos':videos,'hashes':hashes,'gameStarted':False,'gameIntegrated':False,'deployed':False,'lastFrame':boxes[-1]}
(OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(report,ensure_ascii=False,indent=2))
