"""Check exported runtime bytes, asset lookup, lossless pixels and JS syntax. Never run game."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
from PIL import Image
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'));sys.path.insert(0,str(ROOT/'tools'))
from export import validate_package
from art_resources import image_records,decode_uuid
package=ROOT/'build/github-pages-lance-blender-live-v142'
prior_package=ROOT/'build/github-pages-lance-storm-v141'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p];assert len(native)==524
assert all(current.get(p)==old[p] for p in native),'Existing media changed'
new_native={p for p in current if '/native/' in p}-set(native);assert len(new_native)==4
records={r['uuid']:r for r in image_records(package)}
config=json.loads(next((package/'assets/resources').glob('config.*.json')).read_text('utf8'))
types=config['types'];paths={value[0]:(decode_uuid(config['uuids'][int(key)]),types[value[1]]) for key,value in config['paths'].items()}
def item(file):return {'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
targets=[];media=[]
for kind in ['body','impact','wave','ground']:
 path='fx/thunder_lance_'+kind+'_v142'
 source=ROOT/'assets/resources'/(path+'.png');manifest=source.with_suffix('.frames.json')
 meta=json.loads(source.with_suffix('.png.meta').read_text('utf8'));m=json.loads(manifest.read_text('utf8'))
 json_uuid=json.loads(manifest.with_suffix('.json.meta').read_text('utf8'))['uuid']
 assert paths[path+'/spriteFrame']==(meta['uuid']+'@f9941','cc.SpriteFrame')
 assert paths[path+'.frames']==(json_uuid,'cc.JsonAsset')
 assert meta['userData']['redirect']==meta['uuid']+'@6c48a'
 record=records[meta['uuid']];image=Image.open(record['native']).convert('RGBA');original=Image.open(source).convert('RGBA')
 assert image.size==original.size and image.tobytes()==original.tobytes(),'Lossless atlas pixels differ'
 assert record['native'].relative_to(package).as_posix() in new_native
 for x,y,w,h in m['frames']:
  cell=image.crop((x,y,x+w,y+h));a=cell.getchannel('A')
  assert a.crop((0,0,w,2)).getbbox() is None and a.crop((0,h-2,w,h)).getbbox() is None
  assert a.crop((0,0,2,h)).getbbox() is None and a.crop((w-2,0,w,h)).getbbox() is None
 media.append({'kind':kind,**item(record['native']),'bytes':record['native'].stat().st_size,
   'size':image.size,'frames':m['frameCount'],'losslessRGBA':True,'spriteAndManifestRegistered':True})
 targets.extend([item(record['native']),item(record['import'])])
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8')
for marker in ['blenderLanceFlight','blenderPlantedAndRecall','blenderThunderDetonation','blenderSurfacePasses','thunder_lance_','_v142','lanceFlightPlan']:
 assert marker in text,marker
targets.append(item(main))
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(file)],capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;inline+=1
types_report=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'));assert not types_report['added']
assert json.loads((OUT/'verification.json').read_text())['status']=='PASS'
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'newMedia':media,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),
 'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),'typeDiagnosticsBefore':types_report['beforeDiagnostics'],
 'typeDiagnosticsCurrent':types_report['currentDiagnostics'],'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'changed-runtime-files.json').write_text(json.dumps(targets,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
raw=(OUT/'export-console.txt').read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'export-console.txt').unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'oldNativeUnchanged':len(native),'losslessAtlases':4,'jsSyntax':len(syntax),'inlineSyntax':inline,'newDiagnostics':0}))
