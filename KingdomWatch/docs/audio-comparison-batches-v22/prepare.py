"""Prepare a preview-only batch. Never plays audio or imports it into the game."""
from pathlib import Path
import hashlib
import json
import subprocess
import wave

import imageio_ffmpeg
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PAGE = HERE / 'preview'
SOURCE = HERE / 'sources'
SR = 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
REVISION = 'batch-01-r1'

# Stable IDs are the user-facing purposes, not necessarily unique runtime files.
BATCHES = [
    ('奖励与成长', ['C01', 'C03', 'C04', 'D01', 'D02', 'D03', 'D04', 'D05']),
    ('胜败与奖励落点', ['C02', 'C05', 'C06', 'C07', 'C08']),
    ('三选一', ['B01', 'B02', 'B03', 'B04']),
    ('界面操作', [f'A{i:02}' for i in range(1, 9)]),
    ('艾拉 · 弓箭', [f'F{i:02}' for i in range(1, 6)]),
    ('凯尔 · 重弩', [f'F{i:02}' for i in range(6, 11)]),
    ('焰辉 · 火焰', [f'F{i:02}' for i in range(11, 16)]),
    ('沃尔 · 雷电', [f'F{i:02}' for i in range(16, 21)]),
    ('莫拉 · 冰霜', [f'F{i:02}' for i in range(21, 26)]),
    ('战斗提示与战利品', ['C09', 'C10', 'E01', 'E02', 'E03', 'E04']),
    ('击杀反馈', [f'G{i:02}' for i in range(1, 6)]),
]
RECIPES = {
    'C01': ('reward', 'virix-jingles/Item2A.wav', 1, '奖励揭晓时播放'),
    'C03': ('purchase', 'virix-ui-1/Menu FX example/Item1B.wav', 1, '购买商品成功时播放'),
    'C04': ('recruit', 'virix-ui-2/Jingle 011.wav', 1, '新英雄登场时播放'),
    'D01': ('growth', 'virix-ui-2/Notification 2.wav', 1, '单次升级成功时播放；英雄、武器等共用'),
    'D02': ('growth_tick', 'virix-ui-2/Menu Select 1.wav', 1, '长按连续升级时的短反馈'),
    'D03': ('growth_land', 'virix-ui-1/Menu FX example/Menu1B.wav', 1, '升级数字落定时播放'),
    'D04': ('breakthrough', 'virix-ui-2/Jingle 026.wav', 1.25, '阶段突破时播放；候选保留完整乐句'),
    'D05': ('construction', 'virix-ui-1/Menu FX example/Item1A.wav', 1, '主城升级完成时播放'),
}
PACKS = {r['id']: r for r in json.loads((SOURCE / 'downloads.json').read_text(encoding='utf-8'))}
SOURCE_SHA = {}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path, tempo=1, trim=False):
    filters = f'aresample={SR}'
    if tempo != 1:
        filters += f',atempo={tempo}'
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-af', filters,
                                   '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'])
    a = np.frombuffer(raw, '<f4').astype(np.float64)
    if not len(a) or not np.isfinite(a).all():
        raise ValueError(f'Invalid audio: {path}')
    if trim:
        # Remove only near-silence before/after the authored phrase.
        threshold = max(np.max(np.abs(a)) * .001, .000005)
        active = np.flatnonzero(np.abs(a) > threshold)
        if not len(active):
            raise ValueError(f'Silent source: {path}')
        a = a[max(0, active[0] - 441):min(len(a), active[-1] + 4410)]
        a -= a.mean()
        edge = min(88, len(a) // 4)
        a[:edge] *= np.linspace(0, 1, edge)
        a[-edge:] *= np.linspace(1, 0, edge)
    return a


def active_rms(a):
    blocks = np.array([np.mean(a[i:i + 882] ** 2) for i in range(0, len(a), 882)])
    gate = max(blocks.max() * .01, 1e-12)
    return float(np.sqrt(np.mean(blocks[blocks >= gate])))


def db(value):
    return round(float(20 * np.log10(max(value, 1e-12))), 3)


def encode(path, a, gain):
    a = a * gain
    if np.max(np.abs(a)) >= 1:
        raise ValueError('Clipping prohibited')
    pcm = np.round(a * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(pcm.tobytes())
    return dict(seconds=round(len(a) / SR, 3), peakDBFS=db(np.max(np.abs(a))),
                activeRMSDBFS=db(active_rms(a)), wholeRMSDBFS=db(np.sqrt(np.mean(a * a))),
                gainDB=db(gain), clippedSamples=int(np.count_nonzero(np.abs(pcm.astype('i4')) >= 32767)),
                firstSample=int(pcm[0]), lastSample=int(pcm[-1]), sha256=sha(path))


def main():
    (PAGE / 'audio').mkdir(parents=True, exist_ok=True)
    checklist = json.loads((ROOT / 'docs/audio-replacement-list/音效用途映射.json').read_text(encoding='utf-8'))
    purposes = {p['id']: p for p in checklist['items']}
    ids = [i for _, group in BATCHES for i in group]
    if len(ids) != 61 or len(set(ids)) != 61 or set(ids) != set(purposes):
        raise ValueError('Batch plan must cover every purpose once')
    groups = []
    for number, (title, members) in enumerate(BATCHES, 1):
        groups.append(dict(number=number, title=title, ids=members,
                           status='ready' if number == 1 else 'pending'))
    rows = []
    for key, (old_name, source_name, tempo, purpose) in RECIPES.items():
        original = ROOT / f'assets/resources/audio/v21/{old_name}.wav'
        candidate = SOURCE / source_name
        SOURCE_SHA[str(original.relative_to(ROOT))] = sha(original)
        SOURCE_SHA[str(candidate.relative_to(ROOT))] = sha(candidate)
        old = decode(original)
        new = decode(candidate, tempo=tempo, trim=True)
        old_rms, new_rms = active_rms(old), active_rms(new)
        # Match active body energy per pair with scalar gain only. Do not limit,
        # compress, EQ or synthesize; keep timbre and transients for a fair choice.
        ceiling = 10 ** (-3 / 20)
        target = min(10 ** (-23 / 20),
                     old_rms * ceiling / np.max(np.abs(old)),
                     new_rms * ceiling / np.max(np.abs(new)))
        old_file, new_file = f'{key}-old.wav', f'{key}-new.wav'
        old_info = encode(PAGE / 'audio' / old_file, old, target / old_rms)
        new_info = encode(PAGE / 'audio' / new_file, new, target / new_rms)
        if abs(old_info['activeRMSDBFS'] - new_info['activeRMSDBFS']) > .05:
            raise ValueError('Pair loudness mismatch')
        if old_info['sha256'] == new_info['sha256']:
            raise ValueError('Candidate must differ from current cue')
        pack = PACKS[source_name.split('/')[0]]
        rows.append(dict(id=key, name=purposes[key]['name'], purpose=purpose,
                         cues=purposes[key]['cues'], note=purposes[key]['note'],
                         old=dict(file='audio/' + old_file, label='旧版 · 当前 v21',
                                  source=str(original.relative_to(ROOT)), sourceSHA256=sha(original), **old_info),
                         new=dict(file='audio/' + new_file, label='新候选 · A',
                                  source=source_name, sourceSHA256=sha(candidate),
                                  author='David McKee (ViRiX / VIRiX Dreamcore)',
                                  license='CC-BY-3.0', licenseURL='https://creativecommons.org/licenses/by/3.0/',
                                  sourceURL=pack['page'], tempo=tempo,
                                  edits='转为44.1kHz单声道16bit、仅去近静音、2ms边缘淡变、等活动段响度；'
                                        + ('原音高，完整乐句加速至1.25倍。' if tempo != 1 else '不改音高与节奏，不重新作曲。'),
                                  **new_info)))
    data = dict(revision=REVISION, title='第 1 批 · 奖励与成长', baseline='当前正式游戏 v21',
                readyCount=len(rows), totalCount=len(purposes), batches=groups, items=rows,
                inventory=[dict(id=i, name=purposes[i]['name'],
                                batch=next(g['number'] for g in groups if i in g['ids']),
                                status='ready' if i in RECIPES else 'pending') for i in ids],
                auditionedByAgent=False, gameReplaced=False)
    (PAGE / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    (HERE / 'source-hashes.json').write_text(json.dumps(SOURCE_SHA, indent=2), encoding='utf-8')
    (HERE / 'batch-plan.json').write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding='utf-8')
    credits = '''Some of the sounds and/or music was created by David McKee (VIRiX Dreamcore).
Some of the sounds in this project were created by ViRiX Dreamcore (David McKee), https://soundcloud.com/virix

New candidates: CC BY 3.0. https://creativecommons.org/licenses/by/3.0/
The source author also offers CC BY 4.0 for UI SFX Pack 2 Sample. This preview elects CC BY 3.0.
Source pages:
https://opengameart.org/content/ui-sfx-pack-2-sample
https://opengameart.org/content/ui-and-item-sound-effect-jingles-sample-2
https://opengameart.org/content/ui-and-item-sounds-sample-1
Changes: mono 44.1kHz 16bit transcode, near-silence trim, 2ms edge fades, scalar active-body loudness matching.
D04 only: pitch-preserving 1.25x tempo of the complete source phrase. No generated melodies, EQ or limiting.

Current v21 baseline credits: ../../audio-credits.html
Little Robot Sound Factory, Fantasy Sound Effects Library, CC BY 3.0:
https://opengameart.org/content/fantasy-sound-effects-library
https://www.littlerobotsoundfactory.com/
Kenney, Music Jingles / RPG Audio / Interface Sounds / Impact Sounds, CC0:
https://kenney.nl/assets/music-jingles
https://kenney.nl/assets/rpg-audio
https://kenney.nl/assets/interface-sounds
https://kenney.nl/assets/impact-sounds
Other v21 sources and full editing recipes: repository docs/audio-overhaul-v21/assets.json and CREDITS.txt.
The original v21 mixes have only scalar loudness matching in this preview. The production game is unchanged.
No creator endorses this project. All candidates await user listening and selection.
'''
    (PAGE / 'CREDITS.txt').write_text(credits, encoding='utf-8')
    report = dict(pairs=len(rows), distinctNewHashes=len({i['new']['sha256'] for i in rows}),
                  totalPurposes=len(ids), duplicatePurposes=0,
                  maxLoudnessDifferenceDB=max(abs(i['old']['activeRMSDBFS'] - i['new']['activeRMSDBFS']) for i in rows),
                  maxPeakDBFS=max(i[s]['peakDBFS'] for i in rows for s in ['old', 'new']),
                  clippedSamples=sum(i[s]['clippedSamples'] for i in rows for s in ['old', 'new']),
                  candidateSeconds=round(sum(i['new']['seconds'] for i in rows), 3),
                  playedAudio=False, ranBrowser=False, replacedGame=False)
    (HERE / 'offline-audio-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
