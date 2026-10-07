#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""mob_atlas_repack.py —— 用批次22 重制立绘重排 battle_mobs_v2 静态图集。

布局约定与旧图集完全一致（BattleSprite 按 frames.json 的 [x,y,w,h] 左上原点取帧）：
  - 1536×1024 画布，3×2 网格，cell 512；
  - 每只怪 alpha 裁边后等比缩放到 max(w,h) ≤ 464；
  - 单元内水平居中、底边锚在 cell 内 y=488（即 24px 下边距）。
  - 顺序按 KingdomWatch/tools/battle-mob-ids.json。

用法:
  python mob_atlas_repack.py --batch 美术/原图/批次22_怪物重制_2026-10-08 \
      --ids KingdomWatch/tools/battle-mob-ids.json \
      --out KingdomWatch/assets/resources/ux
"""
import argparse
import json
import os

from PIL import Image

CANVAS_X, CANVAS_Y = 1536, 1024
CELL = 512
MAX_DIM = 464      # 旧图集的内容上限（≈90.6%）
BOTTOM = 488       # cell 内底边基线
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def main():
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument('--batch', default=os.path.join(ROOT, '美术', '原图', '批次22_怪物重制_2026-10-08'))
    ap.add_argument('--ids', default=os.path.join(ROOT, 'KingdomWatch', 'tools', 'battle-mob-ids.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'KingdomWatch', 'assets', 'resources', 'ux'))
    args = ap.parse_args()

    with open(args.ids, encoding='utf-8') as f:
        ids = json.load(f)

    atlas = Image.new('RGBA', (CANVAS_X, CANVAS_Y), (0, 0, 0, 0))
    frames = {}
    for idx, mob in enumerate(ids):
        src = os.path.join(args.batch, f'mob_{mob}.png')
        im = Image.open(src).convert('RGBA')
        bbox = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        im = im.crop(bbox)
        scale = min(MAX_DIM / max(im.width, im.height), 1.0 if max(im.width, im.height) <= MAX_DIM else MAX_DIM / max(im.width, im.height))
        w, h = round(im.width * scale), round(im.height * scale)
        im = im.resize((w, h), Image.LANCZOS)
        cx, cy = (idx % 3) * CELL, (idx // 3) * CELL
        px, py = cx + (CELL - w) // 2, cy + BOTTOM - h
        atlas.alpha_composite(im, (px, py))
        frames[mob] = [px, py, w, h]
        print(f'[ok] {mob}: cell({cx},{cy}) -> [{px},{py},{w},{h}]')

    out_png = os.path.join(args.out, 'battle_mobs_v2.png')
    out_json = os.path.join(args.out, 'battle_mobs_v2.frames.json')
    atlas.save(out_png)
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump({'source': 'batch22 mob sprites (mob_atlas_repack.py)', 'atlas': 'battle_mobs_v2.png',
                   'width': CANVAS_X, 'height': CANVAS_Y, 'frames': frames}, f, ensure_ascii=False, indent=2)
    print(f'[done] {out_png} ({CANVAS_X}x{CANVAS_Y}) + frames.json')


if __name__ == '__main__':
    main()
