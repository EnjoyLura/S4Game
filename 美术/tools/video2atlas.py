# -*- coding: utf-8 -*-
"""AI 视频 → 序列帧图集（FireVFX 兼容格式）。

输入图生视频产出的 MP4（纯黑背景 + ADD 混合约定，无需 alpha 抠图），
自动定位"峰值→消散结束"的有效窗口，均匀抽取 N 格，
用全窗口联合包围盒裁切（所有格子同一取景，避免逐帧抖动），
输出：
  <outdir>/<prefix>.png        图集（grid x grid 格，每格 size x size）
  <outdir>/<prefix>.frames     {"frames": {<prefix>_i: [x,y,w,h]}}
  <outdir>/<prefix>_cell_i.png 单格图（便于人工审查）
  <outdir>/<prefix>_sheet.png  对比接触表（审查用，不入库也行）

用法：
  python video2atlas.py --video path/to.mp4 --prefix pyro_hit \
      [--cells 14] [--size 256] [--grid 4] [--window auto|all]
      [--fps 0(全帧)] [--margin 0.10] [--thresh 12]
依赖：pip install imageio imageio-ffmpeg pillow
"""
import argparse
import json
import os
import sys

import imageio.v3 as iio
import numpy as np
from PIL import Image


def lum(a: np.ndarray) -> np.ndarray:
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def frame_bboxes(frames: np.ndarray, thresh: int):
    """每帧内容包围盒 (l,t,r,b)，低于阈值的帧返回 None。"""
    out = []
    for f in frames:
        m = lum(f.astype(np.float32)) > thresh
        if m.sum() < 24:  # 近全黑
            out.append(None)
            continue
        ys, xs = np.where(m)
        out.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', required=True)
    ap.add_argument('--prefix', required=True)
    ap.add_argument('--outdir', default=None, help='默认与视频同目录')
    ap.add_argument('--cells', type=int, default=14, help='抽取格数')
    ap.add_argument('--size', type=int, default=256, help='每格边长(px)')
    ap.add_argument('--grid', type=int, default=4, help='图集每行格数')
    ap.add_argument('--fps', type=float, default=0, help='0=读全部帧；>0 先按此帧率抽稀')
    ap.add_argument('--window', default='auto', help='auto=峰值→内容结束；all=整段')
    ap.add_argument('--margin', type=float, default=0.10, help='联合包围盒外边距比例')
    ap.add_argument('--thresh', type=int, default=12, help='内容亮度阈值(0-255)')
    ap.add_argument('--pedestal', type=int, default=-1, help='黑场校正电平；-1=逐帧自动(0.5分位)')
    ap.add_argument('--feather', type=float, default=0.14, help='裁切区四边羽化比例(0=关)；视频画幅会硬切辉光，ADD混合下必须渐隐')
    args = ap.parse_args()

    outdir = args.outdir or os.path.dirname(os.path.abspath(args.video))
    os.makedirs(outdir, exist_ok=True)

    # —— 解码 ——
    import imageio
    reader = imageio.get_reader(args.video)
    meta = reader.get_meta_data()
    src_fps = meta.get('fps', 24) or 24
    allf = [f for f in reader]
    reader.close()
    arr = np.stack(allf).astype(np.uint8)
    print('decoded %d frames, fps=%s, size=%sx%s' % (len(arr), src_fps, arr.shape[2], arr.shape[1]))

    # —— 黑场校正：视频编码器会把纯黑抬亮（实测边角亮度 8-9），ADD 混合下会露出取景方框 ——
    # 逐帧逐通道减去黑电平后钳到 0；远场辉光提前归零，近焰辉光保留
    if args.pedestal != 0:
        fixed = np.empty_like(arr)
        peds = []
        for i, f in enumerate(arr):
            ped = (np.array([args.pedestal] * 3, np.float32) if args.pedestal > 0
                   else np.percentile(f.reshape(-1, 3), 0.5, axis=0).astype(np.float32))
            peds.append(ped)
            # 软膝：线性拉伸保持 255 不变，避免整体变暗
            fixed[i] = np.clip((f.astype(np.float32) - ped) * (255.0 / (255.0 - ped.max())), 0, 255).astype(np.uint8)
        arr = fixed
        print('pedestal per-frame (median): %s' % np.median(np.stack(peds), axis=0))
    if args.fps > 0 and src_fps > args.fps:
        step = src_fps / args.fps
        idxs = [int(i * step) for i in range(int(len(arr) / step))]
        arr = arr[idxs]
        print('resampled to %d frames @%sfps' % (len(arr), args.fps))

    boxes = frame_bboxes(arr, args.thresh)

    # —— 有效窗口 ——
    if args.window == 'all':
        i0, i1 = 0, len(arr) - 1
    else:
        # 峰值 = 平均亮度最高帧；结束 = 最后一个有内容的帧
        means = [lum(f.astype(np.float32)).mean() for f in arr]
        i0 = int(np.argmax(means))
        i1 = max(i for i, b in enumerate(boxes) if b is not None)
        if i1 <= i0:
            i1 = len(arr) - 1
    print('window: frames %d..%d (peak %d, content end %d)' % (i0, i1, i0, i1))

    # —— 联合包围盒（全窗口同一取景）——
    ws = [b for b in boxes[i0:i1 + 1] if b]
    if not ws:
        print('FATAL: 窗口内没有检测到内容，调低 --thresh')
        return 1
    L = min(b[0] for b in ws); T = min(b[1] for b in ws)
    R = max(b[2] for b in ws); B = max(b[3] for b in ws)
    mw, mh = int((R - L) * args.margin), int((B - T) * args.margin)
    L, T = max(0, L - mw), max(0, T - mh)
    R = min(arr.shape[2], R + mw); B = min(arr.shape[1], B + mh)
    cw, ch = R - L, B - T
    print('union bbox: (%d,%d)-(%d,%d) %dx%d' % (L, T, R, B, cw, ch))

    # —— 均匀抽 N 格 ——
    n = args.cells
    span = i1 - i0
    picks = [i0 + round(j * span / (n - 1)) for j in range(n)] if span >= n - 1 else list(range(i0, i1 + 1))[:n]
    picks = sorted(set(picks))
    if len(picks) < n:
        print('note: 窗口帧不足，实际 %d 格' % len(picks))

    S = args.size
    scale = min(S / cw, S / ch)
    dw, dh = int(cw * scale), int(ch * scale)
    ox, oy = (S - dw) // 2, (S - dh) // 2

    # 裁切区四边羽化权重（0→1 smoothstep），把被画幅硬切的辉光渐隐掉
    fw, fh = max(2, int(dw * args.feather)), max(2, int(dh * args.feather))
    wx = np.ones(dw, np.float32); wy = np.ones(dh, np.float32)
    for i in range(fw):
        t = (i + 0.5) / fw
        w = t * t * (3 - 2 * t)
        wx[i] *= w; wx[dw - 1 - i] *= w
    for i in range(fh):
        t = (i + 0.5) / fh
        w = t * t * (3 - 2 * t)
        wy[i] *= w; wy[dh - 1 - i] *= w
    win = np.outer(wy, wx)[..., None]

    cell_files = []
    cells = []      # RGB 合成（纯黑底，供审查）
    atlas_cells = []  # RGBA 反预乘（alpha=最大通道，等价 ADD 混合）
    for k, fi in enumerate(picks):
        crop = Image.fromarray(arr[fi]).crop((L, T, R, B)) \
            .resize((dw, dh), Image.LANCZOS)
        ca = np.clip(np.asarray(crop.convert('RGB')).astype(np.float32) * win, 0, 255)
        cell = np.zeros((S, S, 3), np.float32)
        cell[oy:oy + dh, ox:ox + dw] = ca
        cell_img = Image.fromarray(cell.astype(np.uint8))
        # 黑底 → 真透明：alpha 取最大通道，RGB 反除恢复未预乘色（alpha 混合下数学等价 ADD）
        mx = cell.max(axis=2)
        gain = np.where(mx > 0.5, 255.0 / np.maximum(mx, 1.0), 0.0)
        rgb = np.clip(cell * gain[..., None], 0, 255)
        acell = np.dstack([rgb, mx]).astype(np.uint8)
        atlas_cells.append(Image.fromarray(acell, 'RGBA'))
        p = os.path.join(outdir, '%s_cell_%d.png' % (args.prefix, k))
        cell_img.save(p)
        cell_files.append(p)
        cells.append(cell_img)

    # —— 图集（RGBA 反预乘） + frames.json ——
    g = args.grid
    cols = min(g, len(atlas_cells))
    rows = (len(atlas_cells) + cols - 1) // cols
    atlas = Image.new('RGBA', (cols * S, rows * S), (0, 0, 0, 0))
    rect_map = {}
    for k, cell in enumerate(atlas_cells):
        x, y = (k % cols) * S, (k // cols) * S
        atlas.paste(cell, (x, y))
        rect_map['%s_%d' % (args.prefix, k)] = [x, y, S, S]
    apng = os.path.join(outdir, '%s.png' % args.prefix)
    atlas.save(apng)
    jpath = os.path.join(outdir, '%s.frames' % args.prefix)
    with open(jpath, 'w', encoding='utf-8') as f:
        json.dump({'frames': rect_map}, f, ensure_ascii=False, indent=1)

    # —— 接触表（审查用：黑底 + 序号标注） ——
    from PIL import ImageDraw
    sheet = Image.new('RGB', (cols * (S + 8) + 8, rows * (S + 8) + 8), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    for k, cell in enumerate(cells):
        x = 8 + (k % cols) * (S + 8); y = 8 + (k // cols) * (S + 8)
        sheet.paste(cell, (x, y))
        d.text((x + 4, y + 4), str(k), fill=(255, 255, 0))
    sheet.save(os.path.join(outdir, '%s_sheet.png' % args.prefix))

    print('atlas: %s (%dx%d, %d cells)' % (apng, atlas.width, atlas.height, len(cells)))
    print('frames: %s' % jpath)
    return 0


if __name__ == '__main__':
    sys.exit(main())
