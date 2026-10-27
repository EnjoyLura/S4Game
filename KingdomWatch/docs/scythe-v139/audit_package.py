"""Inspect exported runtime bytes, syntax and compiled shader; no runtime execution."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'tools/github-pages'))
from export import validate_package
package=ROOT/'build/github-pages-scythe-v139';prior_package=ROOT/'build/github-pages-magic-bow-v138'
checks=validate_package(package,json.loads((ROOT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files'];current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
fontUids=[json.loads((ROOT/('assets/resources/fonts/'+n+'.ttf.meta')).read_text())['uuid'] for n in ['UIBody','UIHeading']]
native=[p for p in old if '/native/' in p and not any(u in p for u in fontUids)]
assert len(native)==520 and all(current.get(p)==old[p] for p in native),'Existing non-font media changed'
newMedia=[p for p in current if '/native/' in p and p not in native]
allowedUids=fontUids+[a['uuid'] for a in json.loads((OUT/'art-manifest.json').read_text())['assets']]
assert len(newMedia)==4 and all(any(u in p for u in allowedUids) for p in newMedia),'Unexpected media'
uuid=json.loads((ROOT/'assets/resources/fx/scythe-flow.effect.meta').read_text())['uuid']
effect=next((package/'assets/resources/import').rglob('*'+uuid[:8]+'*.json'))
data=json.loads(effect.read_text());shaders=data[5][0][2];techniques=data[5][0][3]
assert shaders and len(techniques)==1
for shader in shaders:
 assert not shader['samplerTextures'] and not shader['textures'] and not shader['samplers']
 for gl in ['glsl3','glsl1']:
  frag=shader[gl]['frag'];assert 'scythe' in shader['name'] and 'vec4 frag' in frag and 'mode<2.5' in frag and 'float shaft=' in frag
blend=techniques[0]['passes'][0]['blendState']['targets'][0]
assert blend['blend'] and blend['blendSrc']==1 and blend['blendDst']==4 and blend['blendSrcAlpha']==0 and blend['blendDstAlpha']==1
def item(file):return {'path':file.relative_to(package).as_posix(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
shader_report={**item(effect),'shaderPrograms':len(shaders),'noTextureDependencies':True,'blend':blend}
(OUT/'compiled-effect-verification.json').write_text(json.dumps(shader_report,indent=2)+'\n')
(OUT/'changed-runtime-files.json').write_text(json.dumps([shader_report]+[item(package/p) for p in newMedia],indent=2)+'\n')
node='C:/Program Files/nodejs/node.exe';syntax=[]
for file in sorted(package.rglob('*.js')):
 r=subprocess.run([node,'--check',str(file)],capture_output=True,text=True);assert r.returncode==0,r.stderr;syntax.append(file.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
 if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
 r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True);assert r.returncode==0,r.stderr;inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'));assert not types['added']
scope=json.loads((OUT/'verification.json').read_text());assert scope['status']=='PASS'
main=next(package.glob('assets/main/index.*.js'));text=main.read_text()
for marker in ['fx/scythe-flow','warmScytheFlight','ScytheHero','ui_avatar_scythe','new_heroes_v139/scythe_battle','wpn_starter_scythe','scythe_unlock_skill']:
 if marker=='scythe_unlock_skill':continue # ability unlock keys are formed dynamically
 assert marker in text,marker
result={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(native),'newMedia':newMedia,
 'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,'mainScript':main.relative_to(package).as_posix(),'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),
 'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'gameEngineBrowserCombatAudioOrWasmStarted':False,'phoneReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((ROOT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
console=OUT/'export-console.txt';raw=console.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8');console.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'newMedia':len(newMedia),'jsSyntax':len(syntax),'inlineSyntax':inline,'newDiagnostics':0}))
