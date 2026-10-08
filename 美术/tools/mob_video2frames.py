#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""mob_video2frames.py —— 怪物动作视频 → 序列帧段（角色安全抠底版）。

与 video2atlas.py 的区别：怪物是实体角色，不能用「alpha=最大通道」的反预乘
（那会把角色身上的深色皮革/描边抠成半透明）。本工具用「边缘洪水填充」抠纯黑底：
与边界连通的暗色区 → alpha=0，角色内部暗部不受影响；再对 alpha 做 0.8px 羽化。

流程：解码 → 黑场校正(pedestal) → walk 模式自相关检测步态周期（只在一个完整周期内
等相位抽帧，保证循环回绕相位衔接；attack 模式整段均匀抽）→ 逐帧抠底 → 选中帧联合
包围盒（同取景防抖）→ 底部对齐钉进格（脚底基线恒定）→
输出单怪横向段图集 + frames.json + 接触表。

用法:
  python mob_video2frames.py --video walk_goblin_worker.mp4 --prefix goblin_worker \
      --mode w --cells 14 [--fps 12] [--keytol 26] [--thresh 18]
输出:
  <outdir>/<prefix>_<mode>.png           1×N 段图集（RGBA）
  <outdir>/<prefix>_<mode>.frames.json   {"frames": {"<prefix>_<mode>0": [x,y,w,h], ...}}
  <outdir>/<prefix>_<mode>_sheet.png     接触表（审查用）
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

KEY_COLOR = (255, 0, 255)   # 洪水填充标记色（洋红，角色 unlikely 含此色）


def decode(video: str, fps: float):
    import imageio
    reader = imageio.get_reader(video)
    meta = reader.get_meta_data()
    src_fps = meta.get('fps', 24) or 24
    arr = np.stack([f for f in reader]).astype(np.uint8)
    reader.close()
    print('decoded %d frames fps=%s %dx%d' % (len(arr), src_fps, arr.shape[2], arr.shape[1]))
    # 黑场校正：逐帧 0.5 分位作黑电平，软膝拉伸保持 255
    fixed = np.empty_like(arr)
    for i, f in enumerate(arr):
        ped = np.percentile(f.reshape(-1, 3), 0.5, axis=0).astype(np.float32)
        fixed[i] = np.clip((f.astype(np.float32) - ped) * (255.0 / (255.0 - max(ped.max(), 1))), 0, 255).astype(np.uint8)
    if fps > 0 and src_fps > fps:
        step = src_fps / fps
        idxs = [int(i * step) for i in range(int(len(arr) / step))]
        fixed = fixed[idxs]
        print('resampled to %d frames @%s' % (len(fixed), fps))
    return fixed, src_fps


def detect_cycle(arr, thresh: float):
    """步态周期检测：帧间内容掩码异或能量 D[t] 应呈周期性，自相关取首个显著峰。
    返回 (period_frames, score, D)；score 低说明无稳定步态（调用方退化为整段采样）。"""
    lums = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2])
    masks = lums > thresh
    D = np.zeros(len(arr))
    for t in range(1, len(arr)):
        D[t] = np.count_nonzero(masks[t] ^ masks[t - 1])
    n = len(arr)
    scores = {}
    for p in range(max(6, n // 8), n * 2 // 3):
        a, b = D[p:], D[:n - p]
        if a.std() < 1e-6 or b.std() < 1e-6:
            continue
        scores[p] = float(np.corrcoef(a, b)[0, 1])
    if not scores:
        return 0, 0.0, D
    best = max(scores.values())
    # 取首个接近最优的峰：避免锁到 2×周期；±3% 容差内的更短峰（左右步近对称）也可接受
    p = min(q for q, s in scores.items() if s >= best - 0.03)
    return p, scores[p], D


def key_frame(f: np.ndarray, keytol: int) -> Image.Image:
    """边缘洪水填充抠黑底 → RGBA PIL 图。"""
    im = Image.fromarray(f).convert('RGB')
    w, h = im.size
    d = ImageDraw.floodfill
    seeds = []
    for x in range(0, w, 96):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, 96):
        seeds += [(0, y), (w - 1, y)]
    px = im.load()
    for s in seeds:
        if px[s] != KEY_COLOR and sum(px[s]) / 3 < 90:   # 只从暗色边种（亮边可能是角色贴边）
            d(im, s, KEY_COLOR, thresh=keytol)
    a = np.asarray(im)
    alpha = np.where((a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255), 0, 255).astype(np.uint8)
    rgba = np.dstack([f, alpha])
    out = Image.fromarray(rgba, 'RGBA')
    # 1) 收紧 alpha 羽化 2) 黑边去污：alpha 边缘像素 RGB 反除（减黑边）
    out.putalpha(out.getchannel('A').filter(ImageFilter.GaussianBlur(0.8)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', required=True)
    ap.add_argument('--prefix', required=True, help='mob id，如 goblin_worker')
    ap.add_argument('--mode', default='w', choices=['w', 'a'], help='w=walk 循环 a=attack 一次性')
    ap.add_argument('--outdir', default=None)
    ap.add_argument('--cells', type=int, default=8)
    ap.add_argument('--size', type=int, default=160)
    ap.add_argument('--fps', type=float, default=12)
    ap.add_argument('--keytol', type=int, default=26, help='洪水填充容差(0-255)')
    ap.add_argument('--thresh', type=int, default=18, help='内容亮度阈值')
    ap.add_argument('--margin', type=float, default=0.05)
    ap.add_argument('--cycle', choices=['auto', 'all'], default='auto',
                    help='auto=检测单步态环抽帧（walk 用）；all=整段均匀抽（attack 用）')
    args = ap.parse_args()

    outdir = args.outdir or os.path.dirname(os.path.abspath(args.video))
    os.makedirs(outdir, exist_ok=True)
    cyclic = args.cycle == 'auto' and args.mode == 'w'
    # 周期检测要在原始帧率上做（12fps 抽稀会砍半周期分辨率），抽帧后再不受 fps 影响
    arr, src_fps = decode(args.video, 0 if cyclic else args.fps)

    n = args.cells
    meta_cycle = None
    if cyclic:
        p, score, D = detect_cycle(arr, args.thresh)
        if p and score >= 0.35:
            s = 1 + int(np.argmin(D[1:p + 1]))   # 运动能量最低帧＝触地/蓄力相，作环起点回绕最顺
            picks = sorted(set((s + round(k * p / n)) % len(arr) for k in range(n)),
                           key=lambda t: (t - s) % len(arr))   # 按环内相位排序（窗口回绕时不乱时序）
            meta_cycle = round(p / src_fps, 3)
            print('cycle: period=%d frames (%.2fs) score=%.2f start=%d -> %d cells'
                  % (p, p / src_fps, score, s, len(picks)))
        else:
            picks = []
            print('warn: 步态周期不显著 (p=%s score=%.2f)，退化为整段均匀采样' % (p, score))
    if not cyclic or not picks:
        picks = sorted(set(round(j * (len(arr) - 1) / (n - 1)) for j in range(n)))[:n]
        if len(picks) < n:
            print('note: 帧不足，实际 %d 格' % len(picks))

    # 联合包围盒只取选中帧：单周期内取景一致，裁切更紧且无跨环抖动
    lums = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2])
    boxes = []
    for fi in picks:
        ys, xs = np.where(lums[fi] > args.thresh)
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) > 300 else None)
    ws = [b for b in boxes if b]
    if not ws:
        print('FATAL: 无内容，调低 --thresh')
        return 1
    L = min(b[0] for b in ws); T = min(b[1] for b in ws)
    R = max(b[2] for b in ws); B = max(b[3] for b in ws)
    mw, mh = int((R - L) * args.margin), int((B - T) * args.margin)
    L, T = max(0, L - mw), max(0, T - 2 * mh)   # 顶部/左右留裕量防帧间抖动
    R, B = min(arr.shape[2], R + mw), min(arr.shape[1], B)   # 底部不外扩：内容下缘即脚底基线（外扩会整体腾空）
    print('union bbox: (%d,%d)-(%d,%d)' % (L, T, R, B))

    S = args.size
    cw, ch = R - L, B - T
    scale = min((S - 8) / cw, (S - 16) / ch)   # 顶部留 16 裕量；底部只留 foot_margin 钉脚隙
    dw, dh = round(cw * scale), round(ch * scale)
    foot_margin = 3   # 脚底离格底的唯一间隙（此前 8+底部外扩导致角色踩在影子上的腾空感）

    cells = []
    for k, fi in enumerate(picks):
        frame = key_frame(arr[fi], args.keytol)
        crop = frame.crop((L, T, R, B)).resize((dw, dh), Image.LANCZOS)
        cell = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        cell.alpha_composite(crop, ((S - dw) // 2, S - foot_margin - dh))
        cells.append(cell)

    seg = Image.new('RGBA', (S * len(cells), S), (0, 0, 0, 0))
    rect = {}
    for k, cell in enumerate(cells):
        seg.paste(cell, (k * S, 0))
        rect['%s_%s%d' % (args.prefix, args.mode, k)] = [k * S, 0, S, S]
    png = os.path.join(outdir, '%s_%s.png' % (args.prefix, args.mode))
    seg.save(png)
    meta = {'frames': rect}
    if meta_cycle:
        meta['cycle'] = {'seconds': meta_cycle, 'cells': len(cells)}   # 运行时按实时速率播步态环
    with open(os.path.join(outdir, '%s_%s.frames.json' % (args.prefix, args.mode)), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    # 接触表（沙色底模拟路面，审查贴图观感）
    sheet = Image.new('RGB', (len(cells) * (S + 6) + 6, S + 12), (196, 168, 110))
    for k, cell in enumerate(cells):
        sheet.paste(cell, (6 + k * (S + 6), 6), cell)
    sheet.save(os.path.join(outdir, '%s_%s_sheet.png' % (args.prefix, args.mode)))
    print('segment: %s (%dx%d, %d cells) -> %s' % (png, seg.width, S, len(cells), outdir))
    return 0


if __name__ == '__main__':
    sys.exit(main())
