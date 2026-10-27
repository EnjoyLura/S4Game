"""Check exported runtime bytes, asset lookup, lossless pixels and JS syntax. Never run game."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
from PIL import Image
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'));sys.path.insert(0,str(ROOT/'tools'))
from export import validate_package
from art_resources import image_records,decode_uuid
package=ROOT/'build/github-pages-wall-targeting-v145'
prior_package=ROOT/'build/github-pages-scythe-reaping-v144'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p];assert len(native)==531
assert all(current.get(p)==old[p] for p in native),'Existing runtime media changed'
assert {p for p in current if '/native/' in p}==set(native),'Unexpected media'
replaced=[];media=[]
def item(file):return {'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8')
for marker in ['densestBodyArea','lanceFlightAboveMobs','scytheRisingDomain']:assert marker in text,marker
old_main=next(prior_package.glob('assets/main/index.*.js'));assert main.read_bytes()!=old_main.read_bytes()
targets=[item(main)]
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(file)],capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;inline+=1
types_report=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'));assert not types_report['added']
assert json.loads((OUT/'verification.json').read_text())['status']=='PASS'
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native)-len(replaced),'replacedNative':replaced,'newMedia':media,
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
 'oldNativeUnchanged':len(native)-len(replaced),'newMedia':0,'jsSyntax':len(syntax),'inlineSyntax':inline,'newDiagnostics':0}))
