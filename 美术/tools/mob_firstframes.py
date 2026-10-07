#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""mob_firstframes.py —— 怪物图生视频首帧准备（AI视频特效工作流 §1 的角色版）。

从批次22 的 6 张 1024 透明立绘出发：
  1. alpha 包围盒裁边 + 6% 边距；
  2. 轻度压鲜艳（Color 0.90）与提亮收敛（Brightness 0.95），压住 AI 视频的鲜艳漂移；
  3. 居中合成到 768×768 纯黑，脚底基线钉在画布 90% 高度（留出迈步空间），
     主体高度约占画布 74% —— 占比即成片中怪物的相对大小。

用法:
  python mob_firstframes.py --batch <批次22目录> --outdir 美术/vfx_host
输出:
  <outdir>/mobwalk_<mobid>_ff.png（部署 kw-vfx-src 后作为 --image 传 art_video_gen.py）
"""
import argparse
import os

from PIL import Image, ImageEnhance

MOBS = ['goblin_worker', 'goblin_slinger', 'goblin_shaman', 'wolf_rider', 'goblin_brute', 'goblin_king']
CANVAS = 768
SUBJECT_H = 0.74      # 主体高 / 画布
FOOT_Y = 0.90         # 脚底基线 / 画布


def first_frame(path: str, out: str) -> None:
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 16 else 0)
    x0, y0, x1, y1 = a.getbbox()
    pad = int(max(x1 - x0, y1 - y0) * 0.06)
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width, x1 + pad), min(im.height, y1 + pad)
    im = im.crop((x0, y0, x1, y1))

    im = ImageEnhance.Color(im).enhance(0.90)
    im = ImageEnhance.Brightness(im).enhance(0.95)

    scale = min(CANVAS * SUBJECT_H / im.height, CANVAS * 0.86 / im.width)
    w, h = round(im.width * scale), round(im.height * scale)
    im = im.resize((w, h), Image.LANCZOS)

    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 255))
    canvas.alpha_composite(im, ((CANVAS - w) // 2, round(CANVAS * FOOT_Y) - h))
    canvas.convert('RGB').save(out)
    print(f'[ok] {os.path.basename(out)} subject {w}x{h} foot@y{round(CANVAS * FOOT_Y)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batch', default='美术/原图/批次22_怪物重制_2026-10-08')
    ap.add_argument('--outdir', default='美术/vfx_host')
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    for mob in MOBS:
        src = os.path.join(args.batch, f'mob_{mob}.png')
        if not os.path.exists(src):
            print(f'[skip] {src} 不存在')
            continue
        first_frame(src, os.path.join(args.outdir, f'mobwalk_{mob}_ff.png'))


if __name__ == '__main__':
    main()
