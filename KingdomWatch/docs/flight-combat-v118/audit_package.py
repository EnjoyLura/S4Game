"""Static production package verification; never starts game, browser, combat, audio or WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-flight-v118'
priorPackage=PROJECT/'build/github-pages-hero-icons-v117'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((priorPackage/'hosting-release.json').read_text('utf-8'))
old=json.loads((priorPackage/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
native=[p for p in old if '/native/' in p]
assert len(native)==509 and all(current.get(p)==old[p] for p in native)
assert not [p for p in current if '/native/' in p and p not in old]
changed=subprocess.check_output(['git','diff','--name-only','72deadc','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
expected=['battle/'+p+'.ts' for p in ['AdvancedHeroVFX','BattleDirector','BattleLoot','CannonAugments','EnemyHealVFX','FireVFX','FlightPresentation','FrostUltimateVFX','Hero','ImpactFX','Monster','MonsterDeath','NewHeroes','Projectile','SiphonLaser','VoltUltimateVFX']]
expected+=['battle/FlightPresentation.ts.meta','config/ChapterContent.ts','config/Targeting.ts','config/Targeting.ts.meta','ui/EnemyTooltip.ts','ui/Panels.ts']
assert changed==sorted('KingdomWatch/assets/scripts/'+p for p in expected),changed
chapter='assets/scripts/config/ChapterContent.ts'
before=subprocess.check_output(['git','show','72deadc:KingdomWatch/'+chapter],cwd=PROJECT.parent).decode('utf-8').replace('\r\n','\n')
now=(PROJECT/chapter).read_text('utf-8')
assert now==before.replace('可被全部英雄攻击','不受地面攻击影响')
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
geometry=json.loads((OUT/'geometry-check.json').read_text('utf-8'))
assert geometry['passed'] and geometry['caseCount']==15
script=next(package.glob('assets/main/index.*.js')).read_text('utf-8')
assert all(s in script for s in ['hitY','targetLayer','groundProjectionY','mobFallback','flightLift'])
assert checks['full_package_bytes']<=200000000
report={'checks':checks,'baselineCommit':'72deadc','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
 'existingNativeByteIdentical':len(native),'newMedia':0,'chapterStatsAndArtUnchanged':True,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'geometry':geometry,
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'gameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'newMedia':0,'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))

