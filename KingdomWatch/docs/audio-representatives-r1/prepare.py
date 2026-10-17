"""Seven contextual audio sketches. Offline rendering only: never plays media."""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import math
import subprocess
import wave

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PAGE = HERE/'preview'
WORK = HERE/'renders'
SR = 44100
FPS = 24
W, H = 720, 450
FF = imageio_ffmpeg.get_ffmpeg_exe()
SOURCES = HERE/'sources'
UX = ROOT/'assets/resources/ux'
V = SOURCES/'VSCO2CE'
S = SOURCES/'Sonniss2015'
HASHES = {}
RECIPES = {}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


@lru_cache(maxsize=64)
def decode(path):
    path = Path(path)
    HASHES[str(path.relative_to(ROOT))] = sha(path)
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-f', 'f32le',
                                   '-ac', '2', '-ar', str(SR), '-'])
    a = np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float64)
    if not len(a) or not np.isfinite(a).all():
        raise ValueError(f'Invalid audio: {path}')
    return a


def trim(a, tail=.06):
    peak = np.max(abs(a))
    active = np.flatnonzero(np.max(abs(a), axis=1) > max(peak*.002, 1e-7))
    if not len(active):
        raise ValueError('Silent audio')
    b = a[max(0, active[0]-round(.004*SR)):min(len(a), active[-1]+round(tail*SR))].copy()
    b -= b.mean(axis=0)
    return b


def edge(a, attack=.002, release=.06):
    b = a.copy()
    ni, no = min(round(attack*SR), len(b)//3), min(round(release*SR), len(b)//3)
    if ni:
        b[:ni] *= np.sin(np.linspace(0, math.pi/2, ni))[:, None]**2
    if no:
        b[-no:] *= np.cos(np.linspace(0, math.pi/2, no))[:, None]**2
    return b


def level(a, db=-21):
    return a * (10**(db/20)/max(active_rms(a), 1e-9))


def active_rms(a):
    p = np.array([np.mean(a[i:i+882]**2) for i in range(0, len(a), 882)])
    return float(np.sqrt(np.mean(p[p > max(p.max()*.01, 1e-12)])))


def put(out, a, at=0, gain=1, pan=0):
    start = round(at*SR)
    n = min(len(out)-start, len(a))
    if n > 0:
        b = a[:n].copy()*gain
        b[:, 0] *= min(1, 1-pan)
        b[:, 1] *= min(1, 1+pan)
        out[start:start+n] += b


INSTRUMENTS = {
    # Library note labels use differing octave conventions. Roots checked from recordings.
    'marimba': [(72, 'Percussion/Marimba/Marimba_hit_Outrigger_C4_loud_01.wav'),
                (79, 'Percussion/Marimba/Marimba_hit_Outrigger_G4_loud_01.wav')],
    'glock': [(84, 'Percussion/Glock/glock_medium_C5.wav'),
              (91, 'Percussion/Glock/glock_medium_G5.wav')],
    'harp': [(69, 'Strings/Harp/KSHarp_A4_mf.wav'), (72, 'Strings/Harp/KSHarp_C5_mf.wav'),
             (76, 'Strings/Harp/KSHarp_E5_mf.wav')],
    'trumpet': [(60, 'Brass/Trumpet/stac/Sum_SHTrumpet_stac_C3_v3_rr1.wav'),
                (67, 'Brass/Trumpet/stac/Sum_SHTrumpet_stac_G3_v3_rr1.wav'),
                (74, 'Brass/Trumpet/stac/Sum_SHTrumpet_stac_D4_v3_rr1.wav')],
    'trumpet-long': [(67, 'Brass/Trumpet/sus/Sum_SHTrumpet_sus_G3_v3_rr1.wav')],
    'horn': [(60, 'Brass/F Horn/sus/MOHorn_sus_C3_v2_1.wav')],
    'bassoon': [(60, 'Woodwinds/Bassoon/stac/PSBassoon_C3_v1_rr1.wav'),
                (55, 'Woodwinds/Bassoon/stac/PSBassoon_G2_v1_rr1.wav')],
}


def note(instrument, midi, duration, velocity=1):
    base, rel = min(INSTRUMENTS[instrument], key=lambda v: abs(v[0]-midi))
    a = trim(decode(str(V/rel)))
    ratio = 2**((midi-base)/12)
    x = np.arange(0, len(a)-1, ratio)
    b = np.column_stack([np.interp(x, np.arange(len(a)), a[:, k]) for k in [0, 1]])
    b = b[:round(duration*SR)]
    # Original room sound stays; no synthetic oscillators or added delay/reverb.
    return edge(level(b, -24), .002, min(.12, duration*.25))*velocity


def melody(out, instrument, events, pan=0):
    for at, midi, dur, vel in events:
        put(out, note(instrument, midi, dur, vel), at, pan=pan)


def fx(rel, duration=None, db=-23):
    a = trim(decode(str(S/rel)))
    if duration:
        a = a[:round(duration*SR)]
    return edge(level(a, db), release=.04)


def sketches():
    results = {}
    def new():
        return np.zeros((round(3.7*SR), 2))
    hit = fx('NoizBoy - Hong Kong Action Kit - Hit Kit #1/Seq 2.1 Hit #1 96 HK1.wav', .26, -24)
    whoosh = fx('NoizBoy - Hong Kong Action Kit - Hit Kit #1/Seq 2.1 whoosh #1 96 HK1.wav', .23, -24)
    arrow = fx('Membrans - Cartoon Arrow Sound Pack 01/Cartoon Arrow 09.wav', .65, -24)
    ice = fx('Membrans - Ice Cold Sound Pack 01/Ice Cube In The Glass 09.wav', .75, -23)
    a = new()
    for at, vol in [(0, .90), (1.02, 1), (2.04, .95)]:
        put(a, arrow, at, .52)
        put(a, whoosh, at+.02, .75)
        put(a, hit, at+.24, vol)
    results['R01'] = a
    RECIPES['R01'] = dict(events='Three bow releases at 0,1.02,2.04; material impact at +0.24s',
                          design='Sonniss Membrans cartoon arrow / NoizBoy whoosh and short impact')
    a = new()
    put(a, whoosh[::-1].copy(), 0, .35)
    melody(a, 'harp', [(0, 84, .34, .3), (.05, 79, .4, .35), (.10, 76, .6, .3)])
    put(a, ice, .24)
    melody(a, 'glock', [(.25, 84, .75, .24), (.30, 91, .65, .12)])
    results['R02'] = a
    RECIPES['R02'] = dict(events='Short pull then ice crystal impact at 0.24s',
                          design='Recorded glass/ice transient, harp pull, quiet glock tail')
    a = new()
    for i in range(3):
        put(a, whoosh, .085*i, .16, -.25+.25*i)
    melody(a, 'marimba', [(0, 72, .18, .55), (.085, 76, .18, .55), (.17, 79, .25, .6),
                           (.97, 79, .28, .72), (1.04, 84, .60, .9)])
    melody(a, 'harp', [(1.04, 84, .75, .4)])
    results['R03'] = a
    RECIPES['R03'] = dict(events='Three cards reveal at 0,.085,.17s; choose at 1.04s',
                          design='Marimba and harp, dry card-sized whoosh')
    a = new()
    melody(a, 'marimba', [(0, 72, .25, .75), (.11, 76, .28, .85), (.23, 79, .35, .9),
                           (.39, 84, .95, 1)])
    melody(a, 'harp', [(.23, 79, .55, .32), (.39, 84, 1.0, .42)])
    melody(a, 'horn', [(.39, 60, .8, .25), (.39, 67, .8, .16)])
    results['R04'] = a
    RECIPES['R04'] = dict(events='Rise at 0,.11,.23s; new numeric value lands at .39s',
                          design='Original C major phrase: marimba, harp and soft horn foundation')
    a = new()
    melody(a, 'harp', [(0, 72, .9, .65), (.07, 76, .9, .75), (.14, 79, 1, .8),
                       (.21, 84, 1.3, .9), (.28, 88, 1.1, .75)])
    melody(a, 'glock', [(.3, 84, 1.3, .32), (.3, 91, 1, .16)])
    bell = edge(level(trim(decode(str(V/'Percussion/BellTree_Stroke1_v1_Sum.wav'))), -29)[:SR], release=.18)
    put(a, bell, .15, .3)
    results['R05'] = a
    RECIPES['R05'] = dict(events='Reward reveal at 0; item and quantity land at .3s',
                          design='Original harp flourish, small glock chord and sparse bell tree')
    a = new()
    melody(a, 'trumpet', [(0, 67, .19, .7), (.19, 67, .17, .8), (.38, 72, .23, .9),
                          (.63, 76, .23, .9)])
    melody(a, 'trumpet-long', [(.91, 72, 1.35, .85), (.91, 76, 1.35, .50)])
    melody(a, 'horn', [(.91, 48, 1.5, .5), (.91, 55, 1.5, .3), (.91, 60, 1.5, .28)])
    melody(a, 'harp', [(.91, 72, 1.6, .32), (1, 79, 1.4, .3), (1.1, 84, 1.3, .3)])
    timp = edge(level(trim(decode(str(V/'Percussion/Timpani/Timpani2_Hit_v3_rr1_Sum.wav'))), -26)[:round(1.5*SR)], release=.2)
    cymb = edge(level(trim(decode(str(V/'Percussion/cymbal-crashshort_v1.wav'))), -29), release=.15)
    put(a, timp, .91, .4)
    put(a, cymb, .91, .45)
    results['R06'] = a
    RECIPES['R06'] = dict(events='Fanfare pickups 0,.19,.38,.63s; crown and chord at .91s',
                          design='Original trumpet fanfare, horn C major cadence, timpani and soft cymbal')
    a = new()
    melody(a, 'bassoon', [(0, 60, .3, .7), (.27, 58, .32, .75), (.59, 56, .33, .8),
                          (.95, 55, .65, .7)])
    melody(a, 'harp', [(.95, 60, 1.4, .3), (.98, 63, 1.35, .26), (1.02, 67, 1.3, .25)])
    results['R07'] = a
    RECIPES['R07'] = dict(events='Falling bassoon phrase then quiet minor landing at .95s',
                          design='Original restrained minor woodwind cue; no comic fail horn')
    return results


CASES = [
    ('R01', '弓箭普攻与命中', '听弓弦、掠过和命中的分层，以及连续三次是否疲劳。', 4,
     [(0, 'bow_1', .8), (.24, 'hit_1', 1), (1.02, 'bow_2', .8), (1.26, 'hit_2', 1),
      (2.04, 'bow_3', .8), (2.28, 'hit_3', 1)]),
    ('R02', '寒冰法术', '听施法到命中是否干净，冰晶的材质是否合适。', 4,
     [(0, 'frost_1', .8), (.24, 'icebreak_1', 1)]),
    ('R03', '三选一出现与选中', '前半段三张卡出现，后半段选中落定。', 4,
     [(0, 'pick_open', 1), (1.04, 'pick_choose', 1)]),
    ('R04', '英雄升级', '听上升过程和最后落点，是否让数值增加更明确。', 4, [(0, 'growth', 1)]),
    ('R05', '获得奖励', '听揭晓和收获感，是否明亮又不刺耳。', 4, [(0, 'reward', 1)]),
    ('R06', '关卡胜利', '听短号角的庆祝感，是否符合王国的轻奇幻风格。', 5, [(0, 'victory', 1)]),
    ('R07', '关卡失败', '听情绪收束，是否愿意立刻再挑战。', 4, [(0, 'defeat', 1)]),
]
GOLD = (245, 200, 98)
PAPER = (255, 246, 217)
GREEN = (168, 223, 133)


@lru_cache(maxsize=32)
def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', size)


def text(draw, xy, message, size, color=PAPER, anchor='mm'):
    draw.text(xy, message, font=font(size), fill=color, anchor=anchor,
              stroke_width=1 if size >= 28 else 0, stroke_fill=(22, 35, 43))


@lru_cache(maxsize=24)
def art(rel, size):
    p = ROOT/rel
    HASHES[str(p.relative_to(ROOT))] = sha(p)
    a = Image.open(p).convert('RGBA')
    a.thumbnail(size, Image.Resampling.LANCZOS)
    return a


def paste(im, asset, center, opacity=1):
    a = asset
    if opacity < 1:
        a = asset.copy()
        a.putalpha(a.getchannel('A').point(lambda x: int(x*max(0, opacity))))
    im.alpha_composite(a, (round(center[0]-a.width/2), round(center[1]-a.height/2)))


def render_frame(case, time, side):
    ident, title, prompt, length, events = case
    base_path = ROOT/'docs/battle-modal-art-concept-v18/assets/ground.png'
    HASHES[str(base_path.relative_to(ROOT))] = sha(base_path)
    im = ImageOps.fit(Image.open(base_path).convert('RGBA'), (W, H))
    shade = Image.new('RGBA', im.size, (10, 22, 29, 160))
    im = Image.alpha_composite(im, shade)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((18, 14, W-18, 66), 12, fill=(23, 40, 50, 235))
    text(d, (W/2, 39), title, 25)
    text(d, (38, H-22), 'v21 旧版' if side == 'old' else '代表声音 · r1', 16, GOLD, 'lm')
    text(d, (W-28, H-22), '配音分镜 · 非正式游戏画面', 13, (201, 203, 195), 'rm')
    t = time-.45
    if ident in ['R01', 'R02']:
        hero = art('assets/resources/ux/hero_comic_v1/comic_figure_archer_v2.png' if ident == 'R01'
                   else 'assets/resources/ux/hero_comic_v1/comic_figure_mora_v1.png', (165, 235))
        paste(im, hero, (145, 246))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((495, 152, 614, 304), 20, fill=(42, 57, 51), outline=(178, 183, 132), width=3)
        text(d, (555, 210), '靶标', 25)
        d.rounded_rectangle((506, 280, 605, 290), 5, fill=(28, 31, 30))
        for at in ([0, 1.02, 2.04] if ident == 'R01' else [0]):
            dt = t-at
            if 0 <= dt < .24:
                x = 215 + 335*dt/.24
                if ident == 'R01':
                    d.line((x-45, 215, x, 215), fill=GOLD, width=4)
                    d.polygon([(x, 210), (x+12, 215), (x, 220)], fill=GOLD)
                else:
                    d.polygon([(x, 195), (x+15, 216), (x, 238), (x-15, 216)], fill=(164, 231, 255), outline=(42, 159, 223))
            if .24 <= dt < .63:
                fade = 1-(dt-.24)/.39
                r = 17+45*(1-fade)
                d.ellipse((555-r, 216-r, 555+r, 216+r), outline=(round(245*fade), round(215*fade), round(128*fade)), width=3)
                text(d, (555, 125-25*(1-fade)), '-53' if ident == 'R01' else '-104', 31, GOLD)
        text(d, (360, 355), '弓弦 → 飞行 → 命中' if ident == 'R01' else '凝聚 → 冰晶命中', 20)
    elif ident == 'R03':
        for i, name in enumerate(['精准射击', '冰霜之力', '充能加速']):
            p = min(1, max(0, (t-.085*i)/.18))
            x, y = 145+215*i, 220+25*(1-p)
            sel = t >= 1.04 and i == 1
            if p:
                d.rounded_rectangle((x-85, y-107, x+85, y+107), 12, fill=(243, 230, 196),
                                    outline=GOLD if sel else (154, 131, 80), width=5 if sel else 2)
                icon = art('assets/resources/ux/ui_icon_skill_'+['archer','mora','volt'][i]+'.png', (92, 92))
                paste(im, icon, (x, y-26))
                d = ImageDraw.Draw(im)
                text(d, (x, y+47), name, 19, (28, 48, 61))
                if sel:
                    text(d, (x, y+82), '已选择', 17, (52, 115, 47))
        text(d, (360, 365), '卡牌出现' if t < 1.04 else '选择落定', 22, GOLD)
    elif ident == 'R04':
        hero = art('assets/resources/ux/hero_comic_v1/comic_figure_archer_v2.png', (175, 247))
        paste(im, hero, (145, 246))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((285, 113, 670, 347), 16, fill=(24, 43, 52, 225), outline=(137, 115, 66), width=2)
        text(d, (475, 147), '升级成功' if t >= 0 else '英雄培养', 31, GOLD)
        text(d, (475, 200), 'Lv.10  →  Lv.11', 26)
        value = round(210+7*min(1, max(0, t/.39)))
        text(d, (476, 259), f'战力   {value}   +7', 39, GREEN)
        text(d, (475, 313), '攻击力 +5      技能伤害 +3', 19)
    elif ident == 'R05':
        text(d, (360, 119), '获得奖励' if t >= 0 else '通关宝箱', 36, GOLD)
        for i, (icon, label) in enumerate([('coin', '金币 ×400'), ('stone', '强化石 ×2')]):
            x = 253+214*i
            p = min(1, max(0, (t-.16*i)/.25))
            if p:
                d.rounded_rectangle((x-66, 180, x+66, 310), 12, fill=(35, 58, 61), outline=GOLD, width=2)
                paste(im, art('docs/battle-modal-art-concept-v18/assets/'+icon+'.png', (92, 92)), (x, 243+14*(1-p)), p)
                d = ImageDraw.Draw(im)
                text(d, (x, 340), label, 21)
    else:
        iswin = ident == 'R06'
        banner = art('docs/battle-modal-art-concept-v18/assets/'+('victory' if iswin else 'defeat')+'-banner.png', (540, 158))
        p = min(1, max(0, t/.3))
        paste(im, banner, (360, 167+25*(1-p)), p)
        d = ImageDraw.Draw(im)
        if iswin:
            star = art('docs/battle-modal-art-concept-v18/assets/star.png', (50, 50))
            for i in range(3):
                if t > .91+i*.14:
                    paste(im, star, (296+i*64, 273))
            d = ImageDraw.Draw(im)
            text(d, (360, 330), '1-4  石桥隘口 · 普通', 23)
        else:
            text(d, (360, 283), '调整阵容，再战一次', 27, (208, 222, 232))
            text(d, (360, 338), '再次挑战', 22, GOLD)
    return im.convert('RGB')


def write_wav(path, a):
    peak = float(np.max(abs(a)))
    if not np.isfinite(a).all() or peak >= .999:
        raise ValueError(f'Unsafe render: {path}')
    pcm = np.round(a*32767).astype('<i2')
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    return dict(file=path.name, sha256=sha(path), seconds=len(a)/SR,
                peakDBFS=round(20*np.log10(max(peak, 1e-12)), 3),
                activeRMSDBFS=round(20*np.log10(active_rms(a)), 3), clippedSamples=0)


def video(case, side, audio):
    ident, title, prompt, length, events = case
    out = PAGE/'media'/f'{ident}-{side}.mp4'
    process = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
        '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), '-t', str(length), '-movflags', '+faststart', str(out)], stdin=subprocess.PIPE)
    try:
        for f in range(length*FPS):
            process.stdin.write(render_frame(case, f/FPS, side).tobytes())
    finally:
        process.stdin.close()
    if process.wait() != 0:
        raise ValueError(f'Video encoding failed: {out}')
    return dict(file='media/'+out.name, seconds=length, sha256=sha(out), bytes=out.stat().st_size)


def main():
    WORK.mkdir(exist_ok=True)
    (PAGE/'media').mkdir(parents=True, exist_ok=True)
    new = sketches()
    items = []
    stats = []
    for case in CASES:
        ident, title, prompt, length, events = case
        old_sources = [(at, decode(str(ROOT/'assets/resources/audio/v21'/f'{name}.wav')), gain)
                       for at, name, gain in events]
        old_frames = max(round(at*SR)+len(a) for at, a, gain in old_sources)
        old = np.zeros((old_frames, 2))
        for at, a, gain in old_sources:
            put(old, a, at, gain)
        variants = {'old': old, 'new': new[ident]}
        # Only scalar gain for headroom and a common active signal reference per comparison.
        ceiling = 10**(-3/20)
        target = min(10**(-20/20), *(active_rms(a)*ceiling/np.max(abs(a)) for a in variants.values()))
        row = dict(id=ident, name=title, listenFor=prompt, source='Sonniss professional recordings + VSCO 2 CE' if ident in ['R01','R02','R03'] else 'Original phrase performed with VSCO 2 CE recordings',
                   recipe=RECIPES[ident], clips={})
        for side, a in variants.items():
            a = a*target/active_rms(a)
            side_length = length if side == 'new' else max(length, math.ceil(.45+len(a)/SR))
            timeline = np.zeros((side_length*SR, 2))
            put(timeline, a, .45)
            timeline = edge(timeline, .001, .08)
            wav = WORK/f'{ident}-{side}.wav'
            stats.append(write_wav(wav, timeline))
            side_case = (ident, title, prompt, side_length, events)
            row['clips'][side] = video(side_case, side, wav)
        render_frame(case, min(2.2, length-.3), 'new').save(PAGE/'media'/f'{ident}.jpg', quality=88)
        row['poster'] = f'media/{ident}.jpg'
        items.append(row)
        print(ident, title, 'prepared (not auditioned)', flush=True)
    for side in ['old','new']:
        playlist = WORK/f'{side}-list.txt'
        playlist.write_text('\n'.join("file '"+str((PAGE/'media'/f'{r["id"]}-{side}.mp4').resolve()).replace('\\','/')+"'" for r in items), encoding='utf-8')
        subprocess.run([FF, '-v','error','-y','-f','concat','-safe','0','-i',str(playlist),
                        '-c','copy','-movflags','+faststart',str(PAGE/'media'/f'all-{side}.mp4')],check=True)
    manifest = dict(revision='representatives-r1', title='王国守望 · 代表声音',
                    status='等待用户试听确认，尚未扩展或替换游戏音效', items=items,
                    montage={'new':'media/all-new.mp4','old':'media/all-old.mp4','seconds':29,
                             'oldSeconds':sum(row['clips']['old']['seconds'] for row in items)},
                    methods='Recorded instruments and professionally recorded SFX; original short phrases; no AI-generated audio, no oscillator synthesis, no loudness-boost approval claim.',
                    subjectiveListening='Not performed. User will audition.')
    (PAGE/'data.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'render-stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    (HERE/'source-hashes.json').write_text(json.dumps(HASHES,ensure_ascii=False,indent=2),encoding='utf-8')
    (HERE/'recipes.json').write_text(json.dumps(RECIPES,ensure_ascii=False,indent=2),encoding='utf-8')


if __name__ == '__main__':
    main()
