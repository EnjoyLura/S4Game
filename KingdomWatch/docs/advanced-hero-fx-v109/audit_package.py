"""Validate the runtime export and source scope without running game modules."""
import json,subprocess,sys
from pathlib import Path

OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package

package=PROJECT/'build/github-pages-advanced-hero-fx-v109'
baseline=PROJECT/'build/github-pages-new-hero-fx-v108-final'
config=json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8'))
checks=validate_package(package,config)
prior=json.loads((baseline/'hosting-release.json').read_text('utf-8'))
old=json.loads((baseline/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
media=[path for path in old if '/native/' in path]
assert all(current.get(path)==old[path] for path in media),'Existing art/font/audio changed'
changed=subprocess.check_output(['git','diff','--name-only','f7caf0a2','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
new_files=subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
changed=sorted(set(changed+new_files))
assert changed==['KingdomWatch/assets/resources/fx/hero-impact-flow.effect', 'KingdomWatch/assets/resources/fx/hero-impact-flow.effect.meta', 'KingdomWatch/assets/scripts/battle/AdvancedHeroVFX.ts', 'KingdomWatch/assets/scripts/battle/AdvancedHeroVFX.ts.meta', 'KingdomWatch/assets/scripts/battle/BattleDirector.ts', 'KingdomWatch/assets/scripts/battle/Hero.ts', 'KingdomWatch/assets/scripts/battle/HeroFxShader.ts', 'KingdomWatch/assets/scripts/battle/HeroFxShader.ts.meta', 'KingdomWatch/assets/scripts/battle/NewHeroVFX.ts', 'KingdomWatch/assets/scripts/battle/NewHeroes.ts', 'KingdomWatch/assets/scripts/ui/BattleEntryWarmup.ts'],changed
syntax=[]
for path in sorted(package.rglob('*.js')):
    result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(path)],capture_output=True,text=True)
    if result.returncode:raise RuntimeError(path.name+'\n'+result.stderr)
    syntax.append(path.relative_to(package).as_posix())
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'))
assert not types['added']
report={'checks':checks,'baselineCommit':'f7caf0a2','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
        'existingNativeFilesByteIdentical':len(media),'syntaxOnlyScripts':syntax,
        'typeDiagnosticsBefore':types['beforeDiagnostics'],'typeDiagnosticsCurrent':types['currentDiagnostics'],
        'newTypeDiagnostics':types['added'],'gameBrowserCombatAudioOrWasmStarted':False,
        'visualInteractionReview':'user manual'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
raw=(OUT/'export-console.txt').read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'export-console.txt').unlink()
print(json.dumps({'release':checks['release']['id'],'bytes':checks['full_package_bytes'],'nativeFilesByteIdentical':len(media),
                  'scriptSyntaxChecks':len(syntax),'newTypeDiagnostics':0}))
