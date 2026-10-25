"""Static v119 hashes/media/syntax verification. No game/browser/combat/audio/WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-siphon-feedback-v119'
priorPackage=PROJECT/'build/github-pages-flight-v118'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((priorPackage/'hosting-release.json').read_text('utf-8'))
old=json.loads((priorPackage/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
native=[p for p in old if '/native/' in p]
assert len(native)==509 and all(current.get(p)==old[p] for p in native)
assert not [p for p in current if '/native/' in p and p not in old]
changed=subprocess.check_output(['git','diff','--name-only','4789bdc2','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
expected=['battle/BattleDirector.ts','battle/FloatText.ts','battle/Hero.ts','battle/NewHeroes.ts',
 'config/Cards.ts','config/Targeting.ts','core/EventBus.ts','ui/HUD.ts']
assert changed==sorted('KingdomWatch/assets/scripts/'+p for p in expected),changed
cards='assets/scripts/config/Cards.ts'
before=subprocess.check_output(['git','show','4789bdc2:KingdomWatch/'+cards],cwd=PROJECT.parent).decode('utf-8').replace('\r\n','\n')
assert (PROJECT/cards).read_text('utf-8')==before.replace('副光束伤害50%','伤害为主光束的50%')
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
feedback=json.loads((OUT/'feedback-check.json').read_text('utf-8'));assert feedback['passed'] and len(feedback['cases'])==5
script=next(package.glob('assets/main/index.*.js')).read_text('utf-8')
assert all(s in script for s in ['target_blocked','无法对空','暂无目标','no-target'])
assert checks['full_package_bytes']<=200000000
report={'checks':checks,'baselineCommit':'4789bdc2','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
 'existingNativeByteIdentical':len(native),'newMedia':0,'cardParametersUnchanged':True,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'feedback':feedback,
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'gameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'newMedia':0,'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'feedbackGroups':5,'newDiagnostics':0}))

