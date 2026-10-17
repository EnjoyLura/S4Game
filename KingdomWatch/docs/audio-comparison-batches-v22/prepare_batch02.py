"""Prepare three selected replacement purposes with three new options each."""
from pathlib import Path
import hashlib
import json
import subprocess
import wave

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PAGE = HERE / 'preview' / 'growth-r1'
RAW = HERE / 'sources' / 'recheck-d01-d03'
SR = 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
REV = 'growth-r1'

CUES = [
    dict(id='D01', name='升级成功', purpose='单次升级：英雄、武器、技能、装备等', old='growth',
         options=[
             dict(key='A', source='rpg-sound-package-files/soundpack/spells/levelup.wav',
                  filename='RPG升级乐句', author='Tuomo Untinen / Reemax', license='CC-BY-3.0',
                  url='https://opengameart.org/content/rpg-sound-package'),
             dict(key='B', source='spring-v1.ogg', filename='Power-Up 升级音', author='Julie Damsgaard / Spring Spring',
                  license='CC0-1.0', url='https://opengameart.org/content/power-up-sound-effects'),
             dict(key='C', source='newthingget.ogg', filename='New thing get', author='congusbongus',
                  license='CC0-1.0', url='https://opengameart.org/content/new-thing-get'),
         ]),
    dict(id='D02', name='长按连续升级', purpose='连续升级时的短提示音', old='growth_tick',
         options=[
             dict(key='A', source='m1chiboi-ui-files/ui click 1 [2018-10-13 162315].wav',
                  filename='UI click 1', author='m1chiboi', license='CC0-1.0',
                  url='https://opengameart.org/content/ui-soundpack-by-m1chiboi-bleeps-and-clicks'),
             dict(key='B', source='robin-ui-files/ui_ogg/click_1.ogg', filename='UI click 1', author='Robin Lamb',
                  license='CC0-1.0', url='https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications'),
             dict(key='C', source='ezduzz-click-1.mp3', filename='Sci-fi UI click 1', author='EZduzziteh',
                  license='CC0-1.0', url='https://opengameart.org/content/ui-click-sounds-sci-fi'),
         ]),
    dict(id='D03', name='升级数字落点', purpose='数字滚动结束时的短落点音', old='growth_land',
         options=[
             dict(key='A', source='m1chiboi-ui-files/ui bleep 1 [2018-10-13 162310].wav',
                  filename='UI bleep 1', author='m1chiboi', license='CC0-1.0',
                  url='https://opengameart.org/content/ui-soundpack-by-m1chiboi-bleeps-and-clicks'),
             dict(key='B', source='robin-ui-files/ui_ogg/Ding.ogg', filename='Ding', author='Robin Lamb',
                  license='CC0-1.0', url='https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications'),
             dict(key='C', source='ezduzz-click-4.mp3', filename='Sci-fi UI click 4', author='EZduzziteh',
                  license='CC0-1.0', url='https://opengameart.org/content/ui-click-sounds-sci-fi'),
         ]),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path, trim):
    filters = f'aresample={SR}'
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-af', filters,
                                   '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'])
    a = np.frombuffer(raw, '<f4').astype(np.float64)
    if not len(a) or not np.isfinite(a).all():
        raise ValueError(f'Invalid audio: {path}')
    if trim:
        peak = np.max(np.abs(a))
        active = np.flatnonzero(np.abs(a) > max(peak * .001, .000005))
        if not len(active):
            raise ValueError(f'Silent sound: {path}')
        a = a[max(0, active[0] - round(.003 * SR)):min(len(a), active[-1] + round(.045 * SR))]
        a -= a.mean()
        n = min(round(.002 * SR), len(a) // 5)
        if n:
            a[:n] *= np.sin(np.linspace(0, np.pi / 2, n)) ** 2
            a[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return a


def active_rms(a):
    windows = np.array([np.mean(a[i:i + 882] ** 2) for i in range(0, len(a), 882)])
    active = windows >= max(float(windows.max()) * .01, 1e-12)
    return float(np.sqrt(np.mean(windows[active])))


def write_pcm(path, a, scale):
    a *= scale
    if np.max(np.abs(a)) >= 1:
        raise ValueError(f'Clipping risk in {path.name}')
    pcm = np.round(a * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(SR); out.writeframes(pcm.tobytes())
    return dict(sha256=sha(path), seconds=round(len(a) / SR, 4),
                peakDBFS=round(20 * np.log10(max(float(np.max(np.abs(a))), 1e-12)), 3),
                activeRMSDBFS=round(20 * np.log10(max(active_rms(a), 1e-12)), 3),
                clippedSamples=int(np.count_nonzero(np.abs(pcm.astype('i4')) >= 32767)),
                firstSample=int(pcm[0]), lastSample=int(pcm[-1]))


def main():
    audio_dir = PAGE / 'audio'
    audio_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    checks = {}
    for cue in CUES:
        original = ROOT / 'assets/resources/audio/v21' / (cue['old'] + '.wav')
        old = decode(original, trim=False)
        old_rms = active_rms(old)
        candidates = []
        for option in cue['options']:
            path = RAW / option['source']
            new = decode(path, trim=True)
            candidates.append((option, path, new))
        # Keep pair comparisons close in perceived level with a single scalar
        # gain shared by the old sample and all three candidate sources.
        ceiling = 10 ** (-3 / 20)
        safe = [old_rms * ceiling / np.max(np.abs(old))]
        safe.extend(active_rms(new) * ceiling / np.max(np.abs(new)) for _, _, new in candidates)
        target = min(10 ** (-22 / 20), *safe)
        old_name = cue['id'] + '-old.wav'
        old_info = write_pcm(audio_dir / old_name, old, target / old_rms)
        opts = []
        checks[str(original.relative_to(ROOT))] = sha(original)
        for option, path, new in candidates:
            key = option['key']
            name = f"{cue['id']}-{key}.wav"
            new_info = write_pcm(audio_dir / name, new, target / active_rms(new))
            checks[str(path.relative_to(HERE))] = sha(path)
            opts.append(dict(key=key, label=f'候选 {key}', author=option['author'],
                             license=option['license'], licenseURL='https://creativecommons.org/licenses/by/3.0/'
                                if option['license'] == 'CC-BY-3.0' else 'https://creativecommons.org/publicdomain/zero/1.0/',
                             sourceURL=option['url'], sourceFile=option['filename'],
                             edit='只做格式统一、去近静音、2ms 首尾淡变与响度匹配；不重作、不加效果、不压缩。',
                             audio=dict(file='audio/' + name, **new_info)))
        infos = [old_info] + [o['audio'] for o in opts]
        if max(i['clippedSamples'] for i in infos) or max(i['peakDBFS'] for i in infos) >= -2.99:
            raise ValueError('Peak/clipping safety check failed')
        spread = max(i['activeRMSDBFS'] for i in infos) - min(i['activeRMSDBFS'] for i in infos)
        if spread > .08:
            raise ValueError(f'Loudness comparison spread too high: {cue["id"]} {spread}')
        if len({i['sha256'] for i in infos}) != len(infos):
            raise ValueError(f'Duplicate audio content: {cue["id"]}')
        rows.append(dict(id=cue['id'], name=cue['name'], purpose=cue['purpose'],
                         old=dict(label='旧版 · 当前 v21', source=str(original.relative_to(ROOT)),
                                  audio=dict(file='audio/' + old_name, **old_info)),
                         options=opts))
    data = dict(revision=REV, title='第 2 批 · 重选升级反馈', baseline='当前正式游戏 v21',
                items=rows, currentBatchCount=3, auditionedByAgent=False, gameReplaced=False)
    (PAGE / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    (HERE / 'growth-source-hashes.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
    (HERE / 'growth-report.json').write_text(json.dumps(dict(
        purposes=len(rows), candidateClips=sum(len(r['options']) for r in rows),
        matchedRMSSpreadDB=max(max(x['activeRMSDBFS'] for x in [r['old']['audio']]+[o['audio'] for o in r['options']]) -
                               min(x['activeRMSDBFS'] for x in [r['old']['audio']]+[o['audio'] for o in r['options']]) for r in rows),
        maxPeakDBFS=max(x['peakDBFS'] for r in rows for x in [r['old']['audio']]+[o['audio'] for o in r['options']]),
        clippedSamples=sum(x['clippedSamples'] for r in rows for x in [r['old']['audio']]+[o['audio'] for o in r['options']]),
        checkedHashes=len(checks), playedAudio=False, ranBrowser=False, gameReplaced=False), indent=2), encoding='utf-8')
    print(json.dumps(json.loads((HERE / 'growth-report.json').read_text(encoding='utf-8'))))


if __name__ == '__main__':
    main()
