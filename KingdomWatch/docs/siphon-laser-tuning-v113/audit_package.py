"""Static export hashes and syntax only; no game engine or WASM is started."""
import json, subprocess, sys
from pathlib import Path

OUT=Path(__file__).resolve().parent
PROJECT=OUT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import validate_package

package=PROJECT/'build/github-pages-siphon-laser-v113'
baseline=PROJECT/'build/github-pages-siphon-laser-v112'
checks=validate_package(package,json.loads((PROJECT/'tools/github-pages/config.json').read_text('utf-8')))
prior=json.loads((baseline/'hosting-release.json').read_text('utf-8'))
old=json.loads((baseline/prior['inventory']).read_text('utf-8'))['files']
current=json.loads((package/checks['release']['inventory']).read_text('utf-8'))['files']
media=[p for p in old if '/native/' in p]
assert len(media)==506 and all(current.get(p)==old[p] for p in media)
changed=subprocess.check_output(['git','diff','--name-only','00bddbaa','--','KingdomWatch/assets'],cwd=PROJECT.parent,encoding='utf-8').strip().splitlines()
assert changed==['KingdomWatch/assets/resources/fx/hero-impact-flow.effect','KingdomWatch/assets/scripts/battle/NewHeroes.ts',
 'KingdomWatch/assets/scripts/battle/SiphonLaser.ts','KingdomWatch/assets/scripts/battle/SiphonLaserVFX.ts',
 'KingdomWatch/assets/scripts/battle/UltimateTiming.ts','KingdomWatch/assets/scripts/config/NewHeroConfig.ts'],changed
syntax=[]
for p in sorted(package.rglob('*.js')):
    result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(p)],capture_output=True,text=True)
    assert result.returncode==0,result.stderr
    syntax.append(p.relative_to(package).as_posix())
types=json.loads((OUT/'typecheck-comparison.json').read_text('utf-8'))
assert not types['added']
report={'checks':checks,'baselineCommit':'00bddbaa','baselineRelease':prior['id'],'sourceAssetsChanged':changed,
 'allExistingNativeFilesByteIdentical':len(media),'scriptsSyntaxOnly':syntax,'newTypeDiagnostics':types['added'],
 'gameBrowserCombatAudioOrWasmStarted':False,'visualInteractionReview':'user manual'}
(OUT/'package-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
(OUT/'build-record.json').write_text((PROJECT/'build/web-mobile/build-record.json').read_text('utf-8-sig'),'utf-8')
p=OUT/'export-console.txt';raw=p.read_text('utf-8-sig')
(OUT/'export-report.json').write_text(json.dumps(json.loads(raw[raw.index('{'):]),ensure_ascii=False,indent=2)+'\n','utf-8');p.unlink()
print(json.dumps({'release':checks['release']['id'],'files':checks['file_count'],'bytes':checks['full_package_bytes'],
 'nativeByteIdentical':len(media),'jsSyntaxChecks':len(syntax),'newDiagnostics':0}))
