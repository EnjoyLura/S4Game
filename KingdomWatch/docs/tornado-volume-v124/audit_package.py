"""Static package/source consistency, SHA, paths and JS checks. No game execution."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-tornado-volume-v124'
prior_package=PROJECT/'build/github-pages-wind-code-v123'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p]
assert len(native)==512 and all(current.get(p)==old[p] for p in native)
assert not [p for p in current if '/native/' in p and p not in old]
syntax=[];node='C:/Program Files/nodejs/node.exe'
for p in sorted(package.rglob('*.js')):
    r=subprocess.run([node,'--check',str(p)],capture_output=True,text=True);assert r.returncode==0,r.stderr
    syntax.append(p.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
    if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
    r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True);assert r.returncode==0,r.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf8'));assert not types['added']
scope=json.loads((OUT/'code-check.json').read_text('utf8'));assert scope['status']=='PASS'
gpu=json.loads((OUT/'gpu-review.json').read_text('utf8'))
source=PROJECT/'assets/resources/fx/wind-ninja-flow.effect'
assert gpu['shaderSourceSha256']==hashlib.sha256(source.read_bytes()).hexdigest()
assert gpu['runtimeEffectHasNoImagesOrSamplers'] and gpu['artFrames']==300
effects=[p.relative_to(package).as_posix() for p in (package/'assets/resources/import').rglob('*.json') if b'wind-ninja-fs' in p.read_bytes()]
assert len(effects)==1
compiled=(package/effects[0]).read_text('utf8')
assert 'tornadoDust' in compiled and 'flowNoise' in compiled
assert not re.search(r'\b(?:sampler2D|samplerCube)\b|\btexture\s*\(',compiled)
report={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'newMedia':0,
 'compiledEffectFiles':effects,'runtimeEffectsHaveNoImagesOrSamplers':True,'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
 'gpuArtFrames':gpu['artFrames'],'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'actualGameBrowserCombatAudioOrWasmStarted':False,'phoneVisualAndPerformanceReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig');(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'newMedia':0,'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
