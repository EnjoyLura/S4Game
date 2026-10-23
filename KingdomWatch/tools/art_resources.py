"""Offline art export, exact pixel verification and source-size audit; no engine execution.

The Cocos 3.8.8 image serializer uses fmt 0=PNG, 1=JPG, 4=WebP. Transform only
its recognized standalone ImageAsset records, and version the entire dependency
chain: native -> import -> bundle config/index -> settings -> normal web export.
Source assets and the normal Cocos build are never written by this module.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
import base64
import copy
import hashlib
import json
from pathlib import Path
from PIL import Image, features

PROJECT = Path(__file__).resolve().parents[1]
POLICY = json.loads((Path(__file__).with_name('art-resource-policy.json')).read_text('utf-8'))
CACHE = PROJECT / 'build/art-resource-cache'
MODES = ('lossless-webp', 'original-png')


def sha(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', 'utf-8')


def decode_uuid(value):
    head, sep, sub = value.partition('@')
    if len(head) == 22:
        raw = head[:2] + base64.b64decode(head[2:]).hex()
        head = '-'.join((raw[:8], raw[8:12], raw[12:16], raw[16:20], raw[20:]))
    return head + (sep + sub if sep else '')


def version_map(config, kind):
    sequence = config['versions'][kind]
    result = {}
    for offset in range(0, len(sequence), 2):
        key, value = sequence[offset:offset+2]
        uuid = config['uuids'][key] if isinstance(key, int) else key
        result[decode_uuid(uuid)] = (offset + 1, value)
    return result


def contained(root, path):
    if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise RuntimeError('Unsafe art export path: ' + str(path))
    return path


def image_records(folder):
    """Resolve native URLs exactly as Cocos Config + ImageAsset do, without running JS."""
    records = []
    for config_path in sorted((folder / 'assets').glob('*/config.*.json')):
        config = json.loads(config_path.read_text('utf-8'))
        imports, natives = version_map(config, 'import'), version_map(config, 'native')
        for uuid, (native_offset, native_version) in natives.items():
            candidates = list((config_path.parent / config['nativeBase'] / uuid[:2]).glob(uuid + '.' + native_version + '.*'))
            images = [p for p in candidates if p.suffix in ('.png', '.jpg', '.jpeg', '.webp')]
            if not images:
                continue
            if len(images) != 1 or uuid not in imports:
                raise RuntimeError('Ambiguous native image/import: ' + uuid)
            import_offset, import_version = imports[uuid]
            imported = config_path.parent / config['importBase'] / uuid[:2] / (uuid + '.' + import_version + '.json')
            data = json.loads(imported.read_text('utf-8'))
            if not (isinstance(data, list) and len(data) == 11 and data[3] == ['cc.ImageAsset']
                    and data[4] == 0 and isinstance(data[5], list) and len(data[5]) == 2
                    and isinstance(data[5][0], dict) and set(data[5][0]) == {'fmt', 'w', 'h'}):
                raise RuntimeError('Unknown Cocos image serialization; keep build unchanged: ' + str(imported))
            expected = {'.png': '0', '.jpg': '1', '.jpeg': '2', '.webp': '4'}[images[0].suffix]
            if data[5][0]['fmt'] != expected:
                raise RuntimeError('Image native format does not match serializer: ' + uuid)
            records.append({'uuid': uuid, 'native': images[0], 'import': imported, 'data': data,
                            'configPath': config_path, 'config': config,
                            'nativeOffset': native_offset, 'importOffset': import_offset})
    actual = {p.resolve() for p in (folder / 'assets').glob('*/native/**/*.png')}
    resolved = {r['native'].resolve() for r in records if r['native'].suffix == '.png'}
    if actual != resolved:
        raise RuntimeError('Some exported PNGs are not covered by exact Cocos native resolution')
    return records


def encode_one(path):
    digest = sha(path)
    with Image.open(path) as original:
        if getattr(original, 'n_frames', 1) != 1 or original.mode not in ('RGBA', 'RGB', 'P', 'L', 'LA'):
            return {'sourceSha256': digest, 'keepReason': 'Unsupported bit depth or animated PNG'}
        if (original.info.get('gamma') is not None and abs(original.info['gamma'] - 0.45455) > 0.00002
                or 'chromaticity' in original.info):
            return {'sourceSha256': digest, 'keepReason': 'Preserve explicit PNG color interpretation'}
        pixels = original.convert('RGBA')
        profile = original.info.get('icc_profile', b'')
    rgba = hashlib.sha256(pixels.tobytes()).hexdigest()
    encoder = 'pillow-' + Image.__version__ + '-webp-' + str(features.version('webp'))
    key = hashlib.sha256((digest + encoder + json.dumps(POLICY['webp'], sort_keys=True)).encode()).hexdigest()
    cached = CACHE / (key + '.webp')
    CACHE.mkdir(parents=True, exist_ok=True)
    reused = cached.is_file()
    if not reused:
        temporary = cached.with_suffix('.part')
        pixels.save(temporary, 'WEBP', icc_profile=profile, **POLICY['webp'])
        temporary.replace(cached)
    with Image.open(cached) as decoded:
        if decoded.size != pixels.size or hashlib.sha256(decoded.convert('RGBA').tobytes()).hexdigest() != rgba:
            raise RuntimeError('Lossless RGBA verification failed: ' + str(path))
        if decoded.info.get('icc_profile', b'') != profile:
            raise RuntimeError('ICC profile verification failed: ' + str(path))
    return {'sourceSha256': digest, 'sourceBytes': path.stat().st_size, 'webpBytes': cached.stat().st_size,
            'width': pixels.width, 'height': pixels.height, 'rgbaSha256': rgba,
            'webpSha256': sha(cached), 'candidate': cached, 'rgbaIdentical': True,
            'iccIdentical': True, 'cacheReused': reused}


def validate_art(folder, manifest):
    """Read every exported image format, version and output byte hash, with no engine."""
    records = image_records(folder)
    by_uuid = {r['uuid']: r for r in records}
    for item in manifest['images']:
        record = by_uuid[item['uuid']]
        if record['native'].relative_to(folder).as_posix() != item['native'] or sha(record['native']) != item['sha256']:
            raise RuntimeError('Image URL/hash is inconsistent: ' + item['uuid'])
        if sha(record['import'])[:16] != item['importVersion']:
            raise RuntimeError('Image import content version is inconsistent')
        with Image.open(record['native']) as decoded:
            if decoded.size != (item['width'], item['height']):
                raise RuntimeError('Image dimensions changed')
            if hashlib.sha256(decoded.convert('RGBA').tobytes()).hexdigest() != item['rgbaSha256']:
                raise RuntimeError('Exported RGBA bytes changed')
    settings_path, = (folder / 'src').glob('settings.*.json')
    versions = json.loads(settings_path.read_text('utf-8'))['assets']['bundleVers']
    for name, version in manifest['bundleVersions'].items():
        path = folder / 'assets' / name / ('config.' + version + '.json')
        if versions[name] != version or sha(path)[:16] != version:
            raise RuntimeError('Image bundle config content version is inconsistent')
    return {'nativeImagesResolved': len(records), 'webpImagesRGBAAndHashesVerified': len(manifest['images']),
            'gameEngineExecuted': False}


def optimize_export(folder, mode='lossless-webp'):
    folder = Path(folder).resolve()
    if mode not in MODES:
        raise ValueError('Unknown texture mode')
    if not (folder / 'assets').is_dir() or folder == (PROJECT / 'build/web-mobile').resolve():
        raise RuntimeError('Art transformation requires an independent export, not source/Cocos output')
    if list(folder.glob('art-resources.*.json')):
        raise RuntimeError('An already optimized export must be validated, not transformed again')
    javascript = sorted(sha(p) for p in folder.rglob('*.js'))
    records = image_records(folder)
    before = sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())
    pngs = [r for r in records if r['native'].suffix == '.png']
    if any(r['native'].stat().st_size > POLICY['limits']['imageFileBytes'] for r in records):
        raise RuntimeError('Native image exceeds the art file budget')
    for record in records:
        with Image.open(record['native']) as image:
            if max(image.size) > POLICY['limits']['textureSide']:
                raise RuntimeError('Texture exceeds the configured maximum side: ' + str(record['native']))
    results = {}
    if mode == 'lossless-webp':
        # Identical images share one encoding task. Cache reads still decode and verify pixels.
        unique = {sha(r['native']): r['native'] for r in pngs}
        with ThreadPoolExecutor(max_workers=POLICY['workers']) as pool:
            jobs = {pool.submit(encode_one, path): digest for digest, path in unique.items()}
            for i, job in enumerate(as_completed(jobs), 1):
                results[jobs[job]] = job.result()
                if i == 1 or i % 25 == 0 or i == len(jobs):
                    print('Lossless art encoding: ' + str(i) + '/' + str(len(jobs)), flush=True)
    changed = {}
    manifest = {'schema': 1, 'mode': mode, 'images': [], 'bundleVersions': {},
                'pngImagesExamined': len(pngs), 'pngKept': [], 'sourceMastersModified': False,
                'pillow': Image.__version__, 'libwebp': features.version('webp')}
    for record in pngs:
        path = record['native']
        result = results.get(sha(path), {})
        if not result or result.get('keepReason') or result['sourceBytes'] - result['webpBytes'] < POLICY['minimumSavingBytes']:
            manifest['pngKept'].append({'uuid': record['uuid'], 'reason': result.get('keepReason', 'Original PNG is smaller or original-png mode')})
            continue
        if max(result['width'], result['height']) > POLICY['limits']['textureSide']:
            raise RuntimeError('Texture exceeds the configured maximum side')
        target = contained(folder, path.with_name(record['uuid'] + '.' + result['webpSha256'][:16] + '.webp'))
        if target.exists():
            raise RuntimeError('Refusing to overwrite an existing image export')
        target.write_bytes(result['candidate'].read_bytes())
        data = copy.deepcopy(record['data'])
        data[5][0]['fmt'] = '4'
        serialized = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        import_version = hashlib.sha256(serialized).hexdigest()[:16]
        imported = contained(folder, record['import'].with_name(record['uuid'] + '.' + import_version + '.json'))
        imported.write_bytes(serialized)
        if record['configPath'] not in changed:
            changed[record['configPath']] = copy.deepcopy(record['config'])
        config = changed[record['configPath']]
        config['versions']['native'][record['nativeOffset']] = result['webpSha256'][:16]
        config['versions']['import'][record['importOffset']] = import_version
        contained(folder, path).unlink()
        contained(folder, record['import']).unlink()
        manifest['images'].append({'uuid': record['uuid'], 'native': target.relative_to(folder).as_posix(),
            'sha256': result['webpSha256'], 'originalPngSha256': result['sourceSha256'],
            'originalBytes': result['sourceBytes'], 'bytes': result['webpBytes'],
            'width': result['width'], 'height': result['height'], 'rgbaSha256': result['rgbaSha256'],
            'importVersion': import_version})
    settings_path, = (folder / 'src').glob('settings.*.json')
    settings = json.loads(settings_path.read_text('utf-8'))
    for old_path, config in changed.items():
        serialized = (json.dumps(config, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        version = hashlib.sha256(serialized).hexdigest()[:16]
        old_version = settings['assets']['bundleVers'][config['name']]
        config_path = contained(folder, old_path.with_name('config.' + version + '.json'))
        config_path.write_bytes(serialized)
        contained(folder, old_path).unlink()
        old_index = old_path.parent / ('index.' + old_version + '.js')
        if old_index.is_file():
            contained(folder, old_index).rename(contained(folder, old_index.with_name('index.' + version + '.js')))
        settings['assets']['bundleVers'][config['name']] = version
        manifest['bundleVersions'][config['name']] = version
    if changed:
        write_json(settings_path, settings)
    if sorted(sha(p) for p in folder.rglob('*.js')) != javascript:
        raise RuntimeError('Art export changed JavaScript bytes')
    manifest['nativeBytesBefore'] = sum(x['originalBytes'] for x in manifest['images'])
    manifest['nativeBytesAfter'] = sum(x['bytes'] for x in manifest['images'])
    manifest['nativeBytesSaved'] = manifest['nativeBytesBefore'] - manifest['nativeBytesAfter']
    manifest['checks'] = validate_art(folder, manifest)
    manifest['javascriptBytesUnchanged'] = True
    raw = (json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()
    filename = 'art-resources.' + hashlib.sha256(raw).hexdigest()[:16] + '.json'
    (folder / filename).write_bytes(raw)
    total = sum(p.stat().st_size for p in folder.rglob('*') if p.is_file())
    if total > POLICY['limits']['runtimeBytes']:
        raise RuntimeError('Runtime export exceeds the art resource byte budget')
    return {'mode': mode, 'manifest': filename, 'requiresWebP': bool(manifest['images']),
            'imagesConverted': len(manifest['images']), 'pngImagesKept': len(manifest['pngKept']),
            'nativeBytesSaved': manifest['nativeBytesSaved'], 'bytesBeforeArtStep': before,
            'bytesAfterArtStepIncludingReport': total, 'checks': manifest['checks']}


def audit_sources(output):
    """Measure alpha bounding boxes, frame allocation, duplicates and texture memory."""
    images = []
    for path in sorted((PROJECT / 'assets/resources').rglob('*.png')):
        with Image.open(path) as original:
            image = original.convert('RGBA')
        width, height = image.size
        alpha = image.getchannel('A')
        bounds = alpha.getbbox()
        item = {'path': path.relative_to(PROJECT).as_posix(), 'bytes': path.stat().st_size,
                'sha256': sha(path), 'width': width, 'height': height,
                'rgbaTextureBytes': width * height * 4, 'alphaBounds': bounds,
                'opaque': alpha.getextrema() == (255, 255)}
        frames_path = path.with_suffix('.frames.json')
        if frames_path.is_file():
            data = json.loads(frames_path.read_text('utf-8'))
            frames = data.get('frames', {})
            if isinstance(frames, dict):
                rects = [v for v in frames.values() if isinstance(v, list) and len(v) == 4
                         and all(isinstance(n, int) for n in v)]
                valid = [r for r in rects if r[0] >= 0 and r[1] >= 0 and r[2] > 0 and r[3] > 0
                         and r[0] + r[2] <= width and r[1] + r[3] <= height]
                if valid:
                    allocated = tight = padded = 0
                    for x, y, w, h in valid:
                        box = alpha.crop((x, y, x+w, y+h)).getbbox()
                        allocated += w*h
                        if box:
                            bw, bh = box[2]-box[0], box[3]-box[1]
                            tight += bw*bh
                            padded += min(w, bw+8)*min(h, bh+8)
                    item['frames'] = {'count': len(valid), 'allocatedPixels': allocated,
                        'alphaBoundingPixels': tight, 'boundingPixelsWith4pxPadding': padded,
                        'boundingAreaSavingPercent': round((1-padded/allocated)*100, 2),
                        'estimateOnly': 'Area sum is not a repacked atlas size; keep pivots, timing, extrusion and filtering'}
        item['warnings'] = []
        if item['rgbaTextureBytes'] >= POLICY['warnings']['textureRGBABytes']:
            item['warnings'].append('Large decoded texture: audit loading lifetime and tight packing')
        if width == height and width >= POLICY['warnings']['largeSquareIconSide'] and 'frames' not in item:
            item['warnings'].append('Review largest actual displayed pixel size, including detail zoom and DPR')
        images.append(item)
    grouped = {}
    for item in images:
        grouped.setdefault(item['sha256'], []).append(item['path'])
    report = {'schema': 1, 'productionPixelsOrFramesChanged': False,
              'pngBytes': sum(r['bytes'] for r in images), 'pngCount': len(images),
              'duplicateGroups': [v for v in grouped.values() if len(v) > 1],
              'images': sorted(images, key=lambda r: r['bytes'], reverse=True),
              'notes': 'RGBA bytes are per base texture, not simultaneously resident memory. Source audit only; no game/browser/audio/WASM execution.'}
    write_json(Path(output), report)
    return {'pngBytes': report['pngBytes'], 'pngCount': len(images),
            'frameAtlasesMeasured': sum('frames' in r for r in images), 'duplicateGroups': len(report['duplicateGroups'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    audit = sub.add_parser('audit'); audit.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'audit':
        print(json.dumps(audit_sources(args.output)))
