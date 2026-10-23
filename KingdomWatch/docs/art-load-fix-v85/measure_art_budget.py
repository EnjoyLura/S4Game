"""Measure an offline Q95 export candidate. Never edit or publish game assets."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, features

PROJECT = Path(__file__).resolve().parents[2]
REPORT = Path(__file__).with_name('runtime-size-before.json')
OUTPUT = PROJECT.parent / '.local-art-archive/art-budget-v85-q95'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def measure(item):
    source = PROJECT / item['source']
    if source.suffix.lower() != '.png' or item['bytes'] < 1024:
        return dict(item, candidateBytes=item['bytes'], selectedBytes=item['bytes'], unchanged=True)
    with Image.open(source) as im:
        rgba = im.convert('RGBA')
        profile = im.info.get('icc_profile', b'')
    key = digest(source.read_bytes())
    candidate = OUTPUT / (key + '.webp')
    if not candidate.exists():
        rgba.save(candidate, 'WEBP', lossless=False, quality=95, method=4,
                  alpha_quality=100, exact=True, icc_profile=profile)
    with Image.open(candidate) as decoded:
        if decoded.size != rgba.size or decoded.convert('RGBA').getchannel('A').tobytes() != rgba.getchannel('A').tobytes():
            raise RuntimeError('Candidate changed dimensions/alpha: ' + str(source))
        if decoded.info.get('icc_profile', b'') != profile:
            raise RuntimeError('Candidate changed ICC profile: ' + str(source))
    return dict(item, sourceSha256=key, candidate=str(candidate), candidateBytes=candidate.stat().st_size,
                selectedBytes=min(item['bytes'], candidate.stat().st_size),
                candidateSha256=digest(candidate.read_bytes()), dimensionsAndAlphaIdentical=True,
                rgbLossy=True, productionChanged=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, default=REPORT)
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('q95-budget-measurement.json'))
    args = parser.parse_args()
    baseline = json.loads(args.report.read_text('utf-8'))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = [pool.submit(measure, item) for item in baseline['images']]
        for i, future in enumerate(as_completed(jobs), 1):
            rows.append(future.result())
            if i % 40 == 0:
                print('Measured images: ' + str(i), flush=True)
    groups = {}
    for group in sorted(set(item['group'] for item in rows)):
        subset = [item for item in rows if item['group'] == group]
        groups[group] = {'currentBytes': sum(item['bytes'] for item in subset),
                         'candidateBytes': sum(item['selectedBytes'] for item in subset),
                         'count': len(subset)}
    image_before = sum(item['bytes'] for item in rows)
    image_after = sum(item['selectedBytes'] for item in rows)
    other = baseline['actualFilesIncludingManifestsBytes'] - image_before
    report = {'baselineRelease': baseline['release']['id'], 'currentFullPackageBytes': baseline['actualFilesIncludingManifestsBytes'],
              'currentImagesBytes': image_before, 'candidateImagesBytes': image_after, 'otherBytesKept': other,
              'candidateFullPackageBytesBeforeMetadataReversioning': image_after + other,
              'budgetBytes': 200000000, 'imageGroups': groups,
              'encoding': {'quality': 95, 'method': 4, 'alphaQuality': 100, 'lossless': False,
                           'pillow': Image.__version__, 'libwebp': features.version('webp')},
              'dimensionsAlphaICCChecked': True, 'allFramesTimingAndDimensionsKept': True,
              'rgbChangesRequireVisualReview': True, 'candidateIsNotAGameRelease': True,
              'productionAssetsModified': False, 'gameBrowserAudioOrWasmStarted': False,
              'images': sorted(rows, key=lambda r: r['bytes'], reverse=True)}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'images'}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
