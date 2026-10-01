#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
alpha_key.py —— RGB 生图转透明底（中转站 --background transparent 不保证生效时的兜底）

原理：背景基准取四角像素均值；从图像四边出发洪水填充"与边界连通的背景色区"→ alpha=0。
组件内部的深色内饰/描边与外界不连通，不会被误抠。最后对透明边界做 1px 半透明羽化软化硬边。

用法:
  python alpha_key.py <img.png> [more.png ...] [--tol 28] [--feather 1]

第二批复用：生图后若 manifest 记录 mode=RGB，先跑本工具再切片。
"""
import argparse
import os
import sys
from collections import deque

from PIL import Image


def key(path: str, tol: int, feather: int) -> None:
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    br = sum(c[0] for c in corners) // 4
    bg = sum(c[1] for c in corners) // 4
    bb = sum(c[2] for c in corners) // 4

    def isbg(x, y):
        r, g, b, _ = px[x, y]
        return abs(r - br) <= tol and abs(g - bg) <= tol and abs(b - bb) <= tol

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if isbg(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if isbg(x, y) and not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and isbg(nx, ny):
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    removed = 0
    for i in range(w * h):
        if seen[i]:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
            removed += 1

    if feather > 0:
        edge = []
        for y in range(h):
            for x in range(w):
                if px[x, y][3] == 0:
                    continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        edge.append((x, y))
                        break
        for x, y in edge:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 150)

    im.save(path)
    print(f"[ok] {os.path.basename(path)} {w}x{h} 抠除 {removed * 100 // (w * h)}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--tol", type=int, default=28)
    ap.add_argument("--feather", type=int, default=1)
    args = ap.parse_args()
    for f in args.images:
        key(f, args.tol, args.feather)


if __name__ == "__main__":
    main()
