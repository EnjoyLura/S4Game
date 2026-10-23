"""Measure local encoding candidates without changing any game or build asset."""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import time
from PIL import Image, features

PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT.parent / '.local-art-archive/png-compression-lab-v80'
SAMPLES = [
    'ux/volt_attack_user_v2/attack.png',
    'ux/sniper_attack_clean_v1/attack.png',
    'fx/frost_domain_video_v10.png',
    'ux/ui_card_pyro_shards_v2.png',
    'scenes/scene_1_1.png',
    'scenes/bg_campaign_outpost_v1.png',
    'ux/pick_comic_v1/card_base.png',
]


def measure(name):
    source = PROJECT / 'assets/resources' / name
    image = Image.open(source).convert('RGBA')
    pixels = hashlib.sha256(image.tobytes()).hexdigest()
    result = {'source': 'assets/resources/' + name, 'pngBytes': source.stat().st_size,
              'width': image.width, 'height': image.height, 'rgbaTextureBytes': image.width * image.height * 4}
    for label, options in [('lossless', {'lossless': True, 'quality': 100, 'method': 4, 'exact': True}),
                           ('quality90', {'lossless': False, 'quality': 90, 'method': 4, 'alpha_quality': 100})]:
        target = OUTPUT / label / Path(name).with_suffix('.webp')
        target.parent.mkdir(parents=True, exist_ok=True)
        start = time.monotonic()
        image.save(target, 'WEBP', **options)
        with Image.open(target) as encoded:
            decoded = encoded.convert('RGBA')
            identical = hashlib.sha256(decoded.tobytes()).hexdigest() == pixels
            alpha_identical = decoded.getchannel('A').tobytes() == image.getchannel('A').tobytes()
        if label == 'lossless' and not identical: raise RuntimeError('RGBA pixels changed: ' + name)
        result[label] = {'bytes': target.stat().st_size, 'encodeSeconds': round(time.monotonic() - start, 2),
                         'rgbaPixelsIdentical': identical, 'alphaIdentical': alpha_identical,
                         'savingPercent': round((1 - target.stat().st_size / source.stat().st_size) * 100, 1)}
    return result


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(measure, SAMPLES))
    png = sum(x['pngBytes'] for x in records)
    totals = {'pngBytes': png}
    for label in ('lossless', 'quality90'):
        size = sum(x[label]['bytes'] for x in records)
        totals[label] = {'bytes': size, 'savingPercent': round((1 - size / png) * 100, 1)}
    report = {'scope': 'Seven representative current PNG files, not a complete release estimate',
              'pillowVersion': Image.__version__, 'webpVersion': features.version('webp'),
              'localCandidates': str(OUTPUT), 'productionAssetsChanged': False,
              'gameOrBrowserStarted': False, 'totals': totals, 'samples': records}
    (PROJECT / 'docs/resource-slim-v80/png-sample-measurements.json').write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(totals), flush=True)
