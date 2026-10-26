"""Runtime bytes, syntax and compiled shader inspection; no game or WASM execution."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'))
from export import validate_package
package=ROOT/'build/github-pages-sword-jade-v132';prior_package=ROOT/'build/github-pages-wind-ground-loop-v130'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p];assert len(native)==518
assert all(current.get(p)==old[p] for p in native),'Existing runtime media changed'
assert set(p for p in current if '/native/' in p)==set(native),'Unexpected new media'
uuid=json.loads((ROOT/'assets/resources/fx/sword-jade-flow.effect.meta').read_text('utf8'))['uuid']
effect=next((package/'assets/resources/import').rglob('*'+uuid[:8]+'*.json'))
data=json.loads(effect.read_text('utf8'));shaders=data[5][0][2];techniques=data[5][0][3]
assert shaders and len(techniques)==1
for shader in shaders:
    assert not shader['samplerTextures'] and not shader['textures'] and not shader['samplers']
    for gl in ['glsl3','glsl1']:
        frag=shader[gl]['frag'];assert 'sword-jade' in shader['name'] and 'vec4 frag' in frag
        assert 'edge*color.a,0.0)' in frag
blend=techniques[0]['passes'][0]['blendState']['targets'][0]
assert blend['blend'] and blend['blendSrc']==1 and blend['blendDst']==1
assert blend['blendSrcAlpha']==0 and blend['blendDstAlpha']==1
shader_report={'path':effect.relative_to(package).as_posix(),'sha256':hashlib.sha256(effect.read_bytes()).hexdigest(),
    'shaderPrograms':len(shaders),'noTextureDependencies':True,'blend':blend,'actualGameStarted':False}
(OUT/'compiled-effect-verification.json').write_text(json.dumps(shader_report,indent=2)+'\n','utf8')
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
    result=subprocess.run([node,'--check',str(file)],capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
    if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
    result=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True)
    assert result.returncode==0,result.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf8'));assert not types['added']
scope=json.loads((OUT/'verification.json').read_text('utf8'));assert scope['status']=='PASS'
main=next(package.glob('assets/main/index.*.js'));text=main.read_text('utf8')
for marker in ['fx/sword-jade-flow','warmSwordFlight','jadeSwordGround']:
    assert marker in text,marker
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'newMedia':[],
    'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),
    'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),'typeDiagnosticsBefore':types['beforeDiagnostics'],
    'typeDiagnosticsCurrent':types['currentDiagnostics'],'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
console=OUT/'export-console.txt';raw=console.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');console.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
    'nativeByteIdentical':len(native),'shaderPrograms':len(shaders),'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
