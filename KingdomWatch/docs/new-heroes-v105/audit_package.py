"""Inspect the local package and authoring files without launching game code."""
import hashlib, json, subprocess, sys
from pathlib import Path

REPORT = Path(__file__).resolve().parent
PROJECT = REPORT.parents[1]
sys.path.insert(0, str(PROJECT/'tools/github-pages'))
from export import validate_package

package = PROJECT/'build/github-pages-new-heroes-v105-final'
config = json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8'))
checks = validate_package(package,config)
resource_config, = (package/'assets/resources').glob('config.*.json')
paths = {v[0] for v in json.loads(resource_config.read_text('utf-8'))['paths'].values()}
required = ['ux/new_heroes_v105/'+hero+'_'+pose+'/spriteFrame'
            for hero in ['cannon','siphon'] for pose in ['lobby','battle']]
assert set(required) <= paths, 'Missing new character frame in runtime bundle'
for stem in ['cannon_lobby','siphon_lobby','cannon_battle','siphon_battle']:
    meta = json.loads((PROJECT/('assets/resources/ux/new_heroes_v105/'+stem+'.png.meta')).read_text('utf-8'))
    data = meta['subMetas']['f9941']['userData']
    assert (data['width'],data['height'],data['trimX'],data['trimY']) == (1024,1536,0,0)
    assert data['packable'] is False, 'Virtual regions require a stable full source texture'
art = json.loads((REPORT/'art-metadata-audit.json').read_text('utf-8'))
for row in art['images']:
    assert hashlib.sha256((PROJECT/row['file']).read_bytes()).hexdigest() == row['sha256']
assert all(not font['missingHan'] for font in art['fonts'])
syntax = []
for path in sorted(package.rglob('*.js')):
    result = subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(path)],capture_output=True,text=True)
    if result.returncode: raise RuntimeError(str(path)+'\n'+result.stderr)
    syntax.append(path.relative_to(package).as_posix())
types = json.loads((REPORT/'typecheck-comparison.json').read_text('utf-8'))
assert not types['added'], 'New compiler diagnostics'
changed = subprocess.check_output(['git','diff','--name-only','--','KingdomWatch/assets/resources'],
    cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
assert all('/fonts/' in name for name in changed), 'An existing non-font image/audio asset changed'
old = json.loads((PROJECT/'docs/hero-idle-release-v104/package-validation.json').read_text('utf-8'))
baseline_bytes = old['export']['full_package_bytes']
result = {'package':str(package),'checks':checks,'baselinePackageBytes':baseline_bytes,
          'packageGrowthBytes':checks['full_package_bytes']-baseline_bytes,
          'newHeroResourceFrames':required,'virtualFrameSourceRectsPreserved':True,
          'sourceGeneratedPNGsByteIdentical':True,'fontHanCoveragePassed':True,
          'existingMediaAssetChanges':changed,'syntaxOnlyScripts':syntax,
          'newTypeDiagnostics':types['added'],'sourcePush':False,'deployment':False,
          'gameBrowserCombatAudioOrWasmStarted':False}
(REPORT/'package-static-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n','utf-8')
(REPORT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
print(json.dumps({'fullPackageBytes':checks['full_package_bytes'],'budget':checks['budget_bytes'],
    'growthBytes':result['packageGrowthBytes'],'scriptSyntaxChecks':len(syntax),'newTypeDiagnostics':0,
    'sourcePush':False,'deployment':False},ensure_ascii=False))
