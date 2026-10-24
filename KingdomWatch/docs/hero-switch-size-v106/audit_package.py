"""Static artifact checks only; do not execute game, audio or WASM modules."""
import hashlib, json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package

def sha(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()

config = json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8'))
package = PROJECT/'build/github-pages-ui-prewarm-v106-final'
before = PROJECT/'build/github-pages-new-heroes-v105-final'
checks = validate_package(package,config)
prior = json.loads((before/'hosting-release.json').read_text('utf-8'))
old = json.loads((before/prior['inventory']).read_text('utf-8'))['files']
current = json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
media = [name for name in old if '/native/' in name]
assert all(current.get(name) == old[name] for name in media), 'An existing image/audio/font payload changed'
assets = subprocess.check_output(['git','diff','--name-only','140517e1','--','KingdomWatch/assets'],
    cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
expected = ['battle/BattleDirector.ts','battle/ImpactFX.ts','ui/BattleEntry.ts','ui/BattleEntryWarmup.ts',
            'ui/Fonts.ts','ui/HUD.ts','ui/HeroComic.ts','ui/HeroLobbyIdle.ts','ui/LobbyArtWarmup.ts',
            'ui/MainUI.ts','ui/Ux.ts','ui/pages/LevelsPage.ts']
assert assets == sorted('KingdomWatch/assets/scripts/'+name for name in expected), assets
syntax = []
for path in sorted(package.rglob('*.js')):
    checked = subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(path)],capture_output=True,text=True)
    if checked.returncode: raise RuntimeError(str(path)+'\n'+checked.stderr)
    syntax.append(path.relative_to(package).as_posix())
types = json.loads((HERE/'typecheck-comparison.json').read_text('utf-8-sig'))
assert not types['added']
before_assets = json.loads((HERE/'source-assets-before.json').read_text('utf-8'))
assert all(sha(PROJECT/name)==digest for name,digest in before_assets.items()), 'Source changed during build/export'
report = {'checks':checks,'baselineSourceCommit':'140517e1','baselineLocalRelease':prior['id'],
    'changedSourceAssets':assets,'existingNativeFilesByteIdentical':len(media),
    'syntaxOnlyScripts':syntax,'typeDiagnostics':{'before':types['beforeDiagnostics'],'current':types['currentDiagnostics'],'added':types['added']},
    'sourceAssetsByteIdenticalAcrossBuildAndExport':len(before_assets),
    'gameBrowserCombatAudioWasmStarted':False,'userVisualValidationRemaining':True}
(HERE/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(HERE/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
text=(HERE/'export-console.txt').read_text('utf-8-sig')
(HERE/'export-report.json').write_text(json.dumps(json.loads(text[text.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8')
(HERE/'export-console.txt').unlink()
print(json.dumps({'completeRuntimeBytes':checks['full_package_bytes'],'files':checks['file_count'],
    'nativeFilesByteIdentical':len(media),'scriptSyntaxChecks':len(syntax),'newTypeDiagnostics':len(types['added'])}))
