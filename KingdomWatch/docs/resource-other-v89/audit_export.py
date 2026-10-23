"""Verify actual package, unchanged playback assets, pixels and local archive."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import sys

PROJECT = Path(__file__).resolve().parents[2]
REPORT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT / 'tools/github-pages'))
from export import validate_package


def sha(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def main():
    package = (PROJECT / 'build/github-pages-other-resources-v89').resolve()
    config = json.loads((PROJECT / 'tools/github-pages/config.json').read_text('utf-8'))
    checks = validate_package(package, config)
    baseline = json.loads((REPORT / 'baseline-package.json').read_text('utf-8'))
    inventory = json.loads((package / checks['release']['inventory']).read_text('utf-8'))
    files = inventory['files']
    manifest = json.loads((package / inventory['runtime']['art_resources']['manifest']).read_text('utf-8'))
    old_images = {row['uuid']: row for row in baseline['imageManifest']['images']}
    replacements, same_images = [], 0
    for row in manifest['images']:
        old = old_images[row['uuid']]
        if old['sourceRgbaSha256'] != row['sourceRgbaSha256'] or old['alphaSha256'] != row['alphaSha256']:
            raise RuntimeError('Source image content changed')
        if row['encoding'] == 'webp-q95' and row['sha256'] != old['sha256']:
            raise RuntimeError('Q95 images changed during the lossless-only follow-up')
        if old['sha256'] != row['sha256']:
            if row['encoding'] != 'lossless-webp' or row['rgbaSha256'] != old['rgbaSha256'] or row['bytes'] >= old['bytes']:
                raise RuntimeError('Image changed beyond a smaller pixel-identical lossless encoding')
            replacements.append({'source': row['source'], 'bytesSaved': old['bytes']-row['bytes'], 'oldNative': old['native']})
        else:
            same_images += 1
    reference = json.loads((REPORT / 'audio-references.json').read_text('utf-8'))
    music = set(reference['music'])
    for key in reference['retainedAudioPaths']:
        source = PROJECT / 'assets/resources' / (key + ('.mp3' if key in music else '.wav'))
        uuid = json.loads(source.with_suffix(source.suffix + '.meta').read_text('utf-8-sig'))['uuid']
        matches = [name for name in files if '/native/' in name and Path(name).name.startswith(uuid + '.') and Path(name).suffix == source.suffix]
        if len(matches) != 1 or files[matches[0]]['sha256'] != sha(source) or files[matches[0]] != baseline['files'][matches[0]]:
            raise RuntimeError('A declared audio file changed or disappeared: ' + key)
    plan = json.loads((REPORT / 'retirement-plan.json').read_text('utf-8'))
    archive = Path(plan['archive'])
    retired_uuids = {json.loads((archive / row['asset']).read_text('utf-8-sig'))['uuid'] for row in plan['files'] if row['asset'].endswith('.meta')}
    for name in files:
        if '/native/' in name and Path(name).name.split('.')[0] in retired_uuids:
            raise RuntimeError('Retired audio still in the export')
    old_main = sorted(meta['sha256'] for name, meta in baseline['files'].items() if name.startswith('assets/main/') and name.endswith('.js'))
    new_main = sorted(meta['sha256'] for name, meta in files.items() if name.startswith('assets/main/') and name.endswith('.js'))
    if old_main != new_main:
        raise RuntimeError('Main game JavaScript changed')
    replaced_paths = {row['oldNative'] for row in replacements}
    kept_native = 0
    for name, meta in baseline['files'].items():
        if '/native/' not in name:
            continue
        if name in files and files[name] == meta:
            kept_native += 1
        elif name not in replaced_paths and Path(name).name.split('.')[0] not in retired_uuids:
            raise RuntimeError('Other native art/font/media changed: ' + name)
    extensions = Counter()
    for name, meta in files.items():
        extensions[Path(name).suffix] += meta['bytes']
    result = {'package': checks, 'baselineFullBytes': baseline['fullPackageBytes'],
              'fullPackageBytes': checks['full_package_bytes'],
              'bytesSaved': baseline['fullPackageBytes']-checks['full_package_bytes'],
              'reductionPercent': round((1-checks['full_package_bytes']/baseline['fullPackageBytes'])*100, 2),
              'losslessImagesFurtherReduced': len(replacements),
              'losslessImageBytesSaved': sum(row['bytesSaved'] for row in replacements),
              'otherEncodedImagesUnchanged': same_images,
              'allImagePixelsMatchV88': True,
              'declaredAudioFilesByteIdentical': len(reference['retainedAudioPaths']),
              'archivedAudioNotExported': len(retired_uuids), 'unchangedNativeFiles': kept_native,
              'mainGameJavaScriptMatchesV88': True, 'extensionBytes': dict(extensions),
              'gameBrowserTestsAudioOrWasmStarted': False, 'imageReplacements': replacements}
    (REPORT / 'package-static-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({k: v for k, v in result.items() if k not in ('package', 'imageReplacements')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
