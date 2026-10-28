"""Composite the Blender frames into the final 10 s showcase.

Adds multi-radius bloom, impact flashes and lens streaks, grade, vignette,
grain, titles and a fade to black. No game code is imported or executed.
"""
from __future__ import annotations
import argparse
import json
import math
from functools import lru_cache
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent
FRAMES = OUT / 'frames'
FPS = 24
END = 240
parser = argparse.ArgumentParser()
parser.add_argument('--all', action='store_true')
parser.add_argument('--gif', action='store_true')
parser.add_argument('--stills', action='store_true')
args = parser.parse_args()

FILES = sorted(FRAMES.glob('frame_*.png'))
if not args.stills:
    assert len(FILES) == END, f'expected {END} frames, found {len(FILES)}'
SIZE = Image.open(FILES[0]).width
H = Image.open(FILES[0]).height
SCALE = SIZE / 960
FONT = 'C:/Windows/Fonts/msyh.ttc'
MARKS = json.loads((OUT / 'impact-marks.json').read_text())


def font(n):
    return ImageFont.truetype(FONT, max(8, round(n * SCALE)))


def stage_name(t):
    if t < 1.55:
        return '起 · 剑阵苏醒'
    if t < 2.29:
        return '落 · 一岳镇地'
    if t < 3.79:
        return '落 · 四岳镇地'
    if t < 5.4:
        return '聚 · 剑意归宗'
    if t < 6.21:
        return '斩 · 天倾一剑'
    if t < 8.2:
        return '震 · 五岳成阵'
    if t < 9.1:
        return '余 · 灵光渐散'
    return '寂 · 归剑于阵'


def bloom(rgb):
    lum = rgb.max(axis=2)
    source = np.clip((lum - 0.55) / 0.45, 0, 1)
    src = Image.fromarray(np.uint8(source * 255))
    glow = np.zeros((H, SIZE), np.float32)
    for radius, weight in [(1.5, .32), (5.0, .24), (16, .15), (40, .07)]:
        blur = src.filter(ImageFilter.GaussianBlur(radius * SCALE))
        glow += np.asarray(blur, dtype=np.float32) / 255 * weight
    tint = np.array([0.76, 1.0, 0.86], dtype=np.float32)
    return glow[:, :, None] * tint * SCALE * .38


def star_flare(mark, t):
    age = t - mark['time']
    if age < 0 or age > 1.5:
        return None
    final = mark['final']
    power = mark['power'] * (1.0 if not final else 1.6)
    decay = math.exp(-age * (3.2 if final else 5.2))
    if age > .32:
        return None
    im = Image.new('RGB', (SIZE, H), (0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = mark['x'] * SIZE
    cy = (1 - mark['y']) * H
    energy = decay * power
    # restrained diagonal star; no full-width streak
    for k in range(4):
        ang = math.pi / 4 + math.pi / 2 * k
        length = (66 if final else 40) * SCALE * (0.4 + min(energy, 1.8))
        width = max(1, round(2 * SCALE))
        dx, dy = math.cos(ang) * length, math.sin(ang) * length
        d.line((cx - dx, cy - dy, cx + dx, cy + dy),
               fill=(int(80 * energy), int(210 * energy), int(150 * energy)), width=width)
    r = max(2, round(4 * SCALE * (0.4 + min(energy, 1.8))))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(int(160 * energy), int(250 * energy), int(200 * energy)))
    im = im.filter(ImageFilter.GaussianBlur(1.6 * SCALE))
    return im, energy


def grade(rgb, t):
    # cool shadows, jade highlights, gentle contrast
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    shadow = np.clip(1 - lum * 2.4, 0, 1)[:, :, None]
    highlight = np.clip(lum * 1.6 - .25, 0, 1)[:, :, None]
    rgb = rgb + shadow * np.array([-0.012, 0.004, 0.004], dtype=np.float32)
    rgb = rgb + highlight * np.array([0.006, 0.008, -0.002], dtype=np.float32)
    rgb = np.clip((rgb - .5) * 1.045 + .5, 0, 1)
    return rgb


def vignette():
    yy, xx = np.mgrid[0:H, 0:SIZE].astype(np.float32)
    nx = (xx / SIZE - .5) * 2
    ny = (yy / H - .5) * 2
    r = np.sqrt(nx * nx * .82 + ny * ny)
    v = np.clip(1 - np.clip((r - .42) / .78, 0, 1) ** 1.7 * .55, 0, 1)
    return v[:, :, None]


VIG = vignette()
rng = np.random.default_rng(14159)


def compose(path, labels=True):
    frame = int(path.stem.split('_')[1])
    t = (frame - 1) / FPS
    rgb = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255
    rgb = rgb + bloom(rgb)
    for mark in MARKS:
        flare = star_flare(mark, t)
        if flare:
            im, energy = flare
            f = np.asarray(im, dtype=np.float32) / 255
            rgb = rgb + f * (0.22 + .12 * energy)
            # brief screen flash, mostly local
            flash = (0.10 if mark['final'] else 0.045) * math.exp(-max(0, t - mark['time']) * 9)
            rgb = rgb + flash * np.array([0.55, 1.0, 0.75], dtype=np.float32)
    rgb = grade(rgb, t)
    rgb *= VIG
    grain = rng.normal(0, .0028, (H, SIZE, 1)).astype(np.float32)
    rgb = np.clip(rgb + grain, 0, 1)
    # fade in / out
    fade = 1.0
    if t < .35:
        fade *= t / .35
    if t > 9.05:
        fade *= max(0.0, 1 - (t - 9.05) / .9)
    rgb = rgb * fade
    im = Image.fromarray(np.uint8(np.clip(rgb, 0, 1) * 255))
    if labels:
        d = ImageDraw.Draw(im)
        pad = round(SIZE * .038)
        # title block, upper right
        alpha = smoothstep(min(1, max(0, (t - .25) / .9)))
        def col(c, a):
            return tuple(int(v * a) for v in c)
        tx = SIZE - pad - round(SIZE * .30)
        d.text((tx, pad), '五岳天剑', font=font(32), fill=col((238, 232, 214), alpha))
        d.text((tx, pad + round(SIZE * .043)), 'SWORD ULTIMATE · BLENDER STUDY',
               font=font(11), fill=col((128, 200, 165), alpha))
        d.text((tx, pad + round(SIZE * .064)), '未接入游戏 · 离线视觉试作',
               font=font(10), fill=col((140, 156, 160), alpha))
        # bottom bar
        base = round(H * .905)
        d.text((pad, base), stage_name(t), font=font(17), fill=(226, 218, 196))
        d.text((SIZE - pad - round(SIZE * .075), base), f'{min(t, 10):04.2f} s',
               font=font(15), fill=(140, 160, 158))
        y = round(H * .962)
        x0, x1 = pad, SIZE - pad
        d.line((x0, y, x1, y), fill=(46, 62, 60), width=max(1, round(2 * SCALE)))
        progress = min(1, t / 10)
        d.line((x0, y, x0 + (x1 - x0) * progress, y), fill=(112, 214, 164),
               width=max(2, round(3 * SCALE)))
        for mark in MARKS:
            mx = x0 + (x1 - x0) * mark['time'] / 10
            r = 4 if mark['final'] else 2
            d.ellipse((mx - r, y - r, mx + r, y + r), fill=(226, 200, 130))
    return im


def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


if args.all:
    composed = []
    for p in FILES:
        im = compose(p)
        composed.append(im)
    # preview video
    writer = imageio.get_writer(OUT / 'five-peaks-heavenfall.mp4', fps=FPS, codec='libx264',
                                quality=8, pixelformat='yuv420p', macro_block_size=8)
    for im in composed:
        writer.append_data(np.asarray(im))
    writer.close()
    # key stills
    beauty = [20, 56, 92, 124, 140, 149, 155, 166, 205]
    for f in beauty:
        copy = compose(FRAMES / f'frame_{f:04d}.png')
        copy.save(OUT / f'beauty-{f:04d}.jpg', quality=95)
    # contact sheet 4x4
    keys = [20, 40, 56, 68, 80, 92, 108, 124, 136, 144, 149, 155, 160, 166, 190, 205]
    tw, th = 480, 270
    sheet = Image.new('RGB', (tw * 4, th * 4), (7, 12, 13))
    ds = ImageDraw.Draw(sheet)
    for i, f in enumerate(keys):
        tile = compose(FRAMES / f'frame_{f:04d}.png', labels=False).resize((tw, th), Image.Resampling.LANCZOS)
        sheet.paste(tile, ((i % 4) * tw, (i // 4) * th))
        ds.text(((i % 4) * tw + 12, (i // 4) * th + 8), f'{(f - 1) / FPS:04.2f}s',
                font=ImageFont.truetype(FONT, 18), fill=(230, 226, 208))
    sheet.save(OUT / 'contact-sheet.jpg', quality=93)
    # gif / webp at half rate; webp is the primary in-chat preview
    if args.gif:
        small_rgb = [im.resize((640, 360), Image.Resampling.LANCZOS) for im in composed[::2]]
        small_gif = [im.resize((480, 270), Image.Resampling.LANCZOS).convert(
            'P', palette=Image.ADAPTIVE, colors=192, dither=Image.Dither.FLOYDSTEINBERG)
            for im in composed[::2]]
        small_gif[0].save(OUT / 'five-peaks-heavenfall.gif', save_all=True, append_images=small_gif[1:],
                          duration=83, loop=0, optimize=True)
        small_rgb[0].save(OUT / 'five-peaks-heavenfall.webp', save_all=True, append_images=small_rgb[1:],
                          duration=83, loop=0, quality=80, method=4)
    print('composed', len(composed), 'frames', SIZE, H)
