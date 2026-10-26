"""Static export/asset audit. Never executes engine, browser, game, audio or WASM."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package,image_records

package=PROJECT/'build/github-pages-space-sword-rework-v128'
prior_package=PROJECT/'build/github-pages-space-sword-v127'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf8')))
prior=json.loads((prior_package/'hosting-release.json').read_text('utf8'))
old=json.loads((prior_package/prior['inventory']).read_text('utf8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf8'))['files']
native=[p for p in old if '/native/' in p]
# Derive both font UUIDs from formal metadata, rather than assuming a previous filename hash.
font_uuids=[json.loads((PROJECT/('assets/resources/fonts/'+name+'.ttf.meta')).read_text('utf8'))['uuid'] for name in ['UIBody','UIHeading']]
changed_fonts=[p for p in native if p.endswith('.ttf') and any(u in p for u in font_uuids)]
assert len(native)==515 and len(changed_fonts)==2
unchanged=[p for p in native if p not in changed_fonts]
assert all(current.get(p)==old[p] for p in unchanged),'Unexpected existing media change/removal'
records={r['uuid']:r for r in image_records(package)}
art=json.loads((OUT/'art-manifest.json').read_text('utf8'))
new_media=[]
for asset in art['assets']:
    record=records[asset['uuid']]
    p=record['native'].relative_to(package).as_posix()
    assert p in current and p not in old
    new_media.append({'path':p,**current[p],'source':asset['path']})
new_fonts=[]
for u in font_uuids:
    paths=[p for p in current if '/native/' in p and u in p and p.endswith('.ttf')]
    assert len(paths)==1 and paths[0] not in old
    new_fonts.append({'path':paths[0],**current[paths[0]]})
assert len([p for p in current if '/native/' in p])==516
syntax=[]
node='C:/Program Files/nodejs/node.exe'
for p in sorted(package.rglob('*.js')):
    r=subprocess.run([node,'--check',str(p)],capture_output=True,text=True)
    assert r.returncode==0,r.stderr
    syntax.append(p.relative_to(package).as_posix())
inline=0
for attrs,script in re.findall(r'<script\b([^>]*)>(.*?)</script>',(package/checks['release']['entry']).read_text('utf8'),re.S|re.I):
    if not script.strip() or 'importmap' in attrs or 'application/json' in attrs:continue
    r=subprocess.run([node,'--check','--input-type=module'],input=script,capture_output=True,text=True)
    assert r.returncode==0,r.stderr
    inline+=1
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf8'))
assert not types['added']
scope=json.loads((OUT/'verification.json').read_text('utf8'))
assert scope['status']=='PASS'
main=next(package.glob('assets/main/index.*.js'))
text=main.read_text('utf8')
for marker in ['spaceBindT','spacePulseAt','heavenSword','onGroundDamage','禁界光柱','五岳天剑','万剑归宗']:
    assert marker in text,marker
report={'checks':checks,'baselineRelease':prior['id'],'existingNativeByteIdentical':len(unchanged),
    'extendedFonts':new_fonts,'newMedia':new_media,'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
    'mainScript':main.relative_to(package).as_posix(),'mainSha256':hashlib.sha256(main.read_bytes()).hexdigest(),
    'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
    'actualGameBrowserCombatAudioOrWasmStarted':False,'phoneGameplayReview':'pending user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf8')
p=OUT/'export-console.txt'
raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf8')
p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
    'nativeByteIdentical':len(unchanged),'newMedia':len(new_media),'extendedFonts':len(new_fonts),
    'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newDiagnostics':0}))

