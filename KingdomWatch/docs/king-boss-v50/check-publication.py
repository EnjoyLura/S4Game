"""Read-only HTTP publication identity checks; never executes JS/game/browser."""
from pathlib import Path
import hashlib
import json
import urllib.request

here = Path(__file__).resolve().parent
record = json.loads((here / 'deployment-stage.json').read_text(encoding='utf-8-sig'))
release = json.loads((here / 'web-release.json').read_text(encoding='utf-8-sig'))
req = urllib.request.Request(record['game'], headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=30) as response:
    html = response.read()
    assert response.status == 200 and release['entry'] in html.decode('utf-8')
    result = {'status': response.status, 'entry': release['entry'], 'finalUrl': response.url}
url = record['deployment'].rstrip('/') + '/' + record['kingNativePath']
asset_req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(asset_req, timeout=30) as response:
    assert response.status == 200
    assert hashlib.sha256(response.read()).hexdigest() == record['kingNativeSha256']
    result['kingNativeStatus'] = response.status
    result['kingNativeSha256Matches'] = True
(here / 'published-game.html').write_bytes(html)
record['staticHttpCheck'] = result
(here / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
print(json.dumps(result))
