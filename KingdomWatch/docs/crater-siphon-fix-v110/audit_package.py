"""Validate the runtime export and source scope without running game modules."""
import json,subprocess,sys
from pathlib import Path

OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package

package=PROJECT/'build/github-pages-crater-siphon-v110'
baseline=PROJECT/'build/github-pages-advanced-hero-fx-v109'
config=json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8'))
checks=validate_package(package,config)
prior=json.loads((baseline/'hosting-release.json').read_text('utf-8'))
old=json.loads((baseline/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
media=[path for path in old if '/native/' in path]
assert all(current.get(path)==old[path] for path in media),'Existing art/font/audio changed'
changed=subprocess.check_output(['git','diff','--name-only','c7efe6ab','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
new_files=subprocess.check_output(['git','ls-files','--others','--exclude-standard','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
changed=sorted(set(changed+new_files))
assert changed==['KingdomWatch/assets/resources/fx/hero-impact-flow.effect', 'KingdomWatch/assets/scripts/battle/AdvancedHeroVFX.ts', 'KingdomWatch/assets/scripts/battle/HeroFxShader.ts'],changed
effect=next(package.rglob('e00b3255-79ee-4875-932b-058c0d37b905.*.json'))
techniques=[]
def visit(value):
    if isinstance(value,dict):
        if 'passes' in value:techniques.append(value['passes'])
        for item in value.values():visit(item)
    elif isinstance(value,list):
        for item in value:visit(item)
visit(json.loads(effect.read_text('utf-8')))
assert len(techniques)==2 and all(len(p)==1 for p in techniques)
blends=[p[0]['blendState']['targets'][0] for p in techniques]
assert [(p['blendSrc'],p['blendDst']) for p in blends]==[(2,4),(1,1)],blends
syntax=[]
for path in sorted(package.rglob('*.js')):
    result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(path)],capture_output=True,text=True)
    if result.returncode:raise RuntimeError(path.name+'\n'+result.stderr)
    syntax.append(path.relative_to(package).as_posix())
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8-sig'))
assert not types['added']
report={'checks':checks,'baselineCommit':'c7efe6ab','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
        'existingNativeFilesByteIdentical':len(media),'syntaxOnlyScripts':syntax,
        'compiledEffect':{'path':effect.relative_to(package).as_posix(),'techniques':len(techniques),'blendStates':blends},
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
