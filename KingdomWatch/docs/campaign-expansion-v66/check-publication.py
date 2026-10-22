"""Read-only HTTP identity inspection; no browser, script evaluation or game launch."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, urllib.request

DOC = Path(__file__).resolve().parent
read = lambda p:p.read_text(encoding='utf-8-sig')
record = json.loads(read(DOC/'deployment-stage.json'))
release = json.loads(read(DOC/'web-release.json'))
if not record['published']: raise RuntimeError('Not published')
stage = Path(record['stage'])
base = record['game'].split('?')[0]
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as response:
        if response.status!=200: raise RuntimeError('HTTP '+str(response.status))
        return response.read()
html = fetch(record['game'])
if release['entry'].encode() not in html: raise RuntimeError('Stale entry')
bundle = next((stage/'assets/main').glob('index.*.js'))
paths = [bundle.relative_to(stage).as_posix()]
art = json.loads(read(DOC/'imported-art.json'))
for identity in ['world','mobs-forest','battle-desert','map-rift']:
    item = next(a for a in art if a['id']==identity)
    paths.append(next(n for n in record['newNativeMedia'] if item['uuid'] in n))
def compare(path):
    remote = fetch(base+path)
    if hashlib.sha256(remote).digest()!=hashlib.sha256((stage/path).read_bytes()).digest(): raise RuntimeError('Remote identity mismatch: '+path)
    return path
with ThreadPoolExecutor(max_workers=5) as executor:
    checked = list(executor.map(compare,paths))
(DOC/'published-game.html').write_bytes(html)
record['staticHttpCheck'] = dict(status=200,entry=release['entry'],mainBundleHashMatches=True,sampleMediaHashMatches=True,checkedPaths=checked)
(DOC/'deployment-stage.json').write_text(json.dumps(record,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(record['staticHttpCheck']))
