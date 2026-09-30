#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
art_slice.py —— 批量图切片：网格切格 → alpha 裁边 → 可选缩放 → 落盘（可同步游戏资源目录）

用法:
  python art_slice.py --sheet <原图.png> --cols 3 --rows 3 \
      --names ui_icon_coin,ui_icon_exp,... \
      --out <切图目录> [--copy <游戏资源目录>] [--scale 0.5] [--pad 0]

- names 按行优先（row-major）与网格对应；名字即输出文件名（.png）
- 透明底批量图：每格先按 alpha>8 求包围盒裁边，再可选四周补 pad 像素
- --scale: 统一缩放（如 0.5 → 从 ~1254 表切出的图标降到 @2x 设计尺寸附近）
- 同名文件覆盖；--copy 目录不存在会自动创建
"""
import argparse, os
from PIL import Image

ALPHA_MIN = 8


def largest_component(im):
    """只保留最大 alpha 连通域（丢弃邻格溢入的碎片）；sparkle 等小组件会被去掉"""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    W, H = im.size
    a = list(im.getchannel("A").getdata())
    seen = bytearray(W * H)
    best, best_size = None, 0
    for start in range(W * H):
        if a[start] <= ALPHA_MIN or seen[start]:
            continue
        comp = []
        stack = [start]
        seen[start] = 1
        while stack:
            p = stack.pop()
            comp.append(p)
            x, y = p % W, p // W
            for q in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= q[0] < W and 0 <= q[1] < H:
                    i2 = q[1] * W + q[0]
                    if not seen[i2] and a[i2] > ALPHA_MIN:
                        seen[i2] = 1
                        stack.append(i2)
        if len(comp) > best_size:
            best, best_size = comp, len(comp)
    if best and best_size < W * H:
        px = im.load()
        comp_set = set(best)
        for i in range(W * H):
            if a[i] > ALPHA_MIN and i not in comp_set:
                x, y = i % W, i // W
                px[x, y] = (0, 0, 0, 0)
    return im


def trim(im):
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    a = im.getchannel("A").point(lambda v: 255 if v > ALPHA_MIN else 0)
    bbox = a.getbbox()
    return im.crop(bbox) if bbox else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", required=True)
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--names", required=True, help="逗号分隔，行优先；空名=跳过该格")
    ap.add_argument("--out", required=True)
    ap.add_argument("--copy", default="")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--pad", type=int, default=0)
    ap.add_argument("--largest", action="store_true", help="每格仅保留最大 alpha 连通域（去邻格污染）")
    args = ap.parse_args()

    names = [n.strip() for n in args.names.split(",")]
    assert len(names) == args.cols * args.rows, "names 数(%d) != cols*rows(%d)" % (len(names), args.cols * args.rows)

    im = Image.open(args.sheet)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    W, H = im.size
    cw, ch = W // args.cols, H // args.rows
    os.makedirs(args.out, exist_ok=True)
    if args.copy:
        os.makedirs(args.copy, exist_ok=True)

    report = []
    for idx, name in enumerate(names):
        if not name:
            continue
        r, c = divmod(idx, args.cols)
        cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        if args.largest:
            cell = largest_component(cell)
        out = trim(cell)
        if args.pad:
            w, h = out.size
            canvas = Image.new("RGBA", (w + args.pad * 2, h + args.pad * 2), (0, 0, 0, 0))
            canvas.paste(out, (args.pad, args.pad), out)
            out = canvas
        if args.scale != 1.0:
            out = out.resize((max(1, round(out.size[0] * args.scale)),
                              max(1, round(out.size[1] * args.scale))), Image.LANCZOS)
        dst = os.path.join(args.out, name + ".png")
        out.save(dst)
        if args.copy:
            out.save(os.path.join(args.copy, name + ".png"))
        report.append("%s %dx%d" % (name, *out.size))
    print("\n".join(report))
    print("共 %d 张 -> %s" % (len(report), args.out))


if __name__ == "__main__":
    main()
