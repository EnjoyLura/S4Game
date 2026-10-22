"""Read-only HTTP HTML check; does not execute browser/game JavaScript."""
from pathlib import Path
import json
import urllib.request

here = Path(__file__).resolve().parent
record = json.loads((here / 'deployment-stage.json').read_text(encoding='utf-8-sig'))
release = json.loads((here / 'web-release.json').read_text(encoding='utf-8-sig'))
request = urllib.request.Request(record['game'], headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(request, timeout=30) as response:
    html = response.read()
    if response.status != 200 or release['entry'] not in html.decode('utf8'):
        raise ValueError('Published HTML entry mismatch')
    record['staticHttpCheck'] = dict(status=response.status, entry=release['entry'], finalUrl=response.url)
(here / 'published-game.html').write_bytes(html)
(here / 'deployment-stage.json').write_text(json.dumps(record, indent=2), encoding='utf8')
print(json.dumps(record['staticHttpCheck']))
