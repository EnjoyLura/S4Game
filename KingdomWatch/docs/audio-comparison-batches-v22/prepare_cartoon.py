"""Package free casual/cartoon growth candidates; offline conversion, no playback."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import wave

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = HERE / 'sources/cartoon-r1'
PAGE = HERE / 'preview/cartoon-r1'
SR = 44100
REV = 'cartoon-r1'
FF = imageio_ffmpeg.get_ffmpeg_exe()
TIM = 'Tim-Beek/WAV Casual SoundFX by Tim Beek/'
DUST = 'DM-CGS/WAV/'
SOURCES = {
    'tim': dict(author='Tim Beek', pack='Casual SoundFX Pack',
                sourceURL='https://timbeek.itch.io/casual-soundfx-pack',
                license='CC-BY-4.0', licenseURL='https://creativecommons.org/licenses/by/4.0/',
                credit='Audio by timbeek.com', creditURL='https://timbeek.com/'),
    'dust': dict(author='Dustyroom', pack='Free Casual Game Sounds',
                 sourceURL='https://dustyroom.com/free-casual-game-sounds/',
                 license='CC0-1.0', licenseURL='https://creativecommons.org/publicdomain/zero/1.0/',
                 credit='Sound effects by Dustyroom', creditURL='https://dustyroom.com/'),
}
CUES = [
    dict(id='D01', name='升级成功', old='growth',
         purpose='单次升级的正向反馈。两条保留完整乐句和尾音，不用于每次连升。',
         options=[('A', 'tim', TIM + 'Positive Holy1.wav'),
                  ('B', 'tim', TIM + 'Positive Holy2.wav')]),
    dict(id='D02', name='长按连续升级', old='growth_tick',
         purpose='短反馈。可先听单次，再听每 240ms 一次的五连升示例。',
         options=[('A', 'dust', DUST + 'DM-CGS-21.wav'),
                  ('B', 'dust', DUST + 'DM-CGS-32.wav')]),
    dict(id='D03', name='升级数字落点', old='growth_land',
         purpose='数值停止滚动时的一次短确认；与升级乐句分开选择。',
         options=[('A', 'dust', DUST + 'DM-CGS-07.wav'),
                  ('B', 'dust', DUST + 'DM-CGS-41.wav')]),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path, trim):
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-f', 'f32le',
                                   '-ac', '2', '-ar', str(SR), '-'])
    a = np.frombuffer(raw, '<f4').astype(np.float64).reshape(-1, 2)
    if not len(a) or not np.isfinite(a).all():
        raise ValueError(f'Invalid source: {path}')
    if trim:
        active = np.flatnonzero(np.max(np.abs(a), axis=1) > max(np.max(np.abs(a)) * .001, .000005))
        if not len(active):
            raise ValueError(f'Silent source: {path}')
        a = a[max(0, active[0] - round(.003 * SR)):min(len(a), active[-1] + round(.045 * SR))]
        a -= a.mean(axis=0)
        n = min(round(.002 * SR), len(a) // 5)
        if n:
            a[:n] *= (np.sin(np.linspace(0, np.pi / 2, n)) ** 2)[:, None]
            a[-n:] *= (np.cos(np.linspace(0, np.pi / 2, n)) ** 2)[:, None]
    return a


def rms(a):
    powers = np.array([np.mean(a[i:i + 882] ** 2) for i in range(0, len(a), 882)])
    return float(np.sqrt(np.mean(powers[powers >= max(float(powers.max()) * .01, 1e-12)])))


def write(path, a):
    peak = float(np.max(np.abs(a)))
    if peak >= 1:
        raise ValueError(f'Clipping: {path}')
    pcm = np.round(a * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return dict(file='audio/' + path.name, sha256=sha(path), seconds=round(len(a) / SR, 4),
                channels=2, sampleRate=SR, bits=16,
                peakDBFS=round(20 * np.log10(max(peak, 1e-12)), 3),
                activeRMSDBFS=round(20 * np.log10(max(rms(a), 1e-12)), 3),
                clippedSamples=int(np.count_nonzero(np.abs(pcm.astype('i4')) >= 32767)))


def main():
    audio_dir = PAGE / 'audio'
    audio_dir.mkdir(parents=True, exist_ok=True)
    rows, hashes = [], {}
    for cue in CUES:
        original = ROOT / 'assets/resources/audio/v21' / (cue['old'] + '.wav')
        variants = [('old', original, decode(original, False), None)]
        for key, source, filename in cue['options']:
            path = RAW / filename
            variants.append((key, path, decode(path, True), source))
        # Scalar gain only, common reference level and peak headroom for each comparison.
        ceiling = 10 ** (-3 / 20)
        target = min(10 ** (-21 / 20), *(rms(a) * ceiling / np.max(np.abs(a))
                                        for _, _, a, _ in variants))
        old, options, examples = None, [], []
        for key, path, a, source in variants:
            a = a * (target / rms(a))
            info = write(audio_dir / (cue['id'] + '-' + key + '.wav'), a)
            hashes[str(path.relative_to(ROOT) if key == 'old' else path.relative_to(HERE))] = sha(path)
            if key == 'old':
                old = dict(label='旧版 · 当前 v21', source=str(path.relative_to(ROOT)), audio=info)
            else:
                options.append(dict(key=key, label='候选 ' + key, **SOURCES[source],
                                    sourceFile=path.name,
                                    edit='保留立体声与原音色；去近静音、2ms 边缘淡变和标量增益匹配。无变调、变速、叠加、EQ或压缩。',
                                    audio=info))
            if cue['id'] == 'D02':
                step, count = round(.240 * SR), 5
                demo = np.zeros((step * (count - 1) + len(a), 2))
                for i in range(count):
                    demo[i * step:i * step + len(a)] += a
                # Same safety gain across all three demos; do not alter comparative levels.
                if np.max(np.abs(demo)) > ceiling + 1e-6:
                    raise ValueError('Unexpected tick overlap peak')
                examples.append(dict(key=key, label='五连升 · ' + ('旧版' if key == 'old' else key),
                                     count=count, intervalMS=240,
                                     audio=write(audio_dir / (cue['id'] + '-' + key + '-repeat.wav'), demo)))
        rows.append(dict(id=cue['id'], name=cue['name'], purpose=cue['purpose'],
                         old=old, options=options, examples=examples))
    data = dict(revision=REV, title='免费卡通风 · 成长音效', baseline='当前正式游戏 v21',
                items=rows, currentBatchCount=3, candidateCount=6,
                auditionedByAgent=False, gameReplaced=False,
                selectionBasis='Source author descriptions and offline duration/signal inspection; user listening pending.')
    (PAGE / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    licenses = PAGE / 'licenses'
    licenses.mkdir(exist_ok=True)
    for source, dest in [('DM-CGS/license.pdf', 'Dustyroom-CC0.pdf'),
                         ('Tim-Beek-Casual-SoundFX-CC-License.pdf', 'Tim-Beek-CC-BY-4.0.pdf')]:
        shutil.copyfile(RAW / source, licenses / dest)
    for filename in ['Dustyroom-Free-Casual-Game-Sounds.zip', 'dustyroom-official-page.html',
                     'Tim-Beek-Casual-SoundFX-WAV.zip', 'timbeek-page.html',
                     'DM-CGS/license.pdf', 'Tim-Beek-Casual-SoundFX-CC-License.pdf']:
        hashes[str((RAW / filename).relative_to(HERE))] = sha(RAW / filename)
    (HERE / 'cartoon-source-hashes.json').write_text(json.dumps(hashes, ensure_ascii=False, indent=2), encoding='utf-8')
    clips = [r['old']['audio'] for r in rows] + [o['audio'] for r in rows for o in r['options']]
    examples = [e['audio'] for r in rows for e in r['examples']]
    spreads = [max(a['activeRMSDBFS'] for a in [r['old']['audio']] + [o['audio'] for o in r['options']]) -
               min(a['activeRMSDBFS'] for a in [r['old']['audio']] + [o['audio'] for o in r['options']]) for r in rows]
    if max(spreads) > .08 or any(x['clippedSamples'] for x in clips + examples):
        raise ValueError('Offline signal inspection failed')
    if len({o['audio']['sha256'] for r in rows for o in r['options']}) != 6:
        raise ValueError('Duplicate candidates')
    report = dict(revision=REV, purposes=3, candidateClips=6, oldClips=3, repeatExamples=3,
                  sources=2, cost=0, channels=2, maxMatchedRMSSpreadDB=round(max(spreads), 3),
                  maxPeakDBFS=max(a['peakDBFS'] for a in clips + examples),
                  clippedSamples=sum(a['clippedSamples'] for a in clips + examples),
                  sourceHashes=len(hashes), audioBytes=sum(p.stat().st_size for p in audio_dir.glob('*.wav')),
                  playedAudio=False, ranBrowser=False, gameReplaced=False, userAcceptance='pending')
    (HERE / 'cartoon-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
