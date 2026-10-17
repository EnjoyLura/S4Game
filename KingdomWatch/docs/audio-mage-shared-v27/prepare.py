"""Recorded foley editing, provenance and release staging. No playback or game execution."""
from pathlib import Path
from datetime import datetime
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import wave
import urllib.request
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result
p = module('v24_audio', ROOT/'docs/audio-kingdom-v24/prepare.py')
SR, FF = p.SR, p.FF
DEST = ROOT/'assets/resources/audio/v27'
CHANGED = ['assets/scripts/core/AudioCatalog.ts', 'assets/scripts/core/Sfx.ts',
    'assets/scripts/core/GameAudio.ts', 'assets/scripts/battle/Hero.ts',
    'assets/scripts/battle/Projectile.ts', 'assets/scripts/battle/FrostUltimateVFX.ts',
    'assets/resources/audio/README.txt', 'assets/resources/audio/v1/CREDITS.txt',
    'build-templates/web-mobile/audio-credits.html']
MANIFEST = []

def write(name, value):
    (HERE/name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')

def snapshot():
    if (HERE/'before.json').exists(): raise ValueError('Snapshot already exists')
    for rel in CHANGED:
        out = HERE/'before'/rel; out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT/rel, out)
    files = list((ROOT/'assets/scripts').rglob('*.ts')) + list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json', {f.relative_to(ROOT).as_posix():p.sha(f) for f in files if f.is_file()})
    write('baseline.json', dict(commit='9e6504fa591289c13ab784797e74a2bdd0fed1fe', priorRelease='audio-spells-v26'))
    print('Saved current v26 worktree baseline')

def fetch():
    urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))
    fetcher = module('sonniss_fetch', ROOT/'docs/audio-representatives-r1/sonniss_fetch.py')
    idx = json.loads((ROOT/'docs/audio-representatives-r1/index-2015-1.json').read_text(encoding='utf8'))
    sources = {key:p.SOURCE[key] for key in ['swish','swing','rock','rockdrop','debris','iceblock','hit2']}
    for key, name in [('rumble','Thunder_Rumble_Mid_Fienup_024.wav'), ('deep','Thunder_Rumble_Deep_Fienup_003.wav'),
                      ('boom','EFX EXT Mortar Explosion 08.wav')]:
        entry = next(e for e in idx['entries'] if e['name'].endswith('/'+name))
        out = HERE/'sources'/name
        fetcher.extract(idx,entry,out)
        sources[key] = dict(path=out.relative_to(ROOT).as_posix(), original=entry['name'],
            author='Coll Anderson' if key == 'boom' else 'Soundopolis / David Fienup', url=idx['url'], archiveCRC32=entry['crc'],
            license='Sonniss GameAudioGDC EULA v2.0', licenseURL='https://sonniss.com/gdc-bundle-license/', sha256=p.sha(out))
        print('Fetched and CRC verified',name,flush=True)
    write('sources.json', sources)

def sources():
    p.SOURCE.update(json.loads((HERE/'sources.json').read_text(encoding='utf8')))

def analyze():
    sources()
    rows = []
    for key in json.loads((HERE/'sources.json').read_text(encoding='utf8')):
        a = p.decode(key,45,11000).mean(axis=1)
        w = 441
        rms = np.array([np.sqrt(np.mean(a[i:i+w]**2)) for i in range(0,len(a),w)])
        top = []
        for n in np.argsort(rms)[::-1]:
            if all(abs(n*.01-t)> .8 for t in top): top.append(round(float(n*.01),2))
            if len(top)==6: break
        onset = int(np.flatnonzero(rms>rms.max()*.12)[0])*.01
        rows.append(dict(source=key,seconds=round(len(a)/SR,3),firstOnset=round(onset,3),peakWindows=sorted(top)))
        print(rows[-1],flush=True)
    write('source-analysis.json',rows)

def render_one(name, cue, label, layers, rms, ceiling):
    rendered = [p.layer(**item) for item in layers]
    data = np.zeros((max(round(at*SR)+len(a) for a,at,_ in rendered),2))
    records = []
    for a,at,recipe in rendered:
        start = round(at*SR); data[start:start+len(a)] += a
        source = p.SOURCE[recipe['source']]
        records.append(dict(recipe,**source))
    data = data.mean(axis=1)
    data *= 10**(rms/20)/max(p.energy(data),1e-12)
    data *= min(1,10**(ceiling/20)/max(abs(data)))
    data[0] = data[-1] = 0
    pcm = np.round(data*32767).astype('<i2')
    out = DEST/(name+'.wav')
    with wave.open(str(out),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    p.meta(out,True)
    MANIFEST.append(dict(file=out.name,cue=cue,label=label,seconds=len(data)/SR,bytes=out.stat().st_size,
        sha256=p.sha(out),peakDBFS=round(float(20*np.log10(max(abs(data)))),2),
        activeRMSDBFS=round(float(20*np.log10(p.energy(data))),2),
        clippedSamples=int(np.count_nonzero(abs(pcm.astype(np.int32))>=32767)),
        firstSample=int(pcm[0]),lastSample=int(pcm[-1]),layers=records))
    print(name,MANIFEST[-1]['seconds'],MANIFEST[-1]['activeRMSDBFS'],flush=True)

def render():
    sources(); DEST.mkdir(parents=True,exist_ok=True); p.meta(DEST)
    # One short recorded air movement, identical for every mage basic and skill cast.
    render_one('mage_cast','mageCast','三法师共用施法',[
        dict(key='swish',start=.11,seconds=.24,high=150,low=6000,attack=.008,release=.07)
    ],-27.5,-12)
    # First natural rumble crest and its decay, ending before the second thunder swell.
    render_one('thunder_soft','thunderUlt','轻微自然雷声',[
        dict(key='rumble',start=.4,seconds=1.15,high=45,low=2200,attack=.035,release=.32)
    ],-27.5,-13)
    # Real explosion body plus subdued rock fragments. No fire/electrical layer.
    render_one('meteor_land','fireUlt','陨石撞地',[
        dict(key='boom',start=.275,seconds=.64,high=45,low=1800,attack=.002,release=.16),
        dict(key='rock',start=.11,seconds=.55,gain=.38,high=150,low=4700,attack=.002,release=.12)
    ],-24.5,-8)
    # A real ice block cracking and scattering on concrete, at its original speed.
    render_one('ice_shatter','frostUlt','冰晶落地破碎',[
        dict(key='iceblock',start=0,seconds=.60,high=170,low=8000,attack=.001,release=.15)
    ],-25.5,-9)
    write('manifest.json',dict(version='v27',files=MANIFEST,bytes=sum(r['bytes'] for r in MANIFEST),
        mageFiles=4,audioAuditioned=False,referenceAudioExtracted=False,
        design='One shared cast; natural thunder, grounded explosion/rock, actual ice on concrete. Original sample speed, no synthesized tones, no reverb.'))

def stage():
    prior = Path(json.loads((ROOT/'docs/audio-spells-v26/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
    build = ROOT/'build/web-mobile'
    release = json.loads((build/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']: raise ValueError('Production build required')
    target = ROOT/'build'/('publish-audio-mage-shared-v27-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(build,target,ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior/'previews',target/'previews')
    previous = [f for f in (prior/'previews').rglob('*') if f.is_file()]
    for f in previous:
        if p.sha(f)!=p.sha(target/'previews'/f.relative_to(prior/'previews')): raise ValueError('Historical preview changed')
    shutil.copytree(HERE/'preview',target/'previews/audio-mage-shared-v27')
    version = re.search(r'\?v=(\d+)',release['entry']).group(1)
    write('deployment-stage.json',dict(stage=str(target),priorPublishedStage=str(prior),entryVersion=version,
        project='kingdom-watch',branch='main',published=False,
        game='https://kingdom-watch.pages.dev/?v=audio-mage-shared-v27-'+version,
        preview='https://kingdom-watch.pages.dev/previews/audio-mage-shared-v27/',
        priorPreviewFilesPreserved=len(previous),manualAcceptance='Pending user; no game/browser/audio playback performed'))
    for name in ['build-record.json','web-release.json']: shutil.copy2(build/name,HERE/name)
    print('Release staged',target)

if __name__=='__main__':
    {'snapshot':snapshot,'fetch':fetch,'analyze':analyze,'render':render,'stage':stage}[sys.argv[1]]()
