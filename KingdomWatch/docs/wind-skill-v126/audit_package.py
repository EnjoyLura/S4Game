"""Offline release checks. Does not run game JS, engine, browser, audio or WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-wind-skill-v126'
prior_package=PROJECT/'build/github-pages-tornado-volume-v124'
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
scope=json.loads((OUT/'verification.json').read_text('utf8'));assert scope['status']=='PASS'
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8')
for marker in ['lineHalfLength','lineForwardOffset','skillCastSerial','beginSkillCooldown']:
    assert marker in text,marker
effects=[p.relative_to(package).as_posix() for p in (package/'assets/resources/import').rglob('*.json') if b'wind-ninja-fs' in p.read_bytes()]
assert len(effects)==1 and 'tornadoDust' in (package/effects[0]).read_text('utf8')
report={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'newMedia':0,
    'compiledEffectFiles':effects,'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
    'mainScript':main.relative_to(package).as_posix(),'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),
    'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
    'actualGameBrowserCombatAudioOrWasmStarted':False,'phoneGameplayReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
    'nativeByteIdentical':len(native),'newMedia':0,'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
