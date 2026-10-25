"""Static runtime inventory, source scope and JS syntax; no game is started."""
import json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-endless-laser-v115'
priorPackage=PROJECT/'build/github-pages-enemy-feedback-v114'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((priorPackage/'hosting-release.json').read_text('utf-8'))
old=json.loads((priorPackage/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
native=[p for p in old if '/native/' in p]
assert len(native)==506 and all(current.get(p)==old[p] for p in native)
changed=subprocess.check_output(['git','diff','--name-only','4d2d79bb','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
expected=['resources/fx/hero-impact-flow.effect','scripts/battle/BattleDirector.ts','scripts/battle/EndlessFlow.ts',
          'scripts/battle/EndlessFlow.ts.meta','scripts/battle/Monster.ts','scripts/battle/WaveManager.ts']
assert changed==sorted('KingdomWatch/assets/'+p for p in expected),changed
shader=PROJECT/'assets/resources/fx/hero-impact-flow.effect'
before=subprocess.check_output(['git','show','4d2d79bb:KingdomWatch/assets/resources/fx/hero-impact-flow.effect'],cwd=PROJECT.parent,encoding='utf-8')
after=shader.read_text('utf-8')
assert before.split('  vec4 piercingFlood(')[0]==after.split('  vec4 piercingFlood(')[0]
assert before.split('  vec4 frag () {')[1]==after.split('  vec4 frag () {')[1]
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
report={'checks':checks,'baselineCommit':'4d2d79bb','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
 'existingNativeByteIdentical':len(native),'normalSiphonAndExplosionShaderBranchesByteIdentical':True,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'typeDiagnosticsBefore':types['beforeDiagnostics'],
 'typeDiagnosticsCurrent':types['currentDiagnostics'],'gameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
