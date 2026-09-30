#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
art_gen.py —— 批量生图编排（调用 gpt-image-2-skill CLI，沉淀复用）

用法:
  python art_gen.py <batch.json> [--only id1,id2] [--dry] [--retry 2]

batch.json 结构:
{
  "name": "批次1_2026-10-01",
  "outdir": "D:/AI/S4Game/美术/原图/批次1_2026-10-01",
  "defaults": { "model": "gpt-image-2", "quality": "high",
                "background": "transparent", "key": "1k", "size": "1k" },
  "items": [
    { "id": "G1_图标A", "type": "generate", "prompt": "..." },
    { "id": "X_图生图", "type": "edit", "ref": "D:/.../基准.png", "prompt": "..." },
    { "id": "SCENE",    "type": "generate", "key": "2k", "size": "1152x2048" }
  ]
}

- size 别名: "1k"=1024x1024, "2k"=2048x2048, 或显式 "WxH"（两边均为16的倍数）
- key: "1k" / "2k" → CLI provider supergpt-1k / supergpt-2k（provider 配置在 CLI 共享配置中，key 不落仓库）
- 每项生成后实测像素尺寸并记录到 <outdir>/manifest.json（中转站不保证请求尺寸，必须实测）
"""
import argparse, json, os, subprocess, sys, time, hashlib

CLI = "gpt-image-2-skill"
# Windows 下 npm 全局是 .cmd shim，CreateProcess 直接调会 WinError 2；优先找真实 exe
_EXE_CANDIDATES = [
    os.path.expandvars(r"%APPDATA%\npm\node_modules\gpt-image-2-skill\node_modules"
                       r"\gpt-image-2-skill-windows-x64-msvc\bin\gpt-image-2-skill.exe"),
    r"C:\Program Files\nodejs\gpt-image-2-skill.exe",
]
CLI_EXE = next((p for p in _EXE_CANDIDATES if os.path.exists(p)), CLI)
PROVIDER = {"1k": "supergpt-1k", "2k": "supergpt-2k"}
SIZE_ALIAS = {"1k": "1024x1024", "2k": "2048x2048"}


def run_gen(item, defaults, out_png):
    key = item.get("key", defaults.get("key", "1k"))
    size = item.get("size", defaults.get("size", "1k"))
    size = SIZE_ALIAS.get(size, size)
    model = item.get("model", defaults.get("model", "gpt-image-2"))
    quality = item.get("quality", defaults.get("quality", "high"))
    background = item.get("background", defaults.get("background", "transparent"))
    provider = PROVIDER[key]
    typ = item.get("type", "generate")

    cmd = [CLI_EXE, "--json", "--provider", provider]
    if typ == "edit":
        cmd += ["images", "edit", "--ref-image", item["ref"]]
    else:
        cmd += ["images", "generate"]
    cmd += ["--model", model, "--prompt", item["prompt"], "--out", out_png,
            "--format", "png", "--size", size, "--quality", quality,
            "--background", background]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = p.returncode == 0 and '"ok": true' in p.stdout
    return ok, cmd, p.stdout + p.stderr


def img_info(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.size, im.mode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("batch")
    ap.add_argument("--only", default="")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--retry", type=int, default=2)
    args = ap.parse_args()

    with open(args.batch, encoding="utf-8") as f:
        cfg = json.load(f)
    outdir = cfg["outdir"]
    os.makedirs(outdir, exist_ok=True)
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    mpath = os.path.join(outdir, "manifest.json")
    manifest = {}
    if os.path.exists(mpath):
        with open(mpath, encoding="utf-8") as f:
            manifest = json.load(f)

    for item in cfg["items"]:
        iid = item["id"]
        if only and iid not in only:
            continue
        out_png = os.path.join(outdir, iid + ".png")
        if args.dry:
            print("[dry] %s -> %s" % (iid, out_png))
            continue
        if os.path.exists(out_png) and manifest.get(iid, {}).get("ok"):
            print("[skip] %s 已存在" % iid)
            continue
        t0 = time.time()
        entry = {"id": iid, "file": out_png, "prompt": item["prompt"],
                 "type": item.get("type", "generate"), "ref": item.get("ref"),
                 "at": time.strftime("%Y-%m-%d %H:%M:%S")}
        ok, cmd, raw = False, [], ""
        for attempt in range(1, args.retry + 2):
            ok, cmd, raw = run_gen(item, cfg.get("defaults", {}), out_png)
            if ok and os.path.exists(out_png):
                break
            print("[retry %d] %s 失败" % (attempt, iid))
            time.sleep(3 * attempt)
        if ok and os.path.exists(out_png):
            (w, h), mode = img_info(out_png)
            entry.update(ok=True, width=w, height=h, mode=mode,
                         seconds=round(time.time() - t0, 1),
                         sha1=hashlib.sha1(open(out_png, "rb").read()).hexdigest()[:12])
            print("[done] %s %dx%d %s (%.0fs)" % (iid, w, h, mode, time.time() - t0))
        else:
            entry.update(ok=False, error=(raw[-800:] if raw else "no output"))
            print("[FAIL] %s" % iid)
        manifest[iid] = entry
        with open(mpath, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

    bad = [k for k, v in manifest.items() if not v.get("ok")]
    print("manifest: %d 项, 失败 %d" % (len(manifest), len(bad)))
    sys.exit(1 if bad and not args.dry else 0)


if __name__ == "__main__":
    main()
