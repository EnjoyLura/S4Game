"""Compare source/runtime file bytes and exported assets without starting a game."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import export,validate_package


def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def write(name,data):(ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    config=json.loads((PROJECT/'tools/github-pages/config.json').read_text(encoding='utf-8'))
    checkout=Path(config['checkout'])
    old_release=json.loads((checkout/'hosting-release.json').read_text(encoding='utf-8'))
    old=json.loads((checkout/old_release['inventory']).read_text(encoding='utf-8'))['files']
    baseline=json.loads((ROOT/'before/asset-hashes.json').read_text())
    current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    changed=sorted(k for k in baseline if baseline[k]!=current.get(k))
    expected=sorted(['assets/scripts/battle/MobAnim.ts','assets/scripts/config/ChapterContent.ts','assets/scripts/ui/BattleEntryWarmup.ts','assets/scripts/battle/FrostVFX.ts','assets/resources/ux/chapter1_mob_walk_v94.png'])
    if changed!=expected:raise ValueError('Unexpected source changes: '+repr(changed))
    added=sorted(set(current)-set(baseline))
    expected_added=sorted('assets/resources/ux/'+atlas+suffix for atlas in ['chapter1_mob_walk_v95','chapter1_cart_walk_v95'] for suffix in ['.png','.png.meta','.frames.json','.frames.json.meta'])
    if added!=expected_added:raise ValueError('Unexpected new assets: '+repr(added))
    package=PROJECT/'build/github-pages-monster-frost-v95'
    result=export(package,config);write('export-report.json',result)
    checks=validate_package(package,config)
    new=json.loads((package/checks['release']['inventory']).read_text(encoding='utf-8'))['files']
    media=[name for name in old if '/native/' in name]
    changed_media=[name for name in media if new.get(name)!=old[name] and 'ee5d7853-6b4e-4db0-9775-8b0adaac63b3' not in name]
    if changed_media:raise ValueError('Previous native media changed: '+repr(changed_media))
    syntax=[]
    for name in new:
        if name.endswith('.js'):
            check=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(package/name)],capture_output=True,text=True)
            if check.returncode:raise ValueError('JS syntax failed: '+name+'\n'+check.stderr)
            syntax.append(name)
    result={'checks':checks,'baselineRelease':old_release['id'],'sourceAssetsBefore':len(baseline),
            'sourceAssetsChanged':changed,'sourceAssetsAdded':added,'sourceAssetsRemoved':sorted(set(baseline)-set(current)),
            'oldSourceAssetsUnchanged':len(baseline)-len(changed),'previousNativeMediaByteIdentical':len(media)-1,'workerAlphaAtlasReplacementAllowed':True,
            'runtimeChanges':sorted(name for name in old.keys()|new.keys() if old.get(name)!=new.get(name)),
            'syntaxOnlyScripts':syntax,'gameBrowserTestsAudioOrWasmStarted':False}
    write('package-static-verification.json',result)
    write('build-record.json',json.loads((PROJECT/'build/web-mobile/build-record.json').read_text(encoding='utf-8-sig')))
    print(json.dumps({'release':checks['release']['id'],'fullPackageBytes':checks['full_package_bytes'],'files':checks['file_count'],
                      'sourceChanged':changed,'sourceAdded':added,'oldNativeMediaUnchanged':len(media)-1},ensure_ascii=False))


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');main()
