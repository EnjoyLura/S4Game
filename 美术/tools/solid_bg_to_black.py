#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""solid_bg_to_black.py —— 手动素材纯色底预处理：纯色背景 → 透明（图）/ 黑底（视频）。

手动生成的素材常带纯色底（如哥布林试作为纯红）。mob_video2frames 的亮度内容阈值
与暗边填充种子都按黑底设计，红底会整帧被判为内容、周期检测失效。本工具：
  0. 柱状双底检测：白边+彩色板这类「面板加白边」先裁掉白边，只留面板
     （多色全局抠除会误伤白色系角色细节——牙齿只差白底 86）；
  1. 取画面边缘带的中位色为背景基准；
  2. 从四边洪水填充「与边界连通且接近背景色」的区域 → alpha=0；
  3. alpha 腐蚀 1px 切掉彩边环（红底会在角色轮廓留 1px 红色混色边），再 0.8px 羽化；
  4. 图片直接存 RGBA；视频合成到纯黑后以 crf5 重编码（扁平卡通画面近无损），
     交给 mob_video2frames 按黑底正常检测步态周期与包围盒。

用法:
  python solid_bg_to_black.py <in.png> <out.png> [--tol 60]
  python solid_bg_to_black.py <in.mp4> <out.mp4> [--tol 60]
"""
import argparse
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

KEY_COLOR = (255, 0, 255)


def est_bg(im: Image.Image) -> tuple:
    a = np.asarray(im.convert('RGB'))
    band = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).reshape(-1, 3)
    return tuple(int(v) for v in np.median(band, axis=0))


def detect_panel(f0: np.ndarray, bg: tuple):
    """柱状双底检测（如白边+红板）：返回面板列窗 (L,R)；单色底返回 None。
    面板=一条连续列带，带内 ≥85% 像素远离边缘背景色，宽度 ≥25% 画面，
    且面板主色（顶部样带中位数）≠ 边缘背景色（否则是单色底，裁了反而可能切角色）。"""
    far = (np.abs(f0.astype(np.int16) - np.array(bg, dtype=np.int16)).sum(axis=2) > 90)
    frac = far.mean(axis=0)
    W = len(frac)
    best = None
    x = 0
    while x < W:
        if frac[x] >= 0.85:
            y = x
            while y < W and frac[y] >= 0.85:
                y += 1
            if best is None or y - x > best[1] - best[0]:
                best = (x, y)
            x = y
        else:
            x += 1
    if not best or best[1] - best[0] < W * 0.25:
        return None
    cx = (best[0] + best[1]) // 2
    band = f0[0:60, max(0, cx - 20):cx + 20].reshape(-1, 3)
    panel = tuple(int(v) for v in np.median(band, axis=0))
    if sum(abs(a - b) for a, b in zip(panel, bg)) <= 90:
        return None
    L, R = best[0] + 2, best[1] - 2
    return (L, R) if R - L > 50 else None


def key_to_alpha(f: np.ndarray, bg: tuple, tol: int) -> Image.Image:
    im = Image.fromarray(f).convert('RGB')
    w, h = im.size
    d = ImageDraw.floodfill
    seeds = []
    for x in range(0, w, 48):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, 48):
        seeds += [(0, y), (w - 1, y)]
    px = im.load()
    for s in seeds:
        r, g, b = px[s]
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) <= tol:
            d(im, s, KEY_COLOR, thresh=tol)
    a = np.asarray(im).astype(np.int16)
    flooded = (a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255)
    # 全局兜底：皮带扣孔/武器环扣等「封闭背景区」不与边缘连通，洪水填充够不到；
    # 按背景色全局匹配抠除（容差略宽，吃掉压缩噪声）。角色含同色系色块时需调小 --tol。
    gtol = tol + 30
    near_bg = (np.abs(a[..., 0] - bg[0]) + np.abs(a[..., 1] - bg[1]) + np.abs(a[..., 2] - bg[2])) <= gtol
    alpha = np.where(flooded | near_bg, 0, 255).astype(np.uint8)
    al = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    return Image.fromarray(np.dstack([f, np.asarray(al)]), 'RGBA')


def process_video(src: str, dst: str, tol: int) -> None:
    import imageio
    reader = imageio.get_reader(src)
    fps = reader.get_meta_data().get('fps', 24) or 24
    frames = [f for f in reader]
    reader.close()
    bg = est_bg(Image.fromarray(frames[0]))
    panel = detect_panel(frames[0], bg)
    if panel:
        L, R = panel
        frames = [f[:, L:R] for f in frames]
        bg = est_bg(Image.fromarray(frames[0]))
        print('pillarbox panel detected: cols %d..%d, re-estimated bg %s' % (L, R, bg))
        for i, f in enumerate(frames):
            far = np.abs(f.astype(np.int16) - np.array(bg, dtype=np.int16)).sum(axis=2) > 90
            if far[:, :2].sum() > 200 or far[:, -2:].sum() > 200:
                print('warn: frame %d 内容贴近面板裁剪边，角色可能被切到' % i)
    print('bg color: %s, %d frames @%sfps' % (bg, len(frames), fps))
    writer = imageio.get_writer(dst, fps=fps, codec='libx264', quality=None,
                                output_params=['-pix_fmt', 'yuv420p', '-crf', '5', '-preset', 'medium'])
    removed = 0
    for f in frames:
        rgba = key_to_alpha(f, bg, tol)
        al = np.asarray(rgba.getchannel('A')).astype(np.float32) / 255.0
        black = (f.astype(np.float32) * al[..., None]).astype(np.uint8)
        writer.append_data(black)
        removed += 1
    writer.close()
    print('[ok] %s: %d frames keyed -> %s' % (os.path.basename(src), removed, dst))


def process_image(src: str, dst: str, tol: int) -> None:
    im = Image.open(src).convert('RGB')
    bg = est_bg(im)
    out = key_to_alpha(np.asarray(im), bg, tol)
    out.save(dst)
    n_key = sum(1 for v in out.getchannel('A').getdata() if v == 0)
    print('[ok] %s bg=%s 抠除 %d%% -> %s' % (os.path.basename(src), bg, n_key * 100 // (im.width * im.height), dst))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--tol', type=int, default=60)
    args = ap.parse_args()
    if args.dst.lower().endswith('.png'):
        process_image(args.src, args.dst, args.tol)
    else:
        process_video(args.src, args.dst, args.tol)


if __name__ == '__main__':
    main()
