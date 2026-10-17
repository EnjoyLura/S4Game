"""Download a small, version-pinned subset of the CC0 VSCO 2 CE recordings."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import urllib.parse
import urllib.request

HERE = Path(__file__).resolve().parent
tree = json.loads((HERE/'vsco-tree.json').read_text())
revision = tree['sha']
paths = [
    'LICENSE', 'Readme.txt',
    'Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav',
    'Percussion/Marimba/Marimba_hit_Outrigger_G4_loud_01.wav',
    'Percussion/Glock/glock_medium_C5.wav',
    'Percussion/Glock/glock_medium_G5.wav',
    'Strings/Harp/KSHarp_C5_mf.wav',
    'Strings/Harp/KSHarp_A4_mf.wav',
    'Strings/Harp/KSHarp_E5_mf.wav',
    'Brass/Trumpet/stac/Sum_SHTrumpet_stac_C3_v3_rr1.wav',
    'Brass/Trumpet/stac/Sum_SHTrumpet_stac_G3_v3_rr1.wav',
    'Brass/Trumpet/stac/Sum_SHTrumpet_stac_D4_v3_rr1.wav',
    'Brass/Trumpet/sus/Sum_SHTrumpet_sus_G3_v3_rr1.wav',
    'Brass/F Horn/sus/MOHorn_sus_C3_v2_1.wav',
    'Woodwinds/Bassoon/stac/PSBassoon_C3_v1_rr1.wav',
    'Woodwinds/Bassoon/stac/PSBassoon_G2_v1_rr1.wav',
    'Percussion/Timpani/Timpani2_Hit_v3_rr1_Sum.wav',
    'Percussion/Snare2-HitSN_v3_rr1_Sum.wav',
    'Percussion/cymbal-crashshort_v1.wav',
    'Percussion/BellTree_Stroke1_v1_Sum.wav',
]
available = {x['path'] for x in tree['tree']}
missing = [p for p in paths if p not in available]
if missing:
    raise ValueError(f'Not in official tree: {missing}')


def fetch(path):
    target = HERE/'sources/VSCO2CE'/path
    url = 'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/'+revision+'/'+urllib.parse.quote(path)
    if not target.exists():
        raw = urllib.request.urlopen(url, timeout=40).read()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    print(path, target.stat().st_size, flush=True)
    return dict(path=path, url=url, sha256=hashlib.sha256(target.read_bytes()).hexdigest())


with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    result = list(pool.map(fetch, paths))
(HERE/'instrument-sources.json').write_text(json.dumps(dict(revision=revision, license='CC0-1.0',
    source='https://github.com/sgossner/VSCO-2-CE', files=result), indent=2), encoding='utf-8')
