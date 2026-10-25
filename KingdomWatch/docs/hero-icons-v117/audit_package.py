"""Static package/hash/native media/JS audit. Never starts the game or browser."""
import hashlib,json,re,subprocess,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package
package=PROJECT/'build/github-pages-hero-icons-v117'
priorPackage=PROJECT/'build/github-pages-hero-cards-v116'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((priorPackage/'hosting-release.json').read_text('utf-8'))
old=json.loads((priorPackage/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
native=[p for p in old if '/native/' in p]
assert len(native)==506 and all(current.get(p)==old[p] for p in native)
added=[p for p in current if '/native/' in p and p not in old];assert len(added)==3,added
changed=subprocess.check_output(['git','diff','--name-only','6bd4d0a2','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
expected=['scripts/battle/NewHeroes.ts','scripts/battle/Projectile.ts','scripts/config/Cards.ts',
 'scripts/config/NewHeroConfig.ts','scripts/ui/ComicUI.ts','scripts/ui/EnemyTooltip.ts','scripts/ui/HUD.ts','scripts/ui/NewHeroArt.ts',
 'resources/ux/new_hero_icons_v117.meta']
for name in ['icon_core','cannon_cards','siphon_cards']:
 expected+=['resources/ux/new_hero_icons_v117/'+name+'.png','resources/ux/new_hero_icons_v117/'+name+'.png.meta']
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
art=json.loads((OUT/'art-manifest.json').read_text('utf-8'));assert len(art['icons'])==37
script=next(package.glob('assets/main/index.*.js')).read_text('utf-8')
assert all(s in script for s in ['heroIconViewport','new_hero_icons_v117/icon_core','new_hero_icons_v117/cannon_cards','new_hero_icons_v117/siphon_cards','excludeLifeId'])
for atlas in art['atlases']:
 assert sum(atlas['uuid'] in p for p in added)==1,(atlas,added)
assert checks['full_package_bytes']<=200000000
report={'checks':checks,'baselineCommit':'6bd4d0a2','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
 'existingNativeByteIdentical':len(native),'newNativeAtlases':added,'jsSyntaxOnly':syntax,'inlineScriptsSyntaxOnly':inline,
 'circularIconsCompiled':37,'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
 'gameBrowserCombatAudioOrWasmStarted':False,'manualPhoneReview':'user'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(native),'addedAtlases':len(added),'jsSyntaxChecks':len(syntax),'inlineSyntaxChecks':inline,'icons':37,'newDiagnostics':0}))

