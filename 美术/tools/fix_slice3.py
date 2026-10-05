#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""批次3 S1 网格自由布局重切：取 8 大连通域（实测正好一域一图标），
按 行带(中心y聚类) + 行内中心x 排序映射行优先名单。用法: python fix_slice3.py"""
from PIL import Image
import os

SHEET = '../原图/批次3_商店图标_2026-10-05/S1_商品图标表.png'
OUT = '../切图/图标'
UX = 'D:/AI/S4Game/KingdomWatch/assets/resources/ux'
SCALE = 0.5
NAMES = ['ui_item_wpn_bow', 'ui_item_wpn_crossbow', 'ui_item_helm_falcon',
         'ui_item_acc_moon', 'ui_item_glove_wind', 'ui_item_armor_forest',
         'ui_item_mat_stone', 'ui_item_mat_iron']

im = Image.open(SHEET).convert('RGBA')
W, H = im.size
a = list(im.getchannel('A').getdata())
seen = bytearray(W * H)
comps = []
# id_map：目标组件逐像素编号，裁剪时剔除混入包围盒的邻图标像素（羽冠尖等）
id_map = [0] * (W * H)
cid = 0
for start in range(W * H):
    if a[start] <= 8 or seen[start]:
        continue
    cid += 1
    stack = [start]
    seen[start] = 1
    x0 = x1 = start % W
    y0 = y1 = start // W
    size = 0
    while stack:
        p = stack.pop()
        size += 1
        id_map[p] = cid
        x, y = p % W, p // W
        x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
        for q in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
            if 0 <= q[0] < W and 0 <= q[1] < H:
                i2 = q[1] * W + q[0]
                if not seen[i2] and a[i2] > 8:
                    seen[i2] = 1
                    stack.append(i2)
    if size > 1500:
        comps.append({'id': cid, 'size': size, 'bbox': (x0, y0, x1, y1), 'cx': (x0+x1)/2, 'cy': (y0+y1)/2})

assert len(comps) == len(NAMES), f'连通域 {len(comps)} != {len(NAMES)}'
comps.sort(key=lambda c: c['cy'])
rows = [[comps[0]]]
for c in comps[1:]:
    if c['cy'] - rows[-1][0]['cy'] > H / 6:
        rows.append([c])
    else:
        rows[-1].append(c)
ordered = []
for r in rows:
    r.sort(key=lambda c: c['cx'])
    ordered += r

os.makedirs(OUT, exist_ok=True)
px = im.load()
for c, name in zip(ordered, NAMES):
    x1, y1, x2, y2 = c['bbox']
    pad = 4
    crop = im.crop((max(0, x1-pad), max(0, y1-pad), min(W, x2+1+pad), min(H, y2+1+pad)))
    cpx = crop.load()
    cw, ch = crop.size
    ox, oy = max(0, x1-pad), max(0, y1-pad)
    for yy in range(ch):
        for xx in range(cw):
            if id_map[(oy+yy) * W + (ox+xx)] != c['id']:
                cpx[xx, yy] = (0, 0, 0, 0)
    bbox = crop.getbbox()
    crop = crop.crop(bbox)
    crop = crop.resize((round(crop.width*SCALE), round(crop.height*SCALE)), Image.LANCZOS)
    for dst in (OUT, UX):
        crop.save(os.path.join(dst, name + '.png'))
    print(name, crop.size)
