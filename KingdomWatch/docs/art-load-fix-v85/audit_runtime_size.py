"""Size the current release only, even when the checkout retains older releases."""
from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
import sys
from PIL import Image

PROJECT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from art_resources import image_records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('runtime-size-current.json'))
    args = parser.parse_args()
    folder = args.package.resolve()
    release = json.loads((folder / 'hosting-release.json').read_text('utf-8'))
    inventory_path = folder / release['inventory']
    if hashlib.sha256(inventory_path.read_bytes()).hexdigest() != release['inventory_sha256']:
        raise RuntimeError('Inventory hash mismatch')
    inventory = json.loads(inventory_path.read_text('utf-8'))
    files = inventory['files']
    byext, counts = Counter(), Counter()
    for name, info in files.items():
        extension = Path(name).suffix or '(none)'
        byext[extension] += info['bytes']
        counts[extension] += 1
    metas = {}
    for path in (PROJECT / 'assets').rglob('*.meta'):
        meta = json.loads(path.read_text('utf-8-sig'))
        metas[meta.get('uuid')] = path.with_suffix('')
    images = {}
    for record in image_records(folder):
        native = record['native']
        name = native.relative_to(folder).as_posix()
        if name not in files or name in images:
            continue
        source = metas.get(record['uuid'])
        path = source.relative_to(PROJECT).as_posix() if source else '[engine]'
        framed = bool(source and source.with_suffix('.frames.json').is_file())
        group = 'frame-atlases' if framed else 'scene-backgrounds' if '/scenes/' in path else 'other-images'
        with Image.open(native) as im:
            width, height = im.size
        images[name] = {'source': path, 'native': name, 'bytes': files[name]['bytes'],
                        'sourceBytes': source.stat().st_size if source else None,
                        'width': width, 'height': height, 'group': group}
    rows = sorted(images.values(), key=lambda item: item['bytes'], reverse=True)
    if sum(item['bytes'] for item in rows) != sum(byext[key] for key in ('.webp', '.png', '.jpg', '.jpeg')):
        raise RuntimeError('Image breakdown must equal actual inventory bytes')
    result = {'release': release, 'runtimeBytes': inventory['total_bytes'],
              'actualFilesIncludingManifestsBytes': inventory['total_bytes'] + inventory_path.stat().st_size + (folder / 'hosting-release.json').stat().st_size,
              'byExtension': {key: {'bytes': value, 'count': counts[key]} for key, value in byext.most_common()},
              'imageGroups': {group: {'bytes': sum(item['bytes'] for item in rows if item['group'] == group),
                                      'count': sum(item['group'] == group for item in rows)} for group in sorted(set(item['group'] for item in rows))},
              'images': rows, 'files': files, 'gameBrowserOrWasmStarted': False}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({key: value for key, value in result.items() if key not in ('files', 'images')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
