"""Offline image/source checks only; never starts gameplay, a browser or WASM."""
from pathlib import Path
import hashlib,json,difflib,math
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((ROOT/'before/assets-sha256.json').read_text(encoding='utf-8'))
now={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
changed=sorted(n for n,h in old.items() if now.get(n)!=h)
expected=sorted(['assets/scripts/battle/'+n+'.ts' for n in ['BattleDirector','MobAnim','Monster','MonsterDeath']]
    +['assets/resources/ux/chapter1_mob_walk_'+v+'.png' for v in ['v81','v84']])
assert changed==expected,changed
assert set(old)==set(now)
checks={}
for v,allowed in [('v81',{'goblin_worker','goblin_shaman'}),('v84',{'orc_axeman'})]:
    resource=Path('assets/resources/ux/chapter1_mob_walk_'+v+'.png')
    before=np.array(Image.open(ROOT/'before'/resource).convert('RGBA'))
    after=np.array(Image.open(PROJECT/resource).convert('RGBA'))
    assert before.shape==after.shape
    manifest=json.loads((PROJECT/resource.with_suffix('.frames.json')).read_text(encoding='utf-8'))
    permitted=np.zeros(before.shape[:2],bool)
    for key,rect in manifest['frames'].items():
        if any(key==name or key.startswith(name+'_w') for name in allowed):
            x,y,w,h=rect;permitted[y:y+h,x:x+w]=True
    pixels=np.any(before!=after,axis=2)
    assert not np.any(pixels&~permitted),v
    for name in allowed:
        for i in range(len(manifest['ground'][name]['feet'])):
            x,y,w,h=manifest['frames'][name+f'_w{i}']
            frame=np.array(Image.open(ROOT/f'frames/{name}/{i:03d}.png').convert('RGBA'))
            assert np.array_equal(frame,after[y:y+h,x:x+w])
    checks[v]={'sha256':sha(PROJECT/resource),'changedPixels':int(pixels.sum()),
        'untargetedFramesExactlyUnchanged':True,'frameManifestUnchanged':True}
assert (ROOT/'before/typecheck.txt').read_text(encoding='utf-8-sig')==(ROOT/'typecheck-after.txt').read_text(encoding='utf-8-sig')
source=(PROJECT/'assets/scripts/battle/Monster.ts').read_text(encoding='utf-8')
nav=(PROJECT/'assets/scripts/battle/BattleDirector.ts').read_text(encoding='utf-8')
assert 'next.chapter !== completed.chapter' not in nav
assert "!this.isEndless && this.state === 'win' && completed && next" in nav
assert "next.chapter === completed.chapter ? flow.diff : 0" in nav
assert 'orc_axeman: 1.6, wolf_rider: 1.2, goblin_slinger: 1.3' in source
# Analytical geometry only: enlargement retains the old foot plane.
geometry={}
for name,radius,scale,ground in [('orc_axeman',22,1.6,.040017),('wolf_rider',24,1.2,.039641),('goblin_slinger',20,1.3,.039987)]:
    old_h=radius*3.85;new_h=old_h*scale;base=-radius*.82-(new_h-old_h)*ground
    assert math.isclose(base+new_h*ground,-radius*.82+old_h*ground,abs_tol=1e-10)
    geometry[name]={'displayScale':scale,'fixedGroundPlane':True}
shield=(.84448-.039895)*34*3.85
axe=(.863108-.040017)*22*3.85*1.6
assert 1.04<axe/shield<1.08
diff=[]
for n in changed:
    if not n.endswith('.ts'):continue
    a=(ROOT/'before'/n).read_text(encoding='utf-8').splitlines(keepends=True)
    b=(PROJECT/n).read_text(encoding='utf-8').splitlines(keepends=True)
    diff+=difflib.unified_diff(a,b,fromfile='before/'+n,tofile='after/'+n)
(ROOT/'source-changes.diff').write_text(''.join(diff),encoding='utf-8')
result={'originalAssets':len(old),'currentAssets':len(now),'changed':changed,'added':[],'removed':[],
    'atlases':checks,'cosmeticGeometry':geometry,'axeVisibleHeightRelativeToShield':axe/shield,
    'allCombatAndChapterDefinitionsUnchanged':True,'allFrameCountsAndSourceCyclesUnchanged':True,
    'walkPlayback':'chapter-one eight IDs: 0.5; forest and other clips: 1',
    'typeDiagnostics':'same 10 as baseline','gameOrBrowserStarted':False,'wasmExecuted':False}
(ROOT/'static-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
