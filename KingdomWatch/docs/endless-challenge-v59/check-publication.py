"""Read-only HTTP identity inspection, without evaluating scripts or opening the game."""
from pathlib import Path
import hashlib,json,urllib.request
HERE=Path(__file__).resolve().parent
read=lambda p:p.read_text(encoding='utf-8-sig')
r=json.loads(read(HERE/'deployment-stage.json'));w=json.loads(read(HERE/'web-release.json'))
assert r['published']
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as response:
        assert response.status==200
        return response.read()
base=r['game'].split('?')[0];stage=Path(r['stage'])
html=fetch(r['game']);assert w['entry'] in html.decode('utf-8')
bundle=next((stage/'assets/main').glob('index.*.js'))
remote=fetch(base+bundle.relative_to(stage).as_posix())
assert hashlib.sha256(remote).digest()==hashlib.sha256(bundle.read_bytes()).digest()
for marker in ['endlessChapter','endlessFloor','endlessReturn','baseEndlessDialog','bg_base_endless_v59']:
    assert marker in remote.decode('utf-8'),marker
assert b'.prototype.ultShowDuration' not in remote
for path in r['newNativeMedia']:
    assert hashlib.sha256(fetch(base+path)).digest()==hashlib.sha256((stage/path).read_bytes()).digest()
(HERE/'published-game.html').write_bytes(html)
r['staticHttpCheck']=dict(status=200,entry=w['entry'],mainBundleHashMatches=True,endlessMarkersPresent=True,newSceneHashMatches=True,prototypeGetterAbsent=True)
(HERE/'deployment-stage.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(r['staticHttpCheck']))
