"""Runtime-only package and art lookup checks; never run engine or game."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'));sys.path.insert(0,str(ROOT/'tools'))
from export import validate_package
from art_resources import image_records,decode_uuid
package=ROOT/'build/github-pages-art-load-recovery-v150';before=ROOT/'build/github-pages-wind-cards-v149'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((before/'hosting-release.json').read_text('utf8'))
old=json.loads((before/prior['inventory']).read_text('utf8'))['files'];current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p]
assert all(current.get(p)==old[p] for p in native),'Existing native bytes changed'
assert set(p for p in current if '/native/' in p)==set(native),'Unexpected new media'
def item(file):return {'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8');engine=next(package.glob('cocos-js/_virtual_cc-*.js')).read_text('utf8')
assert re.search(r'get handlers\s*\(',engine),'Pinned downloader getter missing'
for marker in ['installDownloadRecovery','drawDeadline','(timeout)','wind_eye_move','wind_ult_twin','wind_mark','scytheRiftVolume']:
 assert marker in text,marker
worker=package/'hosting-cache-sw.js';worker_text=worker.read_text('utf8')
assert worker_text==(ROOT/'tools/github-pages/runtime-cache-sw.js').read_text('utf8').replace('__BASE_PATH__','/kingdom-watch-play/')
assert 'fetchComplete' in worker_text and 'AbortController' in worker_text
targets=[item(main),item(worker)]
config=json.loads(next((package/'assets/resources').glob('config.*.json')).read_text('utf8'))
records={r['uuid']:r for r in image_records(package)};art_samples=[]
for _,v in config['paths'].items():
 if v[0] in ['ux/comic_coin_v1/spriteFrame','ux/comic_nav_map_v1/spriteFrame'] or v[0].startswith('scenes/bg_campaign_') and v[0].endswith('/spriteFrame'):
  uuid=decode_uuid(config['uuids'][int(_)]).split('@')[0]
  record=records[uuid];art_samples.append(v[0]);targets.extend([item(record['native']),item(record['import'])])
assert len(art_samples)>=2,art_samples
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(file)],capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'));assert not types['added']
assert json.loads((OUT/'verification.json').read_text('utf8'))['status']=='PASS'
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'artSamples':art_samples,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),'mainSha256':item(main)['sha256'],
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'changed-runtime-files.json').write_text(json.dumps(targets,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
raw=(OUT/'export-console.txt').read_text('utf-8-sig');(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');(OUT/'export-console.txt').unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],'allNativeUnchanged':len(native),
 'artSamples':art_samples,'jsSyntax':len(syntax),'inlineSyntax':inline,'newDiagnostics':0}))
