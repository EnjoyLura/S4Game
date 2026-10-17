"""Static production/reference and media integrity inspection; no game execution."""
from pathlib import Path
import json
import re
import subprocess
import wave
import numpy as np
import prepare as p

build=p.ROOT/'build/web-mobile'
resources=build/'assets/resources'
config=json.loads(next(resources.glob('config.*.json')).read_text(encoding='utf8'))
manifest=json.loads((p.HERE/'manifest.json').read_text(encoding='utf8'))
paths={value[0]:key for key,value in config['paths'].items()}
native={p.sha(path):path for path in (resources/'native').rglob('*.wav')}
catalog=(p.ROOT/'assets/scripts/core/AudioCatalog.ts').read_text(encoding='utf8')
files_by_cue={}
for cue,body in re.findall(r'^  (\w+): \{ files: kingdom\((.*?)\),',catalog,re.M):
    files_by_cue[cue]=re.findall(r"'([^']+)'",body)
rows=[]
for entry in manifest['files']:
    name=Path(entry['file']).stem
    expected='audio/v24/'+name
    if expected not in paths:raise ValueError('Unbuilt resource '+expected)
    if entry['sha256'] not in native:raise ValueError('Native render not preserved '+expected)
    if name not in files_by_cue[entry['cue']]:raise ValueError('Unreferenced new render '+name)
    src=p.DEST/entry['file']
    meta=json.loads(Path(str(src)+'.meta').read_text(encoding='utf8'))
    native_path=native[entry['sha256']]
    if meta['uuid'] not in native_path.name:raise ValueError('UUID/native mismatch '+name)
    with wave.open(str(src),'rb') as audio:
        pcm=np.frombuffer(audio.readframes(audio.getnframes()),'<i2').reshape(-1,audio.getnchannels())
        if np.any(pcm[0]) or np.any(pcm[-1]):raise ValueError('Nonzero render edge '+name)
    rows.append(dict(resource=expected,native=native_path.relative_to(build).as_posix(),uuid=meta['uuid'],sha256=entry['sha256']))
bundle=next((build/'assets/main').glob('index.*.js'))
text=bundle.read_text(encoding='utf8')
if 'v24/' not in text:raise ValueError('New catalog missing in compiled bundle')
if '漫画奇幻音效 v24' not in (build/'audio-credits.html').read_text(encoding='utf8'):raise ValueError('New credits missing')
media=[]
for path in (p.HERE/'preview/media').glob('*.mp4'):
    raw=subprocess.check_output([p.FF,'-v','error','-i',str(path),'-vn','-ac','2','-ar',str(p.SR),'-f','f32le','-'])
    a=np.frombuffer(raw,'<f4')
    if not len(a) or not np.isfinite(a).all() or max(abs(a))>=.99:raise ValueError('Invalid encoded audio '+path.name)
    media.append(dict(file=path.name,seconds=round(len(a)/2/p.SR,3),peakDBFS=round(float(20*np.log10(max(abs(a)))),2),sha256=p.sha(path)))
page=p.HERE/'preview'
for rel in ['style.css','app.js','scenes.json','media/all.mp4','media/archer.jpg']:
    if not (page/rel).is_file():raise ValueError('Missing page dependency '+rel)
for scene in json.loads((page/'scenes.json').read_text(encoding='utf8')):
    for key in ['video','poster']:
        if not (page/scene[key]).is_file():raise ValueError('Missing scene dependency')
report=dict(cues=len(files_by_cue),productionWaves=len(rows),productionBytes=manifest['bytes'],
    allNativeHashesMatch=True,allMetaUUIDsMatch=True,allEdgesZero=True,
    bundle=bundle.relative_to(p.ROOT).as_posix(),bundleSHA256=p.sha(bundle),rows=rows,encodedMedia=media,
    noGameBrowserTestsOrAudioPlaybackPerformed=True,listeningAcceptance='pending user')
p.write('bundle-inspection.json',report)
print(json.dumps({k:v for k,v in report.items() if k not in ['rows','encodedMedia']},ensure_ascii=False))
