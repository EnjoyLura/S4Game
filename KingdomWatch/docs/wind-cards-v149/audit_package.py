"""Audit the exported package using bytes and JS syntax only. Never execute the game."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'));sys.path.insert(0,str(ROOT/'tools'))
from export import validate_package
from art_resources import decode_uuid
package=ROOT/'build/github-pages-wind-cards-v149';prior_package=ROOT/'build/github-pages-scythe-volume-v148'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
font_ids=[json.loads((ROOT/'assets/resources/fonts'/(name+'.ttf.meta')).read_text('utf-8-sig'))['uuid'] for name in ['UIBody','UIHeading']]
native=[p for p in old if '/native/' in p];unchanged=[p for p in native if not any(u in p for u in font_ids)]
assert all(current.get(p)==old[p] for p in unchanged),'An unrelated existing native resource changed'
assert all(any(u in p for u in font_ids) for p in current if '/native/' in p and p not in native),'Unexpected new media'
config=json.loads(next((package/'assets/resources').glob('config.*.json')).read_text('utf8'))
paths={v[0]:(decode_uuid(config['uuids'][int(k)]),config['types'][v[1]]) for k,v in config['paths'].items()}
def item(file):return {'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
targets=[];fonts=[]
for name,uuid in zip(['UIBody','UIHeading'],font_ids):
 source=ROOT/'assets/resources/fonts'/(name+'.ttf');file=next(p for p in package.rglob(name+'.ttf') if uuid in str(p))
 assert paths['fonts/'+name]==(uuid,'cc.TTFFont')
 assert source.read_bytes()==file.read_bytes()
 targets.append(item(file));fonts.append({'font':name,**item(file),'sourceBytesMatch':True})
font_report=json.loads((OUT/'font-audit.json').read_text('utf8'));assert font_report['status']=='PASS'
assert all(f['oldCharactersPreserved'] and f['added']=='吐飓' for f in font_report['fonts'])
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8')
for card in json.loads((OUT/'cards.json').read_text('utf8')):assert card['id'] in text,card['id']
for marker in ['applyWindMark','windEyeShred','windEyeMove','noKillCharge','windUltTwin','风痕易伤','长驱风暴','逆流风眼','scytheRiftVolume','lanceFlightAboveMobs']:
 assert marker in text,marker
targets.append(item(main));node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(file)],capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True,encoding='utf8');assert r.returncode==0,r.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'));assert not types['added']
for report in ['verification','ui-verification']:assert json.loads((OUT/(report+'.json')).read_text('utf8'))['status']=='PASS'
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(unchanged),'updatedFonts':fonts,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),'mainSha256':item(main)['sha256'],
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'changed-runtime-files.json').write_text(json.dumps(targets,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
raw=(OUT/'export-console.txt').read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'export-console.txt').unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'oldNativeUnchanged':len(unchanged),'updatedFonts':2,'jsSyntax':len(syntax),'inlineSyntax':inline,'newDiagnostics':0}))
