"""Export and inspect files/pixels/SHA only; never starts JS, WASM or gameplay."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

REPORT = Path(__file__).resolve().parent
PROJECT = REPORT.parents[1]
sys.path.insert(0, str(PROJECT / 'tools/github-pages'))
from export import export, validate_package


def sha(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def write(name, value):
    (REPORT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')


def main():
    config = json.loads((PROJECT / 'tools/github-pages/config.json').read_text('utf-8'))
    published = Path(config['checkout'])
    old_release = json.loads((published / 'hosting-release.json').read_text('utf-8'))
    old = json.loads((published / old_release['inventory']).read_text('utf-8'))['files']
    if old_release['id'] != '3fd186b7aee76e4e':
        raise RuntimeError('Expected v91 comparison baseline before publishing')
    sources = json.loads((PROJECT / 'docs/browser-cache-v90/baseline.json').read_text('utf-8'))['assets']
    current = {p.relative_to(PROJECT).as_posix(): sha(p) for p in sorted((PROJECT / 'assets').rglob('*')) if p.is_file()}
    changed = sorted(k for k in sources.keys() | current.keys() if sources.get(k) != current.get(k))
    expected = ['assets/scripts/battle/BattleDirector.ts', 'assets/scripts/ui/BattleProgressBar.ts',
                'assets/scripts/ui/HUD.ts', 'assets/scripts/ui/Panels.ts']
    if changed != expected:
        raise RuntimeError('Unexpected source asset changes: ' + repr(changed))
    package = PROJECT / 'build/github-pages-battle-ui-v92'
    result = export(package, config)
    write('export-report.json', result)
    checks = validate_package(package, config)
    new = json.loads((package / checks['release']['inventory']).read_text('utf-8'))['files']
    media = [name for name in old if '/native/' in name]
    if any(new.get(name) != old[name] for name in media):
        raise RuntimeError('An existing native media/font resource changed')
    old_art = {k:v for k,v in old.items() if k.startswith('art-resources.')}
    if old_art != {k:v for k,v in new.items() if k.startswith('art-resources.')}:
        raise RuntimeError('Art manifest changed')
    syntax = []
    for name in new:
        if name.endswith('.js'):
            checked = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', str(package / name)],
                                     capture_output=True, text=True)
            if checked.returncode:
                raise RuntimeError('JS syntax failed: ' + name + '\n' + checked.stderr)
            syntax.append(name)
    changes = sorted(name for name in old.keys() | new.keys() if old.get(name) != new.get(name))
    result = {'checks': checks, 'baselineRelease': old_release['id'], 'baselineCommit': 'a3fe1d0e',
              'sourceAssetsChanged': changed, 'sourceAssetsUnchanged': len(current) - len(changed),
              'sourceAssetsAddedOrRemoved': sorted(sources.keys() ^ current.keys()),
              'nativeMediaFilesByteIdentical': len(media), 'artManifestUnchanged': True,
              'runtimeChanges': changes, 'syntaxOnlyScripts': syntax,
              'gameBrowserTestsAudioOrWasmStarted': False}
    write('package-static-verification.json', result)
    write('build-record.json', json.loads((PROJECT / 'build/web-mobile/build-record.json').read_text('utf-8-sig')))
    print(json.dumps({k:v for k,v in result.items() if k not in ('checks', 'syntaxOnlyScripts')}, ensure_ascii=False))
    print(json.dumps({'release': checks['release']['id'], 'fullPackageBytes': checks['full_package_bytes'],
                      'files': checks['file_count']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
