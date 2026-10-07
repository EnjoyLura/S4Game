#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""crater_mark_strip_dust.py —— 抠除陨石坑焦痕外圈尘土灰晕（用户反馈：叠坑时灰晕压成脏云）。

原理：crater_mark.png 径向 0~0.35 是焦炭+余烬（暗色/红比高），0.5 以外是棕黄尘土
（亮度高、r/g≈1.1~1.7）。按「余烬分/焦炭分 + 径向衰减」重算 alpha：
  ember = 红比高（r-g 大、r 够亮）→ 保留（与 ed5a63d「r/g>1.85 保留亮斑」同思路）
  char  = 暗色（L 低于阈值）→ 保留，作为焦炭体与不规则焦边
  dust  = 其余中亮棕黄 → 抠除
再乘径向衰减（0.45→0.60 平滑降到 0），最后 1px alpha 羽化软化硬边。

用法:
  python crater_mark_strip_dust.py --src crater_mark.png --outdir <dir> [--tight|-]
变体:
  loose  只抠尘土色，不加径向（对照组）
  mid    径向 0.45→0.60（默认）
  tight  径向 0.38→0.52（更紧凑）
"""
import argparse
import math
import os

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 512, 512
CX, CY = W / 2, H / 2


def clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def smoothstep(a: float, b: float, v: float) -> float:
    t = clamp((v - a) / (b - a)) if b > a else 1.0
    return t * t * (3 - 2 * t)


def strip(img: Image.Image, radial: tuple[float, float] | None) -> Image.Image:
    im = img.convert('RGBA')
    px = im.load()
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    po = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            ember = clamp((r - g - 26) / 55) * clamp((r - 65) / 55)
            char = clamp((96 - lum) / 42)
            score = max(ember, char)
            if radial is not None:
                d = math.hypot(x - CX, y - CY) / (W / 2)
                score *= 1.0 - smoothstep(radial[0], radial[1], d)
            po[x, y] = (r, g, b, int(a * score))
    # 1px 羽化：对 alpha 做轻微模糊，仅取新值与旧值的较大者附近的平滑过渡
    return out.filter(ImageFilter.GaussianBlur(0.6))


def composite(base: Image.Image, mark: Image.Image, cx: float, cy: float, size: float, angle: float) -> None:
    m = mark.rotate(angle, resample=Image.BICUBIC, expand=False)
    m = m.resize((int(size), int(size)), Image.LANCZOS)
    base.alpha_composite(m, (int(cx - size / 2), int(cy - size / 2)))


def preview(mark: Image.Image, outdir: str, tag: str) -> None:
    """按游戏内参数合成单坑与七星叠坑：mark 宽 2.45*88≈216px，梅花间距 0.55*130≈71.5px。"""
    road = Image.open(os.path.join(HERE, '../assets/resources/scenes/scene_1_1.png')).convert('RGBA')
    road = road.crop((300, 700, 1000, 1400)).resize((700, 700), Image.LANCZOS)  # 纯沙路面样本
    os.makedirs(outdir, exist_ok=True)
    MARK_W = 2.45 * 88
    J = 14
    # 单坑
    single = road.copy()
    composite(single, mark, 350, 350, MARK_W, 37)
    single.convert('RGB').save(os.path.join(outdir, f'{tag}_single.png'))
    # 七点星（与 castUlt 一致：中心 + 四向 0.55R + 两对角 0.78R，±14 抖动）
    for k, (name, pts) in enumerate({
        'overlap7': [(0, 0)] + [(math.cos(-math.pi / 2 + i * math.pi / 2) * 71.5, math.sin(-math.pi / 2 + i * math.pi / 2) * 71.5) for i in range(4)]
        + [(math.cos(math.pi / 4 + i * math.pi) * 101.4, math.sin(math.pi / 4 + i * math.pi) * 101.4) for i in range(2)],
        'overlap3': [(0, 0), (40, -52), (-46, 44)],
    }.items()):
        canvas = road.copy()
        for i, (dx, dy) in enumerate(pts):
            jx = ((i * 37) % 3 - 1) * J
            jy = ((i * 53) % 3 - 1) * J
            seed = math.sin((350 + dx + jx) * 0.017 + (350 + dy + jy) * 0.013)
            composite(canvas, mark, 350 + dx + jx, 350 + dy + jy, MARK_W, seed * 7)
        canvas.convert('RGB').save(os.path.join(outdir, f'{tag}_{name}.png'))
    print(f'[preview] {tag} -> {outdir}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(HERE, '../assets/resources/fx/crater_mark.png'))
    ap.add_argument('--outdir', default=os.path.join(HERE, '../docs/fire-vfx-preview/crater_dust'))
    args = ap.parse_args()
    src = Image.open(args.src)
    variants = {
        'loose': None,
        'mid': (0.45, 0.60),
        'tight': (0.38, 0.52),
    }
    os.makedirs(args.outdir, exist_ok=True)
    # 原图对照
    preview(src.copy(), args.outdir, 'before')
    for tag, radial in variants.items():
        out = strip(src, radial)
        out.save(os.path.join(args.outdir, f'crater_mark_{tag}.png'))
        preview(out, args.outdir, tag)
        print(f'[ok] {tag}: radial={radial}')


if __name__ == '__main__':
    main()
