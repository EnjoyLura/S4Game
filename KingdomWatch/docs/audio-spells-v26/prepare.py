"""Single-source elemental cues. Offline authoring; never plays audio or runs the game."""
from pathlib import Path
from datetime import datetime
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import wave
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('v24_audio', ROOT/'docs/audio-kingdom-v24/prepare.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
SR, FF = p.SR, p.FF
DEST = ROOT/'assets/resources/audio/v26'
SOURCE_PAGE = 'https://opengameart.org/content/jc-sounds-fantasy-sfx-pack-vol-1'
ARCHIVE_URL = 'https://opengameart.org/sites/default/files/fantasy_sfx_pack_vol_1.7z'
CHANGED = ['assets/scripts/core/AudioCatalog.ts', 'assets/scripts/core/Sfx.ts',
           'assets/scripts/core/GameAudio.ts', 'assets/scripts/battle/Monster.ts',
           'assets/resources/audio/README.txt', 'assets/resources/audio/v1/CREDITS.txt',
           'build-templates/web-mobile/audio-credits.html']
PREFIX = 'Single_Fantasy SFX Pack Vol 1_'
MANIFEST = []

def write(name, data):
    (HERE/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')

def snapshot():
    if (HERE/'before.json').exists():
        raise ValueError('Snapshot already exists')
    for rel in CHANGED:
        out = HERE/'before'/rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT/rel, out)
    files = list((ROOT/'assets/scripts').rglob('*.ts')) + list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json', {f.relative_to(ROOT).as_posix():p.sha(f) for f in files if f.is_file()})
    write('baseline.json', dict(commit='9e6504fa591289c13ab784797e74a2bdd0fed1fe',
          message='保存当前音频、战役与界面迭代版本', priorRelease='audio-mages-ui-v25'))
    print('Saved v25 source/audio baseline')

def fetch():
    # Re-download from the author's distribution; verify the retained extraction against it.
    import py7zr
    folder = HERE/'sources'
    folder.mkdir(exist_ok=True)
    archive = folder/'fantasy_sfx_pack_vol_1.7z'
    subprocess.run(['curl.exe', '--noproxy', '*', '-fLsS', '--retry', '2', '--max-time', '90',
                    ARCHIVE_URL, '-o', str(archive)], check=True)
    subprocess.run(['curl.exe', '--noproxy', '*', '-fLsS', '--max-time', '30', SOURCE_PAGE,
                    '-o', str(folder/'author-page.html')], check=True)
    text = (folder/'author-page.html').read_text(encoding='utf8')
    if 'CC-BY 4.0' not in text or 'Credit: JC Sounds' not in text:
        raise ValueError('Author attribution/license missing')
    with py7zr.SevenZipFile(archive) as z:
        z.extractall(folder/'JC Sounds')
    license_text = ('Fantasy SFX Pack Vol 1 — JC Sounds\nCC BY 4.0 — Credit: JC Sounds\n'
       + SOURCE_PAGE + '\nhttps://creativecommons.org/licenses/by/4.0/\n'
       + 'Modifications for Kingdom Watch: excerpt selection, mono conversion, gentle EQ, fades and level matching.\n'
       + 'No author endorsement is implied. Original archive and author-page snapshot are retained.\n')
    (folder/'JC-Sounds-CC-BY-4.0.txt').write_text(license_text, encoding='utf8')
    write('source-pack.json', dict(author='JC Sounds', title='Fantasy SFX Pack Vol 1', url=SOURCE_PAGE,
          download=ARCHIVE_URL, license='CC-BY-4.0', licenseURL='https://creativecommons.org/licenses/by/4.0/',
          archiveSHA256=p.sha(archive), archiveBytes=archive.stat().st_size,
          downloadedFromAuthorDistribution=True, audioAuditioned=False))
    print('Author distribution and license snapshot saved', archive.stat().st_size)

def spell_file(name):
    return HERE/'sources/JC Sounds/Fantasy SFX Pack Vol 1'/(PREFIX+name+'.wav')

def render_one(name, cue, label, source, start, seconds, rms, low=9500, shelf=4200, shelf_db=-4,
               attack=.008, release=.05, author='JC Sounds'):
    filters = f'highpass=f=65:p=2,highshelf=f={shelf}:g={shelf_db},lowpass=f={low}:p=2'
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(source), '-af', filters,
            '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'])
    data = np.frombuffer(raw, '<f4').astype(np.float64)
    data = data[round(start*SR):round((start+seconds)*SR)].copy()
    if len(data) < round(seconds*SR)-2:
        raise ValueError('Source shorter than planned excerpt '+name)
    data = p.fade(data[:,None], attack, release)[:,0]
    data *= 10**(rms/20)/max(p.energy(data), 1e-12)
    ceiling = -10 if seconds < .4 else -8
    data *= min(1, 10**(ceiling/20)/max(abs(data)))
    pcm = np.round(data*32767).astype('<i2')
    out = DEST/(name+'.wav')
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    p.meta(out, True)
    MANIFEST.append(dict(file=out.name, cue=cue, label=label, seconds=len(data)/SR,
        bytes=out.stat().st_size, sha256=p.sha(out),
        peakDBFS=round(float(20*np.log10(max(abs(data)))),2),
        activeRMSDBFS=round(float(20*np.log10(p.energy(data))),2),
        clippedSamples=int(np.count_nonzero(abs(pcm.astype(np.int32))>=32767)),
        layers=[dict(path=source.relative_to(ROOT).as_posix(), sha256=p.sha(source), author=author,
            start=start, seconds=seconds, filters=filters, attack=attack, release=release,
            rate=1, layered=False)], firstSample=int(pcm[0]), lastSample=int(pcm[-1])))
    print(name, len(data)/SR, MANIFEST[-1]['activeRMSDBFS'], flush=True)

def render():
    DEST.mkdir(parents=True, exist_ok=True); p.meta(DEST)
    # One prepared elemental source per cue, with no instruments, extra hits or pitch stacking.
    families = [
        ('fire','火焰','Fireball Launch',.30,.28,'Fireball Impact',8500,4200,-3,-26.2),
        ('thunder','雷电','Electric Spell_Launch',.20,.25,'Electric Spell_Hit',6500,3000,-6,-27),
        ('frost','冰霜','Ice Shard Projectile_Launch',.14,.30,'Ice Shard  Projectile_Impact',8000,4000,-5,-26.5),
    ]
    for key, label, launch, start, seconds, impact, low, shelf, shelf_db, rms in families:
        for i in range(1,4):
            render_one(f'{key}_{i}', key, label+'普攻', spell_file(f'{launch}_0{i}'),
                       start, seconds, rms, low, shelf, shelf_db, .012, .055)
        render_one(key+'_heavy',key+'Heavy',label+'重击',spell_file(impact+'_01'),
                   0,.34,-25.4,low,shelf,shelf_db,.005,.07)
        render_one(key+'_skill',key+'Skill',label+'技能',spell_file(launch+'_02'),
                   max(.04,start-.1),.48,-25,low,shelf,shelf_db,.012,.08)
        render_one(key+'_ult',key+'Ult',label+'大招',spell_file(launch+'_01'),
                   0,.78,-23.8,low,shelf,shelf_db,.015,.13)
    # A single dry body hit. Existing Sonniss source and license are retained in the repository.
    hit = p.ROOT/p.SOURCE['hit2']['path']
    raw = p.decode('hit2',70,8000).mean(axis=1)
    energies = np.array([np.mean(raw[i:i+220]**2) for i in range(0,len(raw),220)])
    start = max(0, int(np.flatnonzero(energies>energies.max()*.075)[0])*220/SR-.003)
    render_one('hit_common','hit','普通伤害通用受击',hit,start,.13,-28,6000,3500,-4,.003,.045,'NoizBoy')
    write('manifest.json',dict(version='v26',files=MANIFEST,mageFiles=18,commonHitFiles=1,
          bytes=sum(r['bytes'] for r in MANIFEST),audioAuditioned=False,
          design='One source per cue; original speed; no instruments, synthetic notes, extra layers or reverb'))

def stage():
    prior = Path(json.loads((ROOT/'docs/audio-mages-ui-v25/deployment-stage.json').read_text(encoding='utf8'))['stage'])
    build = ROOT/'build/web-mobile'
    release = json.loads((build/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']: raise ValueError('Production build required')
    target = ROOT/'build'/('publish-audio-spells-v26-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(build,target,ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior/'previews',target/'previews')
    previous = [f for f in (prior/'previews').rglob('*') if f.is_file()]
    for f in previous:
        if p.sha(f)!=p.sha(target/'previews'/f.relative_to(prior/'previews')):
            raise ValueError('Historical preview changed')
    shutil.copytree(HERE/'preview',target/'previews/audio-spells-v26')
    version = re.search(r'\?v=(\d+)',release['entry']).group(1)
    write('deployment-stage.json',dict(stage=str(target),priorPublishedStage=str(prior),entryVersion=version,
          project='kingdom-watch',branch='main',published=False,
          game='https://kingdom-watch.pages.dev/?v=audio-spells-v26-'+version,
          preview='https://kingdom-watch.pages.dev/previews/audio-spells-v26/',
          priorPreviewFilesPreserved=len(previous),manualAcceptance='Pending user; no game/browser/audio playback performed'))
    for name in ['build-record.json','web-release.json']: shutil.copy2(build/name,HERE/name)
    print('Release staged',target)

if __name__=='__main__':
    {'snapshot':snapshot,'fetch':fetch,'render':render,'stage':stage}[sys.argv[1]]()
