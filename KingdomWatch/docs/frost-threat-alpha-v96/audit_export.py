"""Source preservation, pixel/inventory and export checks. Does not execute game code."""
from pathlib import Path
import hashlib, json, subprocess, sys

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
sys.path.insert(0,str(PROJECT/'tools/github-pages'))
from export import export,validate_package


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,data):(ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def main():
    config=json.loads((PROJECT/'tools/github-pages/config.json').read_text())
    checkout=Path(config['checkout']);old_release=json.loads((checkout/'hosting-release.json').read_text())
    if old_release['id']!='2775ab2feac8921b':raise ValueError('Runtime changed since the v95 baseline; inspect before publishing')
    old=json.loads((checkout/old_release['inventory']).read_text())['files']
    baseline=json.loads((ROOT/'before/asset-hashes.json').read_text())
    current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    expected=[f'assets/scripts/{name}.ts' for name in ['battle/FrostVFX','battle/FrostUltimateVFX','battle/UltimateTiming',
      'battle/Hero','core/GameAudio','core/AudioCatalog','core/Sfx','ui/BossWarning','ui/HeroComic','ui/pages/HeroPage','ui/TrainingLobby']]
    expected += [f'assets/resources/ux/{name}.png' for name in ['chapter1_mob_walk_v81','chapter1_mob_walk_v94','chapter1_mob_walk_v95']]
    changed=sorted(k for k in baseline if baseline[k]!=current.get(k))
    if changed!=sorted(expected):raise ValueError('Unexpected source changes: '+repr(changed))
    expected_added=['assets/scripts/ui/HeroLobbyIdle.ts','assets/scripts/ui/HeroLobbyIdle.ts.meta','assets/resources/ux/hero_lobby_idle_v96.meta']
    expected_added += [f'assets/resources/ux/hero_lobby_idle_v96/{hero}{suffix}' for hero in ['archer','pyro','sniper','volt']
                       for suffix in ['.png','.png.meta','.frames.json','.frames.json.meta']]
    added=sorted(set(current)-set(baseline))
    if added!=sorted(expected_added):raise ValueError('Unexpected new assets: '+repr(added))
    allowed=[]
    for atlas in ['chapter1_mob_walk_v81','chapter1_mob_walk_v94','chapter1_mob_walk_v95']:
        allowed.append(json.loads((PROJECT/f'assets/resources/ux/{atlas}.png.meta').read_text())['uuid'])
    package=PROJECT/'build/github-pages-frost-hero-v96'
    result=export(package,config);write('export-report.json',result)
    checks=validate_package(package,config)
    new=json.loads((package/checks['release']['inventory']).read_text())['files']
    media=[name for name in old if '/native/' in name]
    allowed_media=[name for name in media if any(uuid in name for uuid in allowed)]
    changes=[name for name in media if new.get(name)!=old[name] and name not in allowed_media]
    if changes:raise ValueError('Unrelated native media changed: '+repr(changes))
    syntax=[]
    for name in new:
        if name.endswith('.js'):
            checked=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(package/name)],capture_output=True,text=True)
            if checked.returncode:raise ValueError(name+'\n'+checked.stderr)
            syntax.append(name)
    result={'checks':checks,'baselineRelease':old_release['id'],'sourceAssetsBefore':len(baseline),
      'sourceAssetsChanged':changed,'sourceAssetsAdded':added,'oldSourceAssetsUnchanged':len(baseline)-len(changed),
      'previousNativeMediaByteIdentical':len(media)-len(allowed_media),'allowedAlphaAtlasReplacements':allowed_media,
      'runtimeChanges':sorted(name for name in old.keys()|new.keys() if old.get(name)!=new.get(name)),
      'syntaxOnlyScripts':syntax,'gameBrowserTestsAudioOrWasmStarted':False}
    write('package-static-verification.json',result)
    write('build-record.json',json.loads((PROJECT/'build/web-mobile/build-record.json').read_text(encoding='utf-8-sig')))
    print(json.dumps({'release':checks['release']['id'],'fullPackageBytes':checks['full_package_bytes'],
      'files':checks['file_count'],'sourceChanges':len(changed),'sourceAdded':len(added),
      'oldNativeMediaUnchanged':len(media)-len(allowed_media)},ensure_ascii=False))


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8');main()
