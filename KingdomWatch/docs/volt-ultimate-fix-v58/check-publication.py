"""Read-only HTTP identity checks. Never evaluates JavaScript or opens the game."""
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
html=fetch(r['game']);assert w['entry'] in html.decode('utf-8')
bundle=next((Path(r['stage'])/'assets/main').glob('index.*.js'))
remote=fetch(r['game'].split('?')[0]+bundle.relative_to(Path(r['stage'])).as_posix())
assert hashlib.sha256(remote).digest()==hashlib.sha256(bundle.read_bytes()).digest()
assert b'.prototype.ultShowDuration' not in remote
getter=json.loads(read(HERE/'after-bundle-getter.json'))['getter']
assert getter in remote.decode('utf-8')
(HERE/'published-game.html').write_bytes(html)
r['staticHttpCheck']=dict(status=200,entry=w['entry'],mainBundleHashMatches=True,compiledVoltGetterMatches=True,prototypeGetterAbsent=True)
(HERE/'deployment-stage.json').write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(r['staticHttpCheck']))
