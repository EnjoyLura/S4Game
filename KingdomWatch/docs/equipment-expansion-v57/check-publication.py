"""Read-only HTTP release, main bundle and illustration identity; no JS/game execution."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, urllib.request

HERE = Path(__file__).resolve().parent
read = lambda p: p.read_text(encoding='utf-8-sig')
r = json.loads(read(HERE/'deployment-stage.json'))
w = json.loads(read(HERE/'web-release.json'))
assert r['published']
def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=30) as response:
        assert response.status == 200
        return response.read()
html = fetch(r['game'])
assert w['entry'] in html.decode('utf-8')
base = r['game'].split('?')[0]
bundle = next((Path(r['stage'])/'assets/main').glob('index.*.js'))
relative = bundle.relative_to(Path(r['stage'])).as_posix()
assert hashlib.sha256(fetch(base+relative)).digest() == hashlib.sha256(bundle.read_bytes()).digest()
def check(a):
    assert hashlib.sha256(fetch(base+a['path'])).hexdigest() == a['sha256'], a['id']
    return a['id']
with ThreadPoolExecutor(max_workers=4) as pool:
    checked = list(pool.map(check,r['nativeAssets']))
(HERE/'published-game.html').write_bytes(html)
r['staticHttpCheck'] = dict(status=200,entry=w['entry'],mainBundleHashMatches=True,nativeIllustrations=len(checked),allImageHashesMatch=True)
(HERE/'deployment-stage.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(r['staticHttpCheck']))
