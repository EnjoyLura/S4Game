"""Measure stronger lossless candidates on the currently protected images only."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json
import sys

PROJECT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT / 'tools'))
from art_resources import encode_one, POLICY


def main():
    root = Path('D:/AI/kingdom-watch-pages')
    release = json.loads((root / 'hosting-release.json').read_text('utf-8'))
    inventory = json.loads((root / release['inventory']).read_text('utf-8'))
    manifest = json.loads((root / inventory['runtime']['art_resources']['manifest']).read_text('utf-8'))
    images = [row for row in manifest['images'] if row['encoding'] == 'lossless-webp']
    POLICY['webp']['method'] = 6

    def measure(row):
        candidate = encode_one(PROJECT / row['source'])
        if candidate['sourceRgbaSha256'] != row['sourceRgbaSha256']:
            raise RuntimeError('Source pixels changed during measurement')
        return {'uuid': row['uuid'], 'source': row['source'], 'beforeBytes': row['bytes'],
                'candidateBytes': candidate['webpBytes'],
                'selectedBytes': min(row['bytes'], candidate['webpBytes']) if abs(row['bytes']-candidate['webpBytes']) >= POLICY['minimumSavingBytes'] else row['bytes'],
                'rgbaIdentical': candidate['rgbaIdentical']}

    rows = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        for i, row in enumerate(pool.map(measure, images), 1):
            rows.append(row)
            if i % 30 == 0:
                print('Protected lossless candidates: ' + str(i) + '/' + str(len(images)), flush=True)
    result = {'baselineRelease': release['id'], 'imageCount': len(rows),
              'imagesSmaller': sum(r['selectedBytes'] < r['beforeBytes'] for r in rows),
              'bytesSaved': sum(r['beforeBytes']-r['selectedBytes'] for r in rows),
              'allPixelsIdentical': all(r['rgbaIdentical'] for r in rows), 'images': rows}
    Path(__file__).with_name('lossless-measurement.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'images'}))


if __name__ == '__main__':
    main()
