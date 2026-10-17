"""Fetch official free recordings; no generation service, playback or model upload."""
from pathlib import Path
import concurrent.futures
import hashlib
import importlib.util
import json
import shutil
import urllib.request
import urllib.error

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PREV = ROOT/'docs/audio-representatives-r1'
spec = importlib.util.spec_from_file_location('sonniss_fetch', PREV/'sonniss_fetch.py')
remote = importlib.util.module_from_spec(spec)
spec.loader.exec_module(remote)
INDEX = json.loads((PREV/'index-2015-1.json').read_text())
NAMES = {
    'arrow': 'Membrans - Cartoon Arrow Sound Pack 01/Cartoon Arrow 44.wav',
    'swish': 'Mechanical Wave - Hits Whoosh/Fast Action Swish_HW 05.wav',
    'swing': 'Mechanical Wave - Hits Whoosh/Action Swish_HW 02.wav',
    'hit1': 'NoizBoy - Hong Kong Action Kit - Hit Kit #1/Seq 2.1 Hit #2 96 HK1.wav',
    'hit2': 'NoizBoy - Hong Kong Action Kit - Hit Kit #1/Seq1.15 Hit #3 96 HK1.wav',
    'hit3': 'NoizBoy - Hong Kong Action Kit - Hit Kit #1/Seq 2.27 Hit #2 96 HK1.wav',
    'ice': 'Mattia Cellotto - Crunch Mode/Ice,Impact,Throw,Snowball,Step,Snow,Stalactite,Various12.M.wav',
    'icecrack': 'Mattia Cellotto - Crunch Mode/Frozen,Celery,Crunch,Break,Ice,Sheet,Various01.wav',
    'iceblock': 'Eiravaein Works - Vaeyan I/IceBlocks,impact,cracked,tinypieces,scatter,slide,concrete,chunky,ambiance.M.wav',
    'lighter': 'Soundopolis - Foley Plus_Full/Lighter_Blue Flame_E_Light_Fienup_001.wav',
    'huff': 'Varazuvi - Hollywood Dragons/Dragon Short Huff.wav',
    'electric': 'Soundopolis - Sci-Fi Electric/Electrical_Current_MouthNoises_Fienup_001.wav',
    'current': 'Soundopolis - Sci-Fi Electric/Electrical_Current_Texture_Fienup_004.wav',
    'thunder': 'Soundopolis - Natures Fury_Thunder/Thunder_Crack_Fienup_016.wav',
    'rock': 'Mechanical Wave - Rock Brick and Dirt/Hit Rock Debris_RBD 02.wav',
    'rockdrop': 'Mechanical Wave - Rock Brick and Dirt/Drop Rock On Rock Debris_RBD 03.wav',
    'debris': 'Mechanical Wave - Rock Brick and Dirt/Debris Brick_RBD 02.wav',
    'wood': 'Robert Cordova - Base/Wood Rattle 10.wav',
    'coins': 'Varazuvi - California Foley/coins2.wav',
    'paper': 'Robert Cordova - Base/Paper Rip 02.wav',
}

def fetch(item):
    key, name = item
    e = next(x for x in INDEX['entries'] if x['name'] == name)
    dst = HERE/'sources/Sonniss2015'/name
    old = PREV/'sources/Sonniss2015'/name
    if old.exists() and not dst.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(old, dst)
    remote.extract(INDEX, e, dst)
    print(key, dst.stat().st_size, flush=True)
    return key, dict(path=str(dst.relative_to(ROOT)).replace('\\','/'), original=name,
        author=name.split(' - ')[0], url=INDEX['url'], archiveCRC32=e['crc'],
        license='Sonniss GameAudioGDC EULA v2.0', licenseURL='https://sonniss.com/gdc-bundle-license/',
        sha256=hashlib.sha256(dst.read_bytes()).hexdigest())

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        records = dict(pool.map(fetch, NAMES.items()))
    (HERE/'sources.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf8')
    license_path = HERE/'sources/sonniss-license-2026-10-17.html'
    if not license_path.exists():
        try:
            req = urllib.request.Request('https://sonniss.com/gdc-bundle-license/', headers={'User-Agent':'Mozilla/5.0'})
            license_path.write_bytes(urllib.request.urlopen(req, timeout=40).read())
        except urllib.error.HTTPError as error:
            # Web browsing independently retrieved the current official EULA.
            print('License HTML download unavailable:', error.code, '(official terms read with web tool)', flush=True)
