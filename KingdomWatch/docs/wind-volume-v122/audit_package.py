"""Static v122 package/art/shader verification. Never launch game/browser/combat/audio/WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-wind-volume-v122';prior_package=PROJECT/'build/github-pages-wind-ninja-v121'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf-8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
native=[p for p in old if '/native/' in p];assert len(native)==512 and all(current.get(p)==old[p] for p in native)
added=[p for p in current if '/native/' in p and p not in old];assert len(added)==2
art=json.loads((OUT/'art-manifest.json').read_text('utf-8'))
for item in art['assets']:
 assert any(item['uuids']['image'] in p for p in added)
 assert hashlib.sha256((PROJECT/item['path']).read_bytes()).hexdigest()==item['sha256']
 assert item['width']==1024 and item['height']==1024
node='C:/Program Files/nodejs/node.exe';syntax=[]
for p in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(p)],capture_output=True,text=True);assert r.returncode==0,r.stderr;syntax.append(p.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf-8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True);assert r.returncode==0,r.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8'));assert not types['added']
integration=json.loads((OUT/'volume-check.json').read_text('utf-8'));assert integration['status']=='PASS'
gpu=json.loads((OUT/'gpu-review.json').read_text('utf-8'))
assert gpu['shaderSourceSha256']==hashlib.sha256((PROJECT/'assets/resources/fx/wind-ninja-flow.effect').read_bytes()).hexdigest()
assert gpu['volumeShaderSourceSha256']==hashlib.sha256((PROJECT/'assets/resources/fx/wind-volume-v122.effect').read_bytes()).hexdigest()
assert gpu['actualGameBrowserCombatAudioOrWasmStarted'] is False
main=next(package.glob('assets/main/index.*.js')).read_text('utf-8');assert 'wind-volume-v122' in main and 'wind_volume_v122/' in main
effects=[p.relative_to(package).as_posix() for p in (package/'assets/resources/import').rglob('*.json') if any(s in p.read_bytes() for s in [b'wind-volume-fs',b'wind-ninja-fs'])]
assert len(effects)==2,effects
report={'checks':checks,'baselineCommit':'876c8b9c','baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),
 'newAtlasNatives':added,'newAtlasBytes':sum(current[p]['bytes'] for p in added),'compiledEffectFiles':effects,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'integrationCheckGroups':len(integration['tests']),'gpuArtFrames':gpu['artFrames'],
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'actualGameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig');(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'newAtlasBytes':report['newAtlasBytes'],'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
