"""Inspect this real export and source hashes offline; never start the game."""
from pathlib import Path
import hashlib
import json
import sys

PROJECT = Path(__file__).resolve().parents[2]
REPORTS = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT / 'tools/github-pages'))
from export import validate_package


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    package = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (PROJECT / 'build/github-pages-art-mixed-v88-r2').resolve()
    config = json.loads((PROJECT / 'tools/github-pages/config.json').read_text('utf-8'))
    checks = validate_package(package, config)
    before = json.loads((REPORTS / 'source-before.json').read_text('utf-8'))
    after = {p.relative_to(PROJECT).as_posix(): sha(p) for p in (PROJECT / 'assets').rglob('*') if p.is_file()}
    if before != after:
        raise RuntimeError('Source assets or scripts changed during the encoding trial')
    baseline = json.loads((REPORTS / 'baseline-package.json').read_text('utf-8'))
    release = checks['release']
    inventory = json.loads((package / release['inventory']).read_text('utf-8'))
    manifest = json.loads((package / inventory['runtime']['art_resources']['manifest']).read_text('utf-8'))
    files = inventory['files']
    old_images = {item['uuid']: item for item in baseline['imageManifest']['images']}
    q95 = [item for item in manifest['images'] if item['encoding'] == 'webp-q95']
    q95_old_paths = set()
    for item in manifest['images']:
        if item['source'] and sha(PROJECT / item['source']) != item['originalPngSha256']:
            raise RuntimeError('Build PNG differs from the preserved source master: ' + item['source'])
        old = old_images[item['uuid']]
        if old['originalPngSha256'] != item['originalPngSha256']:
            raise RuntimeError('Art content changed instead of encoding only')
        if item['encoding'] == 'webp-q95':
            if item['losslessReasons']:
                raise RuntimeError('Protected image uses Q95')
            q95_old_paths.add(old['native'])
        elif old['sha256'] != item['sha256']:
            raise RuntimeError('An image retaining lossless changed bytes')
    native = {name: meta for name, meta in baseline['files'].items() if '/native/' in name}
    unchanged = 0
    for name, meta in native.items():
        if name in files and files[name] == meta:
            unchanged += 1
        elif name not in q95_old_paths:
            raise RuntimeError('Non-Q95 native media changed: ' + name)
    old_main = sorted(meta['sha256'] for name, meta in baseline['files'].items() if name.startswith('assets/main/') and name.endswith('.js'))
    new_main = sorted(meta['sha256'] for name, meta in files.items() if name.startswith('assets/main/') and name.endswith('.js'))
    if old_main != new_main:
        raise RuntimeError('Main game JavaScript differs from v87')
    result = {
        'package': checks,
        'sourceFilesUnchanged': len(before),
        'mainGameJavaScriptMatchesV87': True,
        'baselineFullPackageBytes': baseline['fullPackageBytes'],
        'fullPackageBytes': checks['full_package_bytes'],
        'bytesSaved': baseline['fullPackageBytes'] - checks['full_package_bytes'],
        'reductionPercent': round((1-checks['full_package_bytes']/baseline['fullPackageBytes'])*100, 2),
        'headroomTo200MB': 200000000-checks['full_package_bytes'],
        'q95Images': len(q95),
        'losslessWebpImages': len(manifest['images'])-len(q95),
        'originalTinyPngs': len(manifest['pngKept']),
        'unchangedNativePathsAndBytes': unchanged,
        'nativePathsReplacedOnlyByQ95': len(q95_old_paths),
        'dimensionsAlphaICCAndAnimationMetadataPreserved': True,
        'javascriptUnchangedByArtStep': manifest['javascriptBytesUnchanged'],
        'gameBrowserTestsOrWasmStarted': False,
        'visualQualityRequiresUserReview': True,
    }
    (REPORTS / 'package-static-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'package'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
