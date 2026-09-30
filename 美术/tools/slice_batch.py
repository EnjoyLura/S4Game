#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
slice_batch.py —— 按配置批量切片（art_slice.py 的编排层，第二批复用）

用法:
  python slice_batch.py slice1.json [--batch <原图批次目录>] [--only sheet1,sheet2]

slice JSON 结构:
{
  "batch": "D:/AI/S4Game/美术/原图/批次1_2026-10-01",   ← 也可用 --batch 覆盖
  "ux":    "D:/AI/S4Game/KingdomWatch/assets/resources/ux",
  "sheets": [
    { "sheet": "G1_图标A", "cols": 3, "rows": 3, "scale": 0.5,
      "out": "图标", "copy": "ux",       ← copy: "ux"=游戏目录 / null=不复制
      "names": ["ui_icon_coin", ...] },  ← 行优先；""=跳过该格
    ...
  ]
}
"""
import argparse, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config")
    ap.add_argument("--batch", default="")
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = json.load(f)
    batch = args.batch or cfg["batch"]
    ux = cfg.get("ux", "")
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    failed = []

    for sh in cfg["sheets"]:
        if only and sh["sheet"] not in only:
            continue
        sheet_png = os.path.join(batch, sh["sheet"] + ".png")
        if not os.path.exists(sheet_png):
            print("[skip] %s 原图不存在" % sh["sheet"])
            failed.append(sh["sheet"])
            continue
        outdir = os.path.join(os.path.dirname(HERE), "切图", sh["out"])
        copy = ""
        if sh.get("copy") == "ux" and ux:
            copy = ux
        elif sh.get("copy") == "scenes":
            copy = os.path.join(os.path.dirname(ux), "scenes")
        elif sh.get("copy") and sh.get("copy") != "ux":
            copy = os.path.join(os.path.dirname(HERE), "切图", sh["copy"])
        cmd = [sys.executable, os.path.join(HERE, "art_slice.py"),
               "--sheet", sheet_png, "--cols", str(sh["cols"]), "--rows", str(sh["rows"]),
               "--names", ",".join(sh["names"]), "--out", outdir]
        if copy:
            cmd += ["--copy", copy]
        if sh.get("scale"):
            cmd += ["--scale", str(sh["scale"])]
        if sh.get("pad"):
            cmd += ["--pad", str(sh["pad"])]
        if sh.get("largest", True):
            cmd += ["--largest"]
        print("== %s ==" % sh["sheet"])
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(p.stdout.strip() or p.stderr.strip())
        if p.returncode != 0:
            failed.append(sh["sheet"])
    print("完成，失败: %s" % (failed or "无"))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
