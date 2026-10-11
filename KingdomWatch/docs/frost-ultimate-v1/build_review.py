"""Reproducible offline frost-ultimate review; no game/runtime files are changed.

One H3 clip supplies all crystal motion. Fixed extraction/projection/anchor,
then an eight-cel root-outward onset and deterministic ice rain. The spreading
cold wave was removed at the user's request before game integration. Monster walking/tint use the existing game assets.
"""
from pathlib import Path
import json
import math
import random
import re

import imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
RES = GAME / "assets/resources"
CELL = 256
ANCHOR = (124, 116)
PREFIX = "frost_ultimate_impact_v1"
FPS = 30
CAST_SECONDS = 2.0
PRE_ROLL = 0.3
POST_ROLL = 0.4
LANCZOS = Image.Resampling.LANCZOS
FONT = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 17)
SMALL = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 14)


def rgba_opacity(im, amount):
    if amount >= 0.999:
        return im
    out = im.copy()
    out.putalpha(im.getchannel("A").point(lambda a: round(a * max(0, amount))))
    return out


def smoothstep(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def extract_sequence():
    source = OUT / "sequence-source"
    mapping = json.loads((source / f"{PREFIX}.frames").read_text(encoding="utf-8"))
    original = Image.open(source / f"{PREFIX}.png").convert("RGBA")
    # A single ground-plane projection, shared by every cel; no per-frame fit.
    fy = 0.70
    native = []
    for x, y, w, h in mapping["frames"].values():
        cel = original.crop((x, y, x + w, y + h))
        cel = cel.transform((CELL, CELL), Image.Transform.AFFINE,
                            (1, 0, 0, 0, 1 / fy, ANCHOR[1] * (1 - 1 / fy)),
                            resample=Image.Resampling.BICUBIC)
        native.append(cel)

    yy, xx = np.mgrid[:CELL, :CELL]
    radius = np.sqrt((xx - ANCHOR[0]) ** 2 + ((yy - ANCHOR[1]) / 0.63) ** 2)
    first = np.asarray(native[0]).copy()
    onset = []
    for i in range(8):
        p = (i + 1) / 8
        reveal = 1 - smoothstep(p * 138 - 9, p * 138 + 9, radius)
        arr = first.copy()
        arr[:, :, 3] = np.round(arr[:, :, 3] * reveal * smoothstep(0, 0.35, p)).astype("uint8")
        onset.append(Image.fromarray(arr))
    # End residual compression haze without touching the crystal trajectories.
    for i in range(48, 56):
        native[i] = rgba_opacity(native[i], (1 - (i - 48) / 7) ** 1.35)
    native[-1] = Image.new("RGBA", (CELL, CELL))
    cels = onset + native
    durations = [0.02] * 8 + [0.015] * 24 + [0.026875] * 32
    boundaries = np.cumsum(durations)
    sequence = OUT / "sequence"
    sequence.mkdir(exist_ok=True)
    atlas = Image.new("RGBA", (CELL * 8, CELL * 8))
    frame_map = {}
    frame_dir = sequence / "frames-alpha"
    frame_dir.mkdir(exist_ok=True)
    for i, im in enumerate(cels):
        x, y = i % 8 * CELL, i // 8 * CELL
        atlas.paste(im, (x, y))
        frame_map[f"{PREFIX}_{i}"] = [x, y, CELL, CELL]
        im.save(frame_dir / f"impact-{i:03d}.png")
    atlas.save(sequence / f"{PREFIX}.png")
    metadata = {
        "frames": frame_map, "frameCount": len(cels), "cellSize": [CELL, CELL],
        "groundAnchorPixels": list(ANCHOR), "frameDurations": durations,
        "duration": float(boundaries[-1]), "sourceVideo": "../raw/impact-2s.mp4",
        "sourceFps": 24, "sourceFrameCount": 56, "sourceDuration": 56 / 24,
        "sourceSize": [768, 1344], "requestedRatio": "1:1",
        "cropPolicy": "fixed whole-clip union bbox (0,131)-(768,1344), uniform fit",
        "projection": {"yScale": fy, "pivot": list(ANCHOR), "fixedForAllFrames": True},
        "onset": "8 cels / 0.16s, existing first cel revealed from its fixed ground root",
        "nativeFrameOrderPreserved": True, "pedestal": 7, "edgeFeather": 0.05,
        "blend": "straight RGBA / SRC_ALPHA / ONE_MINUS_SRC_ALPHA",
        "gameIntegrated": True, "status": "integrated-without-cold-wave; awaiting-in-game-user-review",
    }
    (sequence / f"{PREFIX}.frames.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    sheet = Image.new("RGB", (1024, 4 * 244 + 45), "#243039")
    d = ImageDraw.Draw(sheet)
    d.text((14, 12), "碎冰命中 · 固定取景 / 连续视频 / 根部展开", fill="#dbedf5", font=FONT)
    for k, i in enumerate(np.linspace(0, len(cels) - 1, 16).round().astype(int)):
        x, y = k % 4 * 256, 45 + k // 4 * 244
        tile = Image.new("RGBA", (256, 220), "#33414b")
        tile.alpha_composite(cels[i].resize((220, 220), LANCZOS), (18, 0))
        sheet.paste(tile.convert("RGB"), (x, y))
        d.text((x + 10, y + 223), f"#{i:02d} / {sum(durations[:i]):.2f}s", fill="#dbedf5", font=SMALL)
    sheet.save(OUT / "impact-contact-sheet.jpg", quality=94)
    return cels, boundaries, metadata


if __name__ == "__main__":
    CELS, BOUNDARIES, SEQUENCE_META = extract_sequence()
else:
    # Also usable as a read-only source of existing ground/monster compositors.
    SEQUENCE_META = json.loads((RES / f"fx/{PREFIX}.frames.json").read_text(encoding="utf-8"))
    source_atlas = Image.open(RES / f"fx/{PREFIX}.png").convert("RGBA")
    CELS = [source_atlas.crop((x, y, x + w, y + h))
            for x, y, w, h in SEQUENCE_META["frames"].values()]
    BOUNDARIES = np.cumsum(SEQUENCE_META["frameDurations"])
IMPACT_SECONDS = float(BOUNDARIES[-1])
MOB_ATLAS = Image.open(RES / "ux/battle_mob_anim_v1.png").convert("RGBA")
MOB_META = json.loads((RES / "ux/battle_mob_anim_v1.frames.json").read_text(encoding="utf-8"))
HERO_ATLAS = Image.open(RES / "ux/battle_heroes_v2.png").convert("RGBA")
HERO_META = json.loads((RES / "ux/battle_heroes_v2.frames.json").read_text(encoding="utf-8"))
GROUND = Image.open(RES / "scenes/scene_1_1.png").convert("RGB")
MOB_CACHE = {}
IMPACT_CACHE = {}


def crop_rect(atlas, rect):
    x, y, w, h = rect
    return atlas.crop((x, y, x + w, y + h))


def slow_tint(im):
    arr = np.asarray(im).copy()
    rgb = arr[:, :, :3].astype(float) / 255
    light = rgb @ np.array([0.299, 0.587, 0.114])
    ice = np.clip(light[:, :, None] * np.array([0.60, 0.90, 1.28]) + np.array([0.02, 0.04, 0.07]), 0, 1)
    arr[:, :, :3] = np.round((rgb * 0.62 + ice * 0.38) * 255).astype("uint8")
    return Image.fromarray(arr)


def mob_cel(mob, elapsed, slowed):
    name = mob["kind"]
    walk_keys = [k for k in MOB_META["frames"] if re.fullmatch(re.escape(name) + r"_w\d+", k)]
    walk_keys.sort(key=lambda k: int(k.rsplit("w", 1)[1]))
    clock = elapsed if elapsed < 0 else elapsed * 0.5
    tempo = min(1.25, max(0.75, mob["speed"] / 45))
    phase = (mob["phase"] + clock * tempo / MOB_META["cycles"][name]) % 1
    idx = int(phase * len(walk_keys)) % len(walk_keys)
    height = mob["height"]
    key = (name, idx, height, slowed)
    if key not in MOB_CACHE:
        im = crop_rect(MOB_ATLAS, MOB_META["frames"][walk_keys[idx]])
        if slowed:
            im = slow_tint(im)
        MOB_CACHE[key] = im.resize((height, height), LANCZOS)
    return MOB_CACHE[key], idx


def mob_position(mob, t):
    # Snapshot impacts stay fixed; a slowed walker continues moving naturally.
    delta = t if t < 0 else t * 0.5
    return mob["x"], mob["y"] + delta * mob["speed"] * 0.85


def draw_monster(canvas, mob, t):
    im, idx = mob_cel(mob, t, t >= 0)
    x, foot_y = mob_position(mob, t)
    height = mob["height"]
    offset = MOB_META["ground"][mob["kind"]]["offset"]
    bottom = foot_y + height * offset
    canvas.alpha_composite(im, (round(x - height / 2), round(bottom - height)))


def make_impact_parts(width):
    if width not in IMPACT_CACHE:
        parts = []
        yy = np.mgrid[:CELL, :CELL][0]
        front_mask = smoothstep(ANCHOR[1] + 1, ANCHOR[1] + 4, yy)
        for im in CELS:
            arr = np.asarray(im).copy()
            back, front = arr.copy(), arr.copy()
            back[:, :, 3] = np.round(arr[:, :, 3] * (1 - front_mask)).astype("uint8")
            front[:, :, 3] = np.round(arr[:, :, 3] * front_mask).astype("uint8")
            parts.append((Image.fromarray(back).resize((width, width), LANCZOS),
                          Image.fromarray(front).resize((width, width), LANCZOS)))
        IMPACT_CACHE[width] = parts
    return IMPACT_CACHE[width]


def draw_impact(canvas, hit, t, front=False):
    age = t - hit["start"]
    if age < 0 or age >= IMPACT_SECONDS:
        return
    idx = min(len(CELS) - 1, int(np.searchsorted(BOUNDARIES, age, side="right")))
    width = hit["width"]
    im = make_impact_parts(width)[idx][1 if front else 0]
    point = (round(hit["x"] - ANCHOR[0] * width / CELL),
             round(hit["y"] - ANCHOR[1] * width / CELL))
    canvas.alpha_composite(rgba_opacity(im, hit["opacity"]), point)


# Reuse the central blade's painted facets. The side blades remain in the
# source; this fixed silhouette isolates one rain needle without new AI calls.
SHARD_ATLAS = Image.open(RES / "fx/frost_ice_v4.png").convert("RGBA")
RAIN_SOURCE = SHARD_ATLAS.crop((512, 512, 1024, 1024))
rain_mask = Image.new("L", RAIN_SOURCE.size)
ImageDraw.Draw(rain_mask).polygon(
    [(264, 111), (281, 218), (273, 268), (246, 321), (223, 263), (220, 210)], fill=255)
RAIN_SOURCE.putalpha(Image.fromarray(np.minimum(np.asarray(RAIN_SOURCE.getchannel("A")), np.asarray(rain_mask))))
RAIN_SOURCE = RAIN_SOURCE.crop((218, 109, 283, 323))
if __name__ == "__main__":
    RAIN_SOURCE.save(OUT / "rain-needle.png")
RAIN_CACHE = {}


def rain_sprite(height):
    if height not in RAIN_CACHE:
        width = max(6, round(height * RAIN_SOURCE.width / RAIN_SOURCE.height))
        RAIN_CACHE[height] = RAIN_SOURCE.resize((width, height), LANCZOS).rotate(200, resample=Image.Resampling.BICUBIC, expand=True)
    return RAIN_CACHE[height]


def draw_rain(canvas, drops, t):
    trail = Image.new("RGBA", canvas.size)
    d = ImageDraw.Draw(trail)
    visible = []
    for drop in drops:
        u = (t - drop["start"]) / drop["flight"]
        if u < 0 or u >= 1:
            continue
        distance = drop["travel"] * (1 - u)
        x = drop["x"] - distance * 0.38
        y = drop["y"] - distance * 0.925
        fade = float(smoothstep(0, 0.13, u) * (1 - smoothstep(0.87, 1, u)))
        for i in range(7):
            a = round(62 * fade * (1 - i / 7) ** 1.7)
            d.line((x - 0.38 * i * 8, y - 0.925 * i * 8,
                    x - 0.38 * (i + 1) * 8, y - 0.925 * (i + 1) * 8),
                   fill=(159, 226, 253, a), width=2)
        visible.append((x, y, drop, fade))
    canvas.alpha_composite(trail)
    for x, y, drop, fade in visible:
        im = rgba_opacity(rain_sprite(drop["height"]), fade * 0.89)
        canvas.alpha_composite(im, (round(x - im.width / 2), round(y - im.height / 2)))


def contact_glows(canvas, mobs, t):
    if t < 0 or t > 0.22:
        return
    layer = Image.new("RGBA", canvas.size)
    d = ImageDraw.Draw(layer)
    fade = (1 - t / 0.22) ** 1.5
    for m in mobs:
        x, y = m["x"], m["y"]
        d.ellipse((x - 18, y - 7, x + 18, y + 7), fill=(170, 231, 255, round(80 * fade)))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(3)))


def caster(canvas, t, point):
    x, y = point
    frame = "mora_attack" if 0 <= t < 0.34 else "mora_idle"
    im = crop_rect(HERO_ATLAS, HERO_META["frames"][frame])
    im = im.resize((round(im.width * 102 / im.height), 102), LANCZOS)
    canvas.alpha_composite(im, (round(x - im.width / 2), round(y - im.height)))
    if 0 <= t < 0.42:
        # Staff-adjacent small cold glint, not a cinematic lens star.
        glow = Image.new("RGBA", canvas.size)
        d = ImageDraw.Draw(glow)
        a = round(170 * math.sin(math.pi * t / 0.42))
        for r, mul in ((13, 0.2), (8, 0.5), (3, 0.95)):
            d.ellipse((x + 19 - r, y - 79 - r, x + 19 + r, y - 79 + r), fill=(184, 242, 255, round(a * mul)))
        canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(1)))


SPEEDS = {"goblin_worker": 30, "goblin_slinger": 22.5, "goblin_shaman": 25,
          "wolf_rider": 47.5, "goblin_brute": 17.5}
RADII = {"goblin_worker": 22, "goblin_slinger": 20, "goblin_shaman": 24,
         "wolf_rider": 24, "goblin_brute": 34}


def make_mob(kind, x, y, phase, scale=0.9):
    return {"kind": kind, "x": x, "y": y, "phase": phase,
            "speed": SPEEDS[kind], "height": round(RADII[kind] * 3.85 * scale)}


def scene_specs():
    sparse = [
        make_mob("goblin_worker", 167, 213, 0.13),
        make_mob("goblin_slinger", 403, 243, 0.46),
        make_mob("goblin_shaman", 297, 362, 0.20),
        make_mob("goblin_brute", 470, 445, 0.67),
        make_mob("goblin_worker", 153, 510, 0.90),
        make_mob("wolf_rider", 319, 641, 0.62),
        make_mob("goblin_worker", 472, 687, 0.36),
    ]
    rng = random.Random(7317)
    kinds = ["goblin_worker", "goblin_slinger", "goblin_worker", "goblin_shaman",
             "goblin_worker", "wolf_rider", "goblin_worker", "goblin_brute"]
    dense = []
    for row in range(5):
        for col in range(5):
            x = 133 + col * 84 + rng.uniform(-19, 19)
            y = 193 + row * 109 + rng.uniform(-19, 19)
            kind = kinds[(row * 5 + col) % len(kinds)]
            dense.append(make_mob(kind, x, y, rng.random(), 0.87))
    single = [make_mob("goblin_worker", 263, 319, 0.22, 1.25)]
    return {"single": single, "sparse": sparse, "dense": dense}


def select_hits(mobs, cap=8):
    if len(mobs) <= cap:
        selected = mobs
    else:
        # Spatially distributed bursts; nearby walkers share the visual only.
        selected = [min(mobs, key=lambda m: m["y"])]
        while len(selected) < cap:
            remain = [m for m in mobs if m not in selected]
            selected.append(max(remain, key=lambda m: min(
                (m["x"] - n["x"]) ** 2 + (m["y"] - n["y"]) ** 2 for n in selected)))
    hits = []
    for i, mob in enumerate(selected):
        hits.append({"x": mob["x"], "y": mob["y"],
                     "start": 0.035 + (i % 3) * 0.025,
                     "width": 156 if mob["kind"] == "goblin_brute" else 136,
                     "opacity": 0.88 if len(mobs) > 8 else 0.94})
    if len(mobs) == 1:
        hits[0].update({"start": 0, "width": 185, "opacity": 1.0})
    return hits


def make_drops(mobs, hits):
    rng = random.Random(1643)
    drops = []
    # Main rain is distributed over the battlefield, not sustained repeatedly
    # on one monster. Its visual contacts do not imply extra damage ticks.
    for i in range(56):
        if i < len(hits):
            x, y = hits[i]["x"], hits[i]["y"]
        else:
            x, y = rng.uniform(85, 560), rng.uniform(160, 718)
        start = 0.21 + i / 56 * 0.65 + rng.uniform(-0.035, 0.035)
        drops.append({"x": x, "y": y, "start": start,
                      "flight": rng.uniform(0.15, 0.22), "travel": rng.uniform(118, 178),
                      "height": rng.randint(31, 50)})
    return drops


def draw_chips(canvas, hits, t):
    """Small deterministic low arcs continue the painted crystals' motion."""
    for n, hit in enumerate(hits):
        age = t - hit["start"] - 0.16
        if age <= 0 or age >= 0.80:
            continue
        for i in range(5):
            angle = i / 5 * math.tau + n * 0.71
            u = min(1, age / (0.52 + i * 0.045))
            distance = (22 + i * 5) * (1 - (1 - u) ** 2)
            hop = 11 * math.sin(u * math.pi)
            x = hit["x"] + math.cos(angle) * distance
            y = hit["y"] + math.sin(angle) * distance * 0.55 - hop
            opacity = float(smoothstep(0, 0.09, age) * (1 - smoothstep(0.30, 0.72, age))) * 0.74
            height = 7 + i % 3 * 2
            im = rain_sprite(height).rotate(i * 61, resample=Image.Resampling.BICUBIC, expand=True)
            im = rgba_opacity(im, opacity)
            canvas.alpha_composite(im, (round(x - im.width / 2), round(y - im.height / 2)))


SPECS = scene_specs()
SCENE_INFO = {}


def prepare_scene(name):
    mobs = SPECS[name]
    size = (512, 512) if name == "single" else (640, 960)
    if name == "single":
        ground = GROUND.crop((242, 749, 910, 1417)).resize(size, LANCZOS)
        hero_point = None
    else:
        ground = GROUND.crop((16, 180, 1136, 1860)).resize(size, LANCZOS)
        hero_point = (320, 877)
    hits = select_hits(mobs)
    drops = [] if name == "single" else make_drops(mobs, hits)
    SCENE_INFO[name] = {"enemyCount": len(mobs), "aiImpactInstances": len(hits),
                        "rainEvents": len(drops), "size": list(size), "hits": hits}

    def render(t, effects=True):
        canvas = ground.convert("RGBA")
        shadows = Image.new("RGBA", size)
        d = ImageDraw.Draw(shadows)
        for mob in mobs:
            x, y = mob_position(mob, t)
            r = mob["height"] / 3.85
            d.ellipse((x - r, y - r * .22, x + r, y + r * .22), fill=(47, 34, 23, 72))
        if hero_point:
            x, y = hero_point
            d.ellipse((x - 26, y - 7, x + 26, y + 7), fill=(47, 34, 23, 72))
        canvas.alpha_composite(shadows.filter(ImageFilter.GaussianBlur(1.4)))
        if effects:
            contact_glows(canvas, mobs, t)
            for hit in hits:
                draw_impact(canvas, hit, t)
        for mob in sorted(mobs, key=lambda m: mob_position(m, t)[1]):
            draw_monster(canvas, mob, t)
        if hero_point:
            caster(canvas, t if effects else -1, hero_point)
        if effects:
            for hit in hits:
                draw_impact(canvas, hit, t, front=True)
            draw_chips(canvas, hits, t)
            draw_rain(canvas, drops, t)
        return canvas.convert("RGB")

    return render


def gif_and_video(name, render):
    times = np.arange(round((PRE_ROLL + CAST_SECONDS + POST_ROLL) * FPS)) / FPS - PRE_ROLL
    images = [render(float(t)) for t in times]
    filename = "single-impact-preview" if name == "single" else f"ultimate-{name}-preview"
    # Shared palette preserves hues and prevents frame-to-frame palette flicker.
    sample_indices = np.linspace(0, len(images) - 1, 8).round().astype(int)
    palette_sheet = Image.new("RGB", (images[0].width * 4, images[0].height * 2))
    for k, idx in enumerate(sample_indices):
        palette_sheet.paste(images[idx], (k % 4 * images[0].width, k // 4 * images[0].height))
    palette = palette_sheet.quantize(colors=255)
    # Pillow's fast per-image palette cache may quantize the identical road
    # differently when foreground pixels change. A shared 6-bit RGB lookup
    # makes the mapping deterministic and reserves index 255 for GIF deltas.
    colors = np.asarray(palette.getpalette(), dtype="float32").reshape(-1, 3)[:255]
    lookup = np.empty(64 ** 3, dtype="uint8")
    color_energy = np.sum(colors * colors, axis=1)
    for first in range(0, len(lookup), 8192):
        indices = np.arange(first, min(first + 8192, len(lookup)))
        points = np.stack((indices // 4096, (indices // 64) % 64, indices % 64), axis=1).astype("float32") * 4 + 2
        distances = np.sum(points * points, axis=1)[:, None] + color_energy[None, :] - 2 * (points @ colors.T)
        lookup[first:first + len(indices)] = np.argmin(distances, axis=1)
    indexed = []
    for im in images:
        rgb = np.asarray(im).astype("uint32") >> 2
        indices = lookup[rgb[:, :, 0] * 4096 + rgb[:, :, 1] * 64 + rgb[:, :, 2]]
        qim = Image.fromarray(indices).convert("P")
        qim.putpalette(palette.getpalette())
        qim.info["transparency"] = 255
        indexed.append(qim)
    durations_ms = [(round((i + 1) * 100 / FPS) - round(i * 100 / FPS)) * 10 for i in range(len(images))]
    indexed[0].save(OUT / f"{filename}.gif", save_all=True, append_images=indexed[1:],
                    duration=durations_ms, loop=0, optimize=True, disposal=1, transparency=255)
    writer = imageio.get_writer(str(OUT / f"{filename}.mp4"), fps=FPS, codec="libx264",
                                quality=9, macro_block_size=1, pixelformat="yuv420p")
    for im in images:
        writer.append_data(np.asarray(im))
    writer.close()
    # Static review demonstrates the motion phases and the final clear road.
    picked = [0.0, 0.13, 0.33, 0.6, 0.9, 1.3, 1.7, 2.0]
    scale = 0.5 if name != "single" else 0.62
    sw, sh = round(images[0].width * scale), round(images[0].height * scale)
    sheet = Image.new("RGB", (sw * 4, (sh + 27) * 2 + 42), "#25313a")
    d = ImageDraw.Draw(sheet)
    label = {"single": "单体命中", "sparse": "少量敌人 · 7 个目标",
             "dense": f"密集敌人 · 25 个目标 / {SCENE_INFO[name]['aiImpactInstances']} 处碎冰"}[name]
    d.text((12, 11), f"{label} · 两秒离线演出", fill="#dbeef7", font=FONT)
    for k, t in enumerate(picked):
        x, y = k % 4 * sw, 42 + k // 4 * (sh + 27)
        sheet.paste(render(t).resize((sw, sh), LANCZOS), (x, y))
        d.text((x + 8, y + sh + 4), f"{t:.2f}s", fill="#dbeef7", font=SMALL)
    sheet.save(OUT / f"{filename}-keyframes.jpg", quality=94)
    render(0.37).save(OUT / f"{filename}.png")
    # At 2s the effect has vanished; walkers/tint are still present by design.
    clean = np.asarray(render(2.0, effects=False))
    final = np.asarray(render(2.0, effects=True))
    SCENE_INFO[name].update({"gif": f"{filename}.gif", "video": f"{filename}.mp4",
                             "previewDuration": sum(durations_ms) / 1000,
                             "castDuration": CAST_SECONDS,
                             "finalEffectPixelDifference": int(np.abs(final.astype(int) - clean.astype(int)).max())})
    print(json.dumps({"scene": name, **SCENE_INFO[name]}, ensure_ascii=False))


def main():
    for name in ("single", "sparse", "dense"):
        gif_and_video(name, prepare_scene(name))
    generation = json.loads((OUT / "generation.json").read_text(encoding="utf-8"))
    report = {"videoModel": generation["videoModel"], "task": generation["task"],
              "status": "integrated-without-cold-wave; awaiting-in-game-user-review", "gameIntegrated": True,
              "actualBattleInspected": False, "newVideoCalls": 1,
              "sequence": SEQUENCE_META, "scenes": SCENE_INFO,
              "slowTint": "matches mob-cold.effect slow params (0.60,0.90,1.28,0.38)",
              "mechanics": "single immediate full-field hit + existing slow; no freeze or extra damage ticks",
              "lastFrameAlphaMax": CELS[-1].getchannel("A").getextrema()[1],
              "notes": ["Provider returned 768x1344 / 56 frames despite requested square 2s.",
                        "Fixed union crop and shared y projection; no per-frame recenter or size fit.",
                        "Source begins already expanded: root-outward onset added without AI regeneration.",
                        "Broad cold-wave layer removed on user request; regular skill v10 untouched."]}
    (OUT / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Review files ready in", OUT)


if __name__ == "__main__":
    main()
