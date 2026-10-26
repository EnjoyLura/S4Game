"""Runtime bytes, syntax and compiled shader inspection; no game or WASM execution."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'))
from export import validate_package
package=ROOT/'build/github-pages-space-chains-v135';prior_package=ROOT/'build/github-pages-hero-impact-v134'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p];assert len(native)==518
fontUids=[json.loads((ROOT/('assets/resources/fonts/'+name+'.ttf.meta')).read_text())['uuid'] for name in ['UIBody','UIHeading']]
fontPaths=[p for p in native if any(uid in p for uid in fontUids)]
assert len(fontPaths)==2
unchanged=[p for p in native if p not in fontPaths]
assert all(current.get(p)==old[p] for p in unchanged),'Existing non-font media changed'
assert all(current[p]!=old[p] for p in fontPaths)
assert set(p for p in current if '/native/' in p)==set(native),'Unexpected new media'
uuid=json.loads((ROOT/'assets/resources/fx/sword-jade-flow.effect.meta').read_text('utf8'))['uuid']
effect=next((package/'assets/resources/import').rglob('*'+uuid[:8]+'*.json'))
data=json.loads(effect.read_text('utf8'));shaders=data[5][0][2];techniques=data[5][0][3]
assert shaders and len(techniques)==2
for shader in shaders:
    assert not shader['samplerTextures'] and not shader['textures'] and not shader['samplers']
    for gl in ['glsl3','glsl1']:
        frag=shader[gl]['frag'];assert 'sword-jade' in shader['name'] and 'vec4 frag' in frag
        assert 'coverage*opacity' in frag and 'finalShockwave' in frag
blend=techniques[0]['passes'][0]['blendState']['targets'][0]
assert blend['blend'] and blend['blendSrc']==1 and blend['blendDst']==1
assert blend['blendSrcAlpha']==0 and blend['blendDstAlpha']==1
shader_report={'path':effect.relative_to(package).as_posix(),'sha256':hashlib.sha256(effect.read_bytes()).hexdigest(),
    'shaderPrograms':len(shaders),'noTextureDependencies':True,'blend':blend,'actualGameStarted':False}
(OUT/'compiled-effect-verification.json').write_text(json.dumps(shader_report,indent=2)+'\n','utf8')
# Inspect all changed compiled effects and both video display manifests.
compiled=[shader_report]
assert techniques[1]['passes'][0]['blendState']['targets'][0]['blendDst']==4
for name in ['space-sword-burst','wind-ninja-flow']:
    uid=json.loads((ROOT/('assets/resources/fx/'+name+'.effect.meta')).read_text())['uuid']
    file=next((package/'assets/resources/import').rglob('*'+uid[:8]+'*.json'))
    data=json.loads(file.read_text());programs=data[5][0][2];passes=data[5][0][3]
    for program in programs:
        assert not program['samplerTextures'] and not program['textures'] and not program['samplers']
        assert 'vec4 frag' in program['glsl1']['frag'] and 'vec4 frag' in program['glsl3']['frag']
    blend2=passes[0]['passes'][0]['blendState']['targets'][0]
    assert blend2['blendSrc']==1 and blend2['blendDst']==4
    compiled.append({'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'blend':blend2})
def manifest_in(value):
    if isinstance(value,dict):
        if 'visualWidthPerRadius' in value:return value
        for child in value.values():
            found=manifest_in(child)
            if found:return found
    elif isinstance(value,list):
        for child in value:
            found=manifest_in(child)
            if found:return found
    return None
for kind in ['tornado','eye']:
    source=ROOT/('assets/resources/fx/wind_'+kind+'_video_v129.frames.json')
    uid=json.loads(Path(str(source)+'.meta').read_text())['uuid']
    file=next((package/'assets/resources/import').rglob('*'+uid[:8]+'*.json'));text=file.read_text()
    sourceData=json.loads(source.read_text());assert manifest_in(json.loads(text))==sourceData
    compiled.append({'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'source':source.relative_to(ROOT).as_posix()})
(OUT/'changed-runtime-files.json').write_text(json.dumps(compiled,indent=2)+'\n')
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
for marker in ['fx/sword-jade-flow','warmSwordFlight','jadeSwordGround','spaceGroundSeals','spaceBindingLinks','finalWave']:
    assert marker in text,marker
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(unchanged),'extendedFonts':fontPaths,'newMedia':[],
    'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),
    'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),'typeDiagnosticsBefore':types['beforeDiagnostics'],
    'typeDiagnosticsCurrent':types['currentDiagnostics'],'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
console=OUT/'export-console.txt';raw=console.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');console.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
    'nativeByteIdentical':len(unchanged),'shaderPrograms':len(shaders),'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))
