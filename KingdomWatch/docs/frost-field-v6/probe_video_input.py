"""Read public endpoint documentation and verify reference accessibility."""
import re
import urllib.request
import urllib.error
from pathlib import Path
base = Path(__file__).parent
for url in ('https://f192d09f.kw-vfx-src.pages.dev/frost_domain_v6_ff.png',
            'https://kw-vfx-src.pages.dev/crater_glow_ff.png'):
    try:
        response = urllib.request.urlopen(url, timeout=15)
        print(response.status, len(response.read()))
    except urllib.error.HTTPError as error:
        print(error.code, error.read(500).decode('utf-8','replace'))
html = urllib.request.urlopen('https://lensapi.cn/docs', timeout=15).read().decode()
scripts = re.findall(r'src="([^"]+\.js)"', html)
print('scripts',scripts)
for script in scripts:
    if script.startswith('/'):
        data=urllib.request.urlopen('https://lensapi.cn'+script,timeout=20).read()
        dest=base / 'raw' / Path(script).name
        dest.write_bytes(data)
        print('saved documentation client',dest.name,len(data))
