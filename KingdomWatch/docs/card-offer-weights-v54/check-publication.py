"""Read-only HTTP identity checks. Does not execute downloaded JavaScript."""
from pathlib import Path
import hashlib,json,urllib.request

HERE=Path(__file__).resolve().parent
read=lambda p:p.read_text(encoding='utf-8-sig')
record=json.loads(read(HERE/'deployment-stage.json'))
release=json.loads(read(HERE/'web-release.json'))
assert record['published']
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=30) as response:
        assert response.status==200
        return response.read()
html=fetch(record['game'])
assert release['entry'] in html.decode('utf-8')
bundle=next((Path(record['stage'])/'assets/main').glob('index.*.js'))
relative=bundle.relative_to(Path(record['stage'])).as_posix()
data=fetch(record['game'].split('?')[0]+relative)
assert hashlib.sha256(data).digest()==hashlib.sha256(bundle.read_bytes()).digest()
(HERE/'published-game.html').write_bytes(html)
record['staticHttpCheck']=dict(status=200,entry=release['entry'],mainBundle=relative,mainBundleHashMatches=True)
(HERE/'deployment-stage.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record['staticHttpCheck']))
