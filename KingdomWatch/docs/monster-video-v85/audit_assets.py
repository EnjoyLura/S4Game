"""Offline source/image validation; does not start the engine, browser or gameplay."""
from pathlib import Path
import hashlib,json,math,re
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((ROOT/'before/assets-sha256.json').read_text(encoding='utf-8-sig'))
now={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
changed=[n for n,h in old.items() if now.get(n)!=h]
expected=['assets/scripts/'+n for n in ['battle/MobAnim.ts','battle/Monster.ts',
    'config/ChapterContent.ts','config/ChapterWaves.ts','ui/BattleEntryWarmup.ts']]
concurrent=json.loads((ROOT/'concurrent-changes.json').read_text(encoding='utf-8-sig'))
assert sorted(changed)==sorted(expected+list(concurrent)),changed
for n,record in concurrent.items():assert now[n]==record['sha256'],n
assert not set(old)-set(now)
added=sorted(set(now)-set(old))
assert len(added)==4 and all('forest_mob_walk_v85' in n for n in added),added
path=PROJECT/'assets/resources/ux/forest_mob_walk_v85'
atlas=Image.open(str(path)+'.png').convert('RGBA')
manifest=json.loads(Path(str(path)+'.frames.json').read_text(encoding='utf-8-sig'))
report=json.loads((ROOT/'bake-report.json').read_text(encoding='utf-8-sig'));margins={}
assert set(report['loops'])=={'forest_wolf','forest_spider','forest_vine'}
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
assert (ROOT/'before/typecheck.txt').read_text(encoding='utf-8-sig')==(ROOT/'typecheck-after.txt').read_text(encoding='utf-8-sig')
assert sha(ROOT/'source/user-monsters.mp4')==report['source']['sha256']
def mobs(p):
    s=p.read_text(encoding='utf-8-sig');start=s.index('{',s.index('export const EXPANSION_MOBS:'))
    return json.JSONDecoder().raw_decode(s[start:])[0]
base=mobs(ROOT/'before/assets/scripts/config/ChapterContent.ts')
current=mobs(PROJECT/'assets/scripts/config/ChapterContent.ts')
assert set(current)-set(base)=={'forest_wolf'}
for name,original in base.items():
    expected=original.copy()
    if name in {'forest_spider','forest_vine'}:expected['artAtlas']='forest_mob_walk_v85'
    assert current[name]==expected,name
numeric={k:v for k,v in base['forest_spider'].items() if isinstance(v,(int,float,bool))}
assert all(current['forest_wolf'][k]==v for k,v in numeric.items())
# The only chapter-wave edit replaces a mob id in pre-existing chapter-two front groups.
previous=(ROOT/'before/assets/scripts/config/ChapterWaves.ts').read_text(encoding='utf-8-sig')
edited=(PROJECT/'assets/scripts/config/ChapterWaves.ts').read_text(encoding='utf-8-sig')
edited=re.sub(r'    // Forest wolves occupy existing front-line slots; wave counts, cadence and stats stay the same\.\n    const frontId = chapter === 2 && i % 4 === 2 \? \'forest_wolf\' : front;\n','',edited)
edited=edited.replace('mob: frontId, count','mob: front, count')
assert edited==previous
result=dict(originalAssets=len(old),currentAssets=len(now),changed=changed,added=added,removed=[],
    concurrentChangesPreserved=concurrent,originalMediaUnchanged=True,typeDiagnostics='identical baseline 10',
    atlasSha256=sha(Path(str(path)+'.png')),frames=report['frameCount'],
    minimumTransparentMargin=margins,sourceSha256=report['source']['sha256'],
    oldMobNumericalDefinitionsUnchanged=True,newWolfStatsMatchOldSpider=True,
    waveCountsAndCadenceUnchanged=True,forestBoarExcluded=True,
    gameOrBrowserStarted=False,wasmExecuted=False)
(ROOT/'static-asset-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
