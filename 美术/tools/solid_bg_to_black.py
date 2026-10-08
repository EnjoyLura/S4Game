#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""solid_bg_to_black.py —— 手动素材纯色底预处理：纯色背景 → 透明（图）/ 黑底（视频）。

手动生成的素材常带纯色底（如哥布林试作为纯红）。mob_video2frames 的亮度内容阈值
与暗边填充种子都按黑底设计，红底会整帧被判为内容、周期检测失效。本工具：
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
