"""Offline file, metadata and image checks; never runs game code or a browser."""
from pathlib import Path
import hashlib,json,math,difflib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parent.parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((ROOT/'before/assets-sha256.json').read_text(encoding='utf-8-sig'))
now={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
changed=sorted(n for n,h in old.items() if now.get(n)!=h)
expected=['assets/scripts/'+n for n in ['battle/MobAnim.ts','battle/Monster.ts','config/ChapterContent.ts','config/ChapterWaves.ts','ui/BattleEntryWarmup.ts']]
assert changed==sorted(expected),changed
assert not set(old)-set(now)
added=sorted(set(now)-set(old));assert len(added)==4 and all('forest_mob_walk_v87' in n for n in added),added
path=PROJECT/'assets/resources/ux/forest_mob_walk_v87'
atlas=Image.open(str(path)+'.png').convert('RGBA')
manifest=json.loads(Path(str(path)+'.frames.json').read_text(encoding='utf-8-sig'))
report=json.loads((ROOT/'bake-report.json').read_text(encoding='utf-8-sig'));margins={}
for name,loop in report['loops'].items():
 count=len(loop['sourceFrames']);assert math.isclose(manifest['cycles'][name],count/24)
 assert len(manifest['ground'][name]['feet'])==(0 if loop['airborne'] else count)
 assert loop['sourceFrames']==list(range(loop['sourceFrames'][0],loop['sourceFrames'][-1]+1))
 assert loop['metrics']['clippedFrames']==0,(name,loop['metrics'])
 pad=[]
 for i in range(count):
  x,y,w,h=manifest['frames'][f'{name}_w{i}'];assert x>=0 and y>=0 and x+w<=atlas.width and y+h<=atlas.height
  frame=Image.open(ROOT/f'frames/{name}/{i:03d}.png').convert('RGBA')
  assert np.array_equal(np.asarray(frame),np.asarray(atlas.crop((x,y,x+w,y+h))))
  b=frame.getchannel('A').getbbox();pad.append(min(b[0],b[1],w-b[2],h-b[3]))
 assert min(pad)>=12,(name,min(pad));margins[name]=min(pad)
 assert manifest['frames'][name]==manifest['frames'][name+'_w0']
 if name in {'forest_eagle','forest_bat'}:
  restoration=report['wingRestoration'][name]
  for source_index in loop['sourceFrames']:
   rec=restoration['frames'][source_index]
   assert all(not w.get('unresolved') and w['restoredPixels']>0 for w in rec['wings'])
   raw=Image.open(ROOT/(name+'-raw')/f'{source_index:03d}.png').convert('RGBA')
   fixed=Image.open(ROOT/'cutouts'/name/f'{source_index:03d}.png').convert('RGBA')
   assert np.array_equal(np.asarray(raw),np.asarray(fixed.crop((0,80,raw.width,raw.height+80))))
assert (ROOT/'before/typecheck.txt').read_text(encoding='utf-8-sig')==(ROOT/'typecheck-after.txt').read_text(encoding='utf-8-sig')
assert sha(ROOT/'source/user-monsters.mp4')==report['source']['sha256']
def mobs(p):
 s=p.read_text(encoding='utf-8-sig');start=s.index('{',s.index('export const EXPANSION_MOBS:'))
 return json.JSONDecoder().raw_decode(s[start:])[0]
base=mobs(ROOT/'before/assets/scripts/config/ChapterContent.ts');current=mobs(PROJECT/'assets/scripts/config/ChapterContent.ts')
assert set(current)-set(base)=={'forest_eagle','forest_bat'}
for name,original in base.items():
 expected_def=original.copy()
 if name in {'forest_wasp','thorn_ancient'}:expected_def['artAtlas']='forest_mob_walk_v87'
 if name=='thorn_ancient':expected_def['name']='赤甲蛛王'
 assert current[name]==expected_def,name
numeric={k:v for k,v in base['forest_spider'].items() if isinstance(v,(int,float,bool))}
for name in ['forest_eagle','forest_bat']:assert all(current[name][k]==v for k,v in numeric.items())
previous=(ROOT/'before/assets/scripts/config/ChapterWaves.ts').read_text(encoding='utf-8-sig')
edited=(PROJECT/'assets/scripts/config/ChapterWaves.ts').read_text(encoding='utf-8-sig')
edited=edited.replace('// Forest variants share existing front-line slots; counts and cadence stay the same.',
 '// Forest wolves occupy existing front-line slots; wave counts, cadence and stats stay the same.')
edited=edited.replace("chapter === 2 ? [front, 'forest_eagle', 'forest_wolf', 'forest_bat'][i % 4] : front",
 "chapter === 2 && i % 4 === 2 ? 'forest_wolf' : front")
assert edited==previous
diff=''.join(''.join(difflib.unified_diff((ROOT/'before'/n).read_text(encoding='utf-8-sig').splitlines(True),
 (PROJECT/n).read_text(encoding='utf-8-sig').splitlines(True),fromfile='before/'+n,tofile='after/'+n)) for n in expected)
(ROOT/'source-changes.diff').write_text(diff,encoding='utf-8')
result={'originalAssets':len(old),'currentAssets':len(now),'changed':changed,'added':added,'removed':[],
 'originalMediaAndFirstChapterAdjustmentsUnchanged':True,'typeDiagnostics':'identical baseline 10',
 'atlasSha256':sha(Path(str(path)+'.png')),'frames':report['frameCount'],'minimumTransparentMargin':margins,
 'oldMobNumericalDefinitionsUnchanged':True,'newFlyerStatsMatchOldSpider':True,'waveCountsAndCadenceUnchanged':True,
 'gameOrBrowserStarted':False,'wasmExecuted':False}
(ROOT/'static-asset-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
