"""Static v123 sampler-free package/media/syntax checks; never launch game/browser/combat/audio/WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-wind-code-v123';prior_package=PROJECT/'build/github-pages-wind-volume-v122'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf-8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
art=json.loads((PROJECT/'docs/wind-volume-v122/art-manifest.json').read_text('utf-8'))
retired_ids=[a['uuids']['image'] for a in art['assets']]
native=[p for p in old if '/native/' in p];retired=[p for p in native if any(u in p for u in retired_ids)]
kept=[p for p in native if p not in retired]
assert len(native)==514 and len(retired)==2 and len(kept)==512
assert all(current.get(p)==old[p] for p in kept)
assert all(p not in current for p in retired)
assert not [p for p in current if '/native/' in p and p not in old]
node='C:/Program Files/nodejs/node.exe';syntax=[]
for p in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(p)],capture_output=True,text=True);assert r.returncode==0,r.stderr
 assert not any(s in p.read_text('utf-8') for s in ['wind_volume_v122/','wind-volume-v122'])
 syntax.append(p.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf-8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True);assert r.returncode==0,r.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8'));assert not types['added']
code=json.loads((OUT/'code-check.json').read_text('utf-8'));assert code['status']=='PASS'
gpu=json.loads((OUT/'gpu-review.json').read_text('utf-8'))
source=PROJECT/'assets/resources/fx/wind-ninja-flow.effect'
assert gpu['shaderSourceSha256']==hashlib.sha256(source.read_bytes()).hexdigest()
assert gpu['runtimeEffectHasNoImagesOrSamplers'] is True
assert not re.search(r'\b(?:sampler2D|samplerCube)\b|\btexture\s*\(',source.read_text('utf-8'))
effects=[p.relative_to(package).as_posix() for p in (package/'assets/resources/import').rglob('*.json') if b'wind-ninja-fs' in p.read_bytes()]
assert len(effects)==1
assert not [p for p in (package/'assets/resources/import').rglob('*.json') if b'wind-volume-fs' in p.read_bytes()]
report={'checks':checks,'baselineCommit':'d525be22','baselineRelease':prior['id'],'existingNativeByteIdentical':len(kept),
 'retiredTextureNatives':retired,'retiredTextureBytes':sum(old[p]['bytes'] for p in retired),'newMedia':0,'compiledEffectFiles':effects,
 'runtimeEffectsHaveNoImagesOrSamplers':True,'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
 'codeCheckGroups':len(code['checks']),'gpuArtFrames':gpu['artFrames'],'typeDiagnosticsBefore':types['beforeDiagnostics'],
 'typeDiagnosticsCurrent':types['currentDiagnostics'],'actualGameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig');(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(kept),'retiredTextureBytes':report['retiredTextureBytes'],'newMedia':0,'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
