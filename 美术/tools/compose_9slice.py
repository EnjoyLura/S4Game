#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
compose_9slice.py —— 九宫格素材"重排版"规整化（防拉伸变形的核心工具，第二批复用）

问题：生图出的九宫格素材长宽比与游戏渲染比例差好几倍（如血条原图 7:1、游戏 29:1），
九宫格只保证 inset 框内不变形，端头圆弧会被硬拉成尖角。

做法：端头区（左右 cap）按目标高度"等比"缩放（圆弧不变形），中段纯拉伸补到目标宽度，
拼出与游戏渲染比例一致的合成图。运行时（Ux.ts SLICE9）按 canon 尺寸 + scale 换算 insets。

用法:
  python compose_9slice.py            # 按 COMPOSE 表跑全部
  python compose_9slice.py id1,id2    # 只跑指定项

表项: id: (源图, 目标W, 目标H, 源端头宽px, 源上边框px, 源下边框px)
  - 目标 = 2× 设计渲染尺寸（取该素材最大使用尺寸）
  - 输出: ux 游戏目录 + 切图/组件_合成/ 存档
  - 同时打印 Ux.ts SLICE9 表条目（canon/inset/scale）
"""
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CUT = os.path.join(os.path.dirname(HERE), "切图", "组件")
CUT_OUT = os.path.join(os.path.dirname(HERE), "切图", "组件_合成")
UX = "D:/AI/S4Game/KingdomWatch/assets/resources/ux"

# id: (源文件名, 目标W, 目标H, 源端头宽, 源上边框, 源下边框)
COMPOSE = {
    "ui_bar_track":       ("ui_bar_track.png",       1280,  44,  40,  7,  7),
    "ui_bar_fill_white":  ("ui_bar_fill_white.png",  1280,  36,  32,  6,  6),
    "ui_bar_shield":      ("ui_bar_shield.png",      1272,  48,  37,  7,  7),
    "ui_wave_pill":       ("ui_wave_pill.png",        300, 120,  69, 22, 22),
    "ui_tab_item":        ("ui_tab_item.png",         660, 144,  85, 18, 18),
    "ui_tab_item_active": ("ui_tab_item_active.png",  660, 144,  85, 18, 18),
    "ui_banner_warn":     ("ui_banner_warn.png",     1040, 144, 130, 30, 30),
    "ui_banner_title":    ("ui_banner_title.png",    1040, 176, 110, 35, 35),
    "ui_banner_hazard":   ("ui_banner_hazard.png",   1180, 200,  80, 30, 30),
    "ui_panel_dark_gold": ("ui_panel_dark_gold.png", 1436, 140,  60, 16, 16),
    "ui_panel_dark_white":("ui_panel_dark_white.png",1436, 140,  60, 16, 16),
    "ui_btn_primary":          ("ui_btn_primary.png",          600, 176, 60, 20, 20),
    "ui_btn_primary_press":    ("ui_btn_primary_press.png",    600, 176, 60, 20, 20),
    "ui_btn_primary_disabled": ("ui_btn_primary_disabled.png", 600, 176, 60, 20, 20),
    "ui_btn_green":            ("ui_btn_green.png",            600, 176, 60, 20, 20),
    "ui_btn_green_press":      ("ui_btn_green_press.png",      600, 176, 60, 20, 20),
    "ui_btn_green_disabled":   ("ui_btn_green_disabled.png",   600, 176, 60, 20, 20),
    "ui_card_header_white":  ("ui_card_header_white.png",  400, 104, 90, 15, 15),
    "ui_card_header_blue":   ("ui_card_header_blue.png",   400, 104, 90, 15, 15),
    "ui_card_header_purple": ("ui_card_header_purple.png", 400, 104, 90, 15, 15),
}


def compose(pid: str, spec) -> bool:
    src_name, tw, th, cap_src, bt, bb = spec
    src_path = os.path.join(CUT, src_name)
    if not os.path.exists(src_path):
        print(f"[skip] {pid} 源不存在 {src_path}")
        return False
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    k = th / h                      # 端头等比缩放系数（圆弧保形的关键）
    cap = max(1, round(cap_src * k))
    btex = max(1, round(bt * k))
    bbex = max(1, round(bb * k))

    left = im.crop((0, 0, cap_src, h)).resize((cap, th), Image.LANCZOS)
    right = im.crop((w - cap_src, 0, w, h)).resize((cap, th), Image.LANCZOS)
    mid = im.crop((cap_src, 0, w - cap_src, h)).resize((tw - cap * 2, th), Image.LANCZOS)

    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    out.paste(left, (0, 0))
    out.paste(mid, (cap, 0))
    out.paste(right, (tw - cap, 0))

    os.makedirs(CUT_OUT, exist_ok=True)
    out.save(os.path.join(CUT_OUT, pid + ".png"))
    out.save(os.path.join(UX, pid + ".png"))
    print(f'[ok] {pid}: {w}x{h} -> {tw}x{th} cap={cap}tb={btex}/{bbex}')
    print(f'  {pid}: {{ canon: [{tw}, {th}], inset: [{cap}, {cap}, {btex}, {bbex}], scale: 0.5 }},')
    return True


def main():
    only = {s.strip() for s in (sys.argv[1] if len(sys.argv) > 1 else "").split(",") if s.strip()}
    failed = []
    for pid, spec in COMPOSE.items():
        if only and pid not in only:
            continue
        if not compose(pid, spec):
            failed.append(pid)
    print("完成，失败: %s" % (failed or "无"))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
