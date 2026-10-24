"""Export a runtime-only package and verify that the previous media stay byte-identical."""
from pathlib import Path
import hashlib,json,subprocess,sys

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import export,validate_package


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,data):(ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    config=json.loads((PROJECT/'tools/github-pages/config.json').read_text())
    checkout=Path(config['checkout']);old_release=json.loads((checkout/'hosting-release.json').read_text())
    if old_release['id']!='79f84e4902c276fe':raise ValueError('Inspect runtime changes since the v96 baseline')
    old=json.loads((checkout/old_release['inventory']).read_text())['files']
    baseline=json.loads((ROOT/'before/asset-hashes.json').read_text())
    current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    changed=sorted(k for k in baseline if baseline[k]!=current.get(k))
    if changed!=['assets/scripts/ui/HeroLobbyIdle.ts']:raise ValueError('Unexpected changes: '+repr(changed))
    expected=sorted('assets/resources/ux/hero_lobby_idle_v96/mora'+suffix for suffix in ['.png','.png.meta','.frames.json','.frames.json.meta'])
    added=sorted(set(current)-set(baseline))
    if added!=expected or set(baseline)-set(current):raise ValueError('Unexpected additions/removals')
    package=PROJECT/'build/github-pages-mora-idle-v97'
    result=export(package,config);write('export-report.json',result)
    checks=validate_package(package,config)
    new=json.loads((package/checks['release']['inventory']).read_text())['files']
    media=[name for name in old if '/native/' in name]
    changes=[name for name in media if new.get(name)!=old[name]]
    if changes:raise ValueError('Previous native media changed: '+repr(changes))
    syntax=[]
    for name in new:
        if name.endswith('.js'):
            check=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(package/name)],capture_output=True,text=True)
            if check.returncode:raise ValueError(name+'\n'+check.stderr)
            syntax.append(name)
    write('package-static-verification.json',{'checks':checks,'baselineRelease':old_release['id'],
      'sourceAssetsBefore':len(baseline),'sourceAssetsChanged':changed,'sourceAssetsAdded':added,
      'oldSourceAssetsUnchanged':len(baseline)-len(changed),'previousNativeMediaByteIdentical':len(media),
      'syntaxOnlyScripts':syntax,'gameBrowserAudioWasmStarted':False})
    write('build-record.json',json.loads((PROJECT/'build/web-mobile/build-record.json').read_text(encoding='utf-8-sig')))
    print(json.dumps({'release':checks['release']['id'],'fullPackageBytes':checks['full_package_bytes'],
      'files':checks['file_count'],'oldNativeMediaUnchanged':len(media)}))


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');main()
