#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""mob_anim_pack.py —— 把各怪walk/attack段图集装配成引擎图集 battle_mob_anim_v1。

输入: 批次22 目录下的 <mobid>_<mode>.png + <mobid>_<mode>.frames.json
     （mob_video2frames.py 产出；w=走路循环 a=攻击一次性）
输出: KingdomWatch/assets/resources/ux/battle_mob_anim_v1.png + .frames.json
     帧名: <mobid>_w<i> / <mobid>_a<i>；格子统一 160px，网格 12 列。
另出接触表: KingdomWatch/docs/fire-vfx-preview/mob_anim/atlas_sheet.png

用法:
  python mob_anim_pack.py --batch <批次22目录> --out KingdomWatch/assets/resources/ux
"""
import argparse
import json
import os

from PIL import Image, ImageDraw

# 狼王 goblin_king 不在战斗波次（仅图鉴）：不打包动画，战斗中走静态帧兜底
MOBS = ['goblin_worker', 'goblin_slinger', 'goblin_shaman', 'wolf_rider', 'goblin_brute']
CELL = 160
COLS = 12
NAME = 'battle_mob_anim_v1'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--batch', default='美术/原图/批次22_怪物重制_2026-10-08')
    ap.add_argument('--out', default='KingdomWatch/assets/resources/ux')
    ap.add_argument('--sheet-dir', default='KingdomWatch/docs/fire-vfx-preview/mob_anim')
    args = ap.parse_args()

    segs = []   # (name, image)
    for mob in MOBS:
        for mode in ('w', 'a'):
            p = os.path.join(args.batch, '%s_%s.png' % (mob, mode))
            if os.path.exists(p):
                segs.append((mob, mode, Image.open(p).convert('RGBA')))
            else:
                print('[skip] %s' % p)
    if not segs:
        raise SystemExit('没有任何段图集')

    total = sum(im.width // CELL for _, _, im in segs)
    rows = (total + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    frames = {}
    cycles = {}   # mob -> 步态环真实时长（s），运行时按实时速率播放
    ground = {}
    for mob, mode, im in segs:
        if mode == 'w':
            jpath = os.path.join(args.batch, '%s_w.frames.json' % mob)
            if os.path.exists(jpath):
                try:
                    with open(jpath, encoding='utf-8') as f:
                        clip_meta = json.load(f)
                        sec = (clip_meta.get('cycle') or {}).get('seconds')
                    if clip_meta.get('ground'):
                        ground[mob] = clip_meta['ground']
                    if sec:
                        cycles[mob] = sec
                except (OSError, ValueError):
                    pass
    sheet = Image.new('RGB', (COLS * (CELL + 6) + 6, rows * (CELL + 6) + 6), (46, 44, 40))
    d = ImageDraw.Draw(sheet)
    idx = 0
    for mob, mode, im in segs:
        n = im.width // CELL
        for k in range(n):
            cell = im.crop((k * CELL, 0, (k + 1) * CELL, CELL))
            x, y = (idx % COLS) * CELL, (idx // COLS) * CELL
            atlas.paste(cell, (x, y))
            name = '%s_%s%d' % (mob, mode, k)
            frames[name] = [x, y, CELL, CELL]
            sx, sy = 6 + (idx % COLS) * (CELL + 6), 6 + (idx // COLS) * (CELL + 6)
            sheet.paste(cell, (sx, sy), cell)
            d.text((sx + 3, sy + 3), name, fill=(255, 255, 0))
            idx += 1
    os.makedirs(args.out, exist_ok=True)
    atlas.save(os.path.join(args.out, NAME + '.png'))
    manifest = {'frames': frames}
    if cycles:
        manifest['cycles'] = cycles
    if ground:
        manifest['ground'] = ground
    with open(os.path.join(args.out, NAME + '.frames.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    os.makedirs(args.sheet_dir, exist_ok=True)
    sheet.save(os.path.join(args.sheet_dir, 'atlas_sheet.png'))
    print('atlas %dx%d, %d frames -> %s' % (atlas.width, atlas.height, len(frames), args.out))


if __name__ == '__main__':
    main()
