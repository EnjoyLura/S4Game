"""Offline file/image validation only; no engine, browser, gameplay or WASM execution."""
from pathlib import Path
import json,hashlib,math
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((ROOT/'before/assets-sha256.json').read_text())
now={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
changed=[n for n,h in old.items() if now.get(n)!=h]
expected=['assets/scripts/'+n for n in ['battle/MobAnim.ts','config/ChapterContent.ts',
    'config/Mobs.ts','config/LevelDifficulty.ts','core/GameData.ts','ui/BattleEntryWarmup.ts']]
assert sorted(changed)==sorted(expected),changed
assert not set(old)-set(now)
added=sorted(set(now)-set(old))
assert len(added)==4 and all('chapter1_mob_walk_v84' in n for n in added),added
atlas=Image.open(PROJECT/'assets/resources/ux/chapter1_mob_walk_v84.png').convert('RGBA')
manifest=json.loads((PROJECT/'assets/resources/ux/chapter1_mob_walk_v84.frames.json').read_text())
report=json.loads((ROOT/'bake-report.json').read_text());margins={}
for name,loop in report['loops'].items():
    count=len(loop['sourceFrames']);assert count==len(manifest['ground'][name]['feet'])
    assert math.isclose(manifest['cycles'][name],count/24)
    assert loop['metrics']['clippedFrames']==0
    pad=[]
    for i in range(count):
        x,y,w,h=manifest['frames'][f'{name}_w{i}']
        assert x>=0 and y>=0 and x+w<=atlas.width and y+h<=atlas.height
        frame=Image.open(ROOT/f'frames/{name}/{i:03d}.png').convert('RGBA')
        assert np.array_equal(np.array(frame),np.array(atlas.crop((x,y,x+w,y+h))))
        b=frame.getchannel('A').getbbox();pad.append(min(b[0],b[1],w-b[2],h-b[3]))
    assert min(pad)>=12,(name,min(pad));margins[name]=min(pad)
    assert manifest['frames'][name]==manifest['frames'][name+'_w0']
assert (ROOT/'before/typecheck.txt').read_text()==(ROOT/'typecheck-after.txt').read_text()
source=ROOT/'source/user-four-monsters.mp4'
assert sha(source)==report['source']['sha256']
correction=report['cartCorrection'];residual=[s['scale']*s['correctionScale'] for s in correction['samples']]
result=dict(originalAssets=len(old),currentAssets=len(now),changed=changed,added=added,removed=[],
    originalMediaUnchanged=True,typeDiagnostics='identical baseline 10',
    atlasSha256=sha(PROJECT/'assets/resources/ux/chapter1_mob_walk_v84.png'),
    frames=report['frameCount'],minimumTransparentMargin=margins,
    sourceSha256=sha(source),cartSourceZoom=correction['firstToLastZoom'],
    cartCorrectedChassisScaleRange=[min(residual),max(residual)],
    gameOrBrowserStarted=False,wasmExecuted=False)
(ROOT/'static-asset-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
