from pathlib import Path
import re
import urllib.request
base = Path(__file__).parent / 'raw'
index=(base/'index.cc54fdddce.js').read_text(encoding='utf-8')
for chunk in (511,88202,20048):
    match=re.search(r'[,\{]'+str(chunk)+r':"([a-z0-9]+)"',index)
    if match:
        name=f'{chunk}.{match.group(1)}.js'
        data=urllib.request.urlopen('https://lensapi.cn/static/js/async/'+name,timeout=20).read()
        (base/name).write_bytes(data)
        print(name,len(data))
