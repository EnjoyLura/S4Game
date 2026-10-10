"""Read model capabilities without printing credentials or account data."""
import json
import sys
import urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / '美术/tools'))
import art_video_gen as api
data=api.req('GET','/v1/models')
for model in data.get('data',[]):
    if 'minimax' in model.get('id','').lower():
        print(json.dumps(model, ensure_ascii=False))
for route in ('/api/pricing','/api/video/models'):
    try:
        result=json.loads(urllib.request.urlopen(api.API+route,timeout=20).read())
        text=json.dumps(result,ensure_ascii=False)
        (Path(__file__).parent/'raw'/(route.replace('/','_')+'.json')).write_text(text,encoding='utf-8')
        print(route,'keys',list(result) if isinstance(result,dict) else 'list','bytes',len(text))
    except Exception as error: print(route,type(error).__name__)
