"""Static v120 export/hash/media/syntax checks. Never start game/browser/combat/audio/WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-wind-ninja-v120'
prior_package=PROJECT/'build/github-pages-siphon-feedback-v119'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf-8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
old_native=[p for p in old if '/native/' in p]
unchanged=[p for p in old_native if current.get(p)==old[p]]
modified=[p for p in old_native if p not in unchanged]
new_native=[p for p in current if '/native/' in p and p not in old]
assert len(old_native)==509 and len(unchanged)==507
assert len(modified)==2 and all(p.endswith(('/UIBody.ttf','/UIHeading.ttf')) for p in modified),modified
assert len(new_native)==3 and all(p.endswith('.webp') for p in new_native),new_native
art=json.loads((OUT/'art-manifest.json').read_text('utf-8'))
for item in art['assets']:
 assert any(item['uuid'] in p for p in new_native),item['uuid']
 assert hashlib.sha256((PROJECT/item['path']).read_bytes()).hexdigest()==item['sha256']
assert not [p for p in new_native if any(s in p.lower() for s in ['.mp3','.wav','.mp4'])]
node='C:/Program Files/nodejs/node.exe';syntax=[]
for p in sorted(package.rglob('*.js')):
 result=subprocess.run([node,'--check',str(p)],capture_output=True,text=True)
 assert result.returncode==0,result.stderr
 syntax.append(p.relative_to(package).as_posix())
html=(package/checks['release']['entry']).read_text('utf-8');inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',html,re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 result=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True)
 assert result.returncode==0,result.stderr
 inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8'));assert not types['added']
heroes=json.loads((OUT/'verification.json').read_text('utf-8'));assert heroes['status']=='PASS' and heroes['checks']==22
volt=json.loads((OUT/'volt-field-check.json').read_text('utf-8'));assert volt['passed']
script=next(package.glob('assets/main/index.*.js')).read_text('utf-8')
assert all(s in script for s in ['赛兰·逐风','胧·影刃','volt_field','new_heroes_v120/'])
assert checks['budget_bytes']==950*1048576
report={'checks':checks,'baselineCommit':'e35c10ef','baselineRelease':prior['id'],
 'existingNativeByteIdentical':len(unchanged),'modifiedFontNatives':modified,'newAtlasNatives':new_native,
 'newAtlasBytes':sum(current[p]['bytes'] for p in new_native),
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'heroCheckGroups':heroes['checks'],
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'product200MBCapRemovedAsRequested':True,'gameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt'
if p.is_file():
 raw=p.read_text('utf-8-sig')
 (OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(unchanged),'newAtlasBytes':report['newAtlasBytes'],
 'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
