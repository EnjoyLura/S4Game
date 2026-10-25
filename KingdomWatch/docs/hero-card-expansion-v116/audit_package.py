"""Static package/native media/JS and selected-card/font checks. No gameplay."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-hero-cards-v116'
priorPackage=PROJECT/'build/github-pages-endless-laser-v115'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((priorPackage/'hosting-release.json').read_text('utf-8'))
old=json.loads((priorPackage/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
native=[p for p in old if '/native/' in p]
fontIds=['4f4e0740-2005-42a2-b4f7-31b0ed0bff81','08934c18-5f2f-44c6-8145-d4fb15839d72']
fonts=[p for p in native if any(uid in p for uid in fontIds)]
assert len(fonts)==2
native=[p for p in native if p not in fonts]
assert len(native)==504 and all(current.get(p)==old[p] for p in native)
changed=subprocess.check_output(['git','diff','--name-only','806a6fca','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
expected=['resources/fonts/UIBody.ttf','resources/fonts/UIHeading.ttf','resources/fonts/manifest.json',
 'scripts/battle/AdvancedHeroVFX.ts','scripts/battle/CannonAugments.ts','scripts/battle/CannonAugments.ts.meta',
 'scripts/battle/Monster.ts','scripts/battle/MonsterTraits.ts','scripts/battle/NewHeroes.ts','scripts/battle/Projectile.ts',
 'scripts/battle/SiphonLaserVFX.ts','scripts/config/Cards.ts','scripts/config/NewHeroConfig.ts',
 'scripts/ui/EnemyTooltip.ts','scripts/ui/NewHeroArt.ts','scripts/ui/Panels.ts']
assert changed==sorted('KingdomWatch/assets/'+p for p in expected),changed
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
cardChecks=json.loads((OUT/'card-check.json').read_text('utf-8'));assert len(cardChecks['newCards'])==21
script=next(package.glob('assets/main/index.*.js')).read_text('utf-8')
assert all(c['id'] in script for c in cardChecks['newCards'])
compiledFonts=[]
for name in ['UIBody.ttf','UIHeading.ttf']:
    p=next(package.rglob(name));expectedHash=hashlib.sha256((PROJECT/'assets/resources/fonts'/name).read_bytes()).hexdigest()
    assert hashlib.sha256(p.read_bytes()).hexdigest()==expectedHash
    compiledFonts.append({'path':p.relative_to(package).as_posix(),'sha256':expectedHash})
report={'checks':checks,'baselineCommit':'806a6fca','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
 'existingNativeByteIdentical':len(native),'twoFontsExtended':compiledFonts,'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
 'newCardsCompiled':21,'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'gameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'newCards':21,'newDiagnostics':0}))
