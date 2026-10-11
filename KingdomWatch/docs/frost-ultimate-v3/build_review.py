"""Composite the real FrostUltimateVFX renderer's states, never a live battle.

Existing ground, walkers, painted needle and H3 atlas only. No AI calls.
Node runs the renderer with a small cc double and exports positions, anchors,
texture rectangles, opacity and Graphics paths; Pillow composites those states.
"""
from pathlib import Path
import importlib.util
import json
import math
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location("review_assets", OUT.parent / "frost-ultimate-v1/build_review.py")
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)
assets.OUT = OUT
assets.SCENE_INFO = {}
SCALE = 640 / 750
SIZE = (640, 960)
NODE = "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
LANCZOS = Image.Resampling.LANCZOS
SPRITES = {}
TEXTURES = {}


def screen(x, y, scale=SCALE):
    return SIZE[0] / 2 + x * scale, SIZE[1] / 2 - y * scale


def color(c):
    return tuple(c.get(k, 255) for k in ("r", "g", "b", "a"))


def graphics(commands):
    # Supersampling keeps short scratches and faceted chips readable at the
    # actual mobile size, without adding a blurred white layer.
    aa = 2
    layer = Image.new("RGBA", (SIZE[0] * aa, SIZE[1] * aa))
    d = ImageDraw.Draw(layer)
    lines = []
    ellipses = []
    for op in commands:
        name, *args, style = op
        if name == "ellipse":
            x, y = screen(args[0], args[1])
            rx, ry = args[2] * SCALE, args[3] * SCALE
            ellipses.append(tuple(v * aa for v in (x - rx, y - ry, x + rx, y + ry)))
        elif name == "moveTo":
            lines.append([tuple(v * aa for v in screen(*args))])
        elif name == "lineTo":
            lines[-1].append(tuple(v * aa for v in screen(*args)))
        elif name == "close":
            if lines and lines[-1]:
                lines[-1].append(lines[-1][0])
        elif name == "fill":
            c = color(style["fill"])
            for ellipse in ellipses:
                d.ellipse(ellipse, fill=c)
            for line in lines:
                if len(line) >= 3:
                    d.polygon(line, fill=c)
            # Cocos fill leaves the current path available for a following stroke.
            ellipses = []
        elif name == "stroke":
            width = max(1, round((style.get("width") or 1) * SCALE * aa))
            for line in lines:
                if len(line) >= 2:
                    d.line(line, fill=color(style["stroke"]), width=width, joint="curve")
            lines = []
        # A new moveTo after a fill starts a separate path in this renderer.
        if name == "moveTo" and len(lines) > 1:
            lines = [lines[-1]]
    return layer.resize(SIZE, LANCZOS)


def sprite(canvas, part):
    rect = part["rect"]
    resource = part["resource"].removesuffix("/spriteFrame")
    width, height = max(1, round(part["w"] * SCALE)), max(1, round(part["h"] * SCALE))
    angle = round(part["angle"] * 2) / 2
    key = (resource, tuple(rect.values()), width, height, angle)
    if key not in SPRITES:
        if resource not in TEXTURES:
            TEXTURES[resource] = Image.open(GAME / f"assets/resources/{resource}.png").convert("RGBA")
        x, y, w, h = (rect[k] for k in ("x", "y", "width", "height"))
        im = TEXTURES[resource].crop((x, y, x + w, y + h)).resize((width, height), LANCZOS)
        SPRITES[key] = im.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    im = SPRITES[key]
    ax = (part["anchor"]["x"] - .5) * width
    ay = (.5 - part["anchor"]["y"]) * height
    radians = math.radians(angle)
    anchor_x = im.width / 2 + ax * math.cos(radians) + ay * math.sin(radians)
    anchor_y = im.height / 2 - ax * math.sin(radians) + ay * math.cos(radians)
    x, y = screen(part["x"], part["y"])
    canvas.alpha_composite(assets.rgba_opacity(im, part["alpha"] / 255),
                           (round(x - anchor_x), round(y - anchor_y)))


def create_plans():
    specs = assets.scene_specs()
    times = [round(float(t), 9) for t in np.arange(81) / 30 - .3]
    times = sorted(set(times + [0, .13, .33, .37, .55, .6, .9, 1.3, 1.7, 2.0]))
    request = {}
    for name in ("sparse", "dense"):
        targets = [{"x": (m["x"] - SIZE[0] / 2) / SCALE,
                    "y": (SIZE[1] / 2 - m["y"]) / SCALE,
                    "radius": assets.RADII[m["kind"]]} for m in specs[name]]
        request[name] = {"targets": targets, "times": times, "layout": {"half": SIZE[1] / SCALE / 2}}
    (OUT / "preview-request.json").write_text(json.dumps(request), encoding="utf-8")
    subprocess.run([NODE, str(GAME / "tools/frost-ultimate-check.cjs"), "--preview-plan",
                    str(OUT / "preview-request.json"), str(OUT / "runtime-states.json")], cwd=GAME, check=True)
    return specs, json.loads((OUT / "runtime-states.json").read_text(encoding="utf-8"))


def scene(name, mobs, plan):
    ground = assets.GROUND.crop((16, 180, 1136, 1860)).resize(SIZE, LANCZOS)
    states = {round(f["t"], 9): f for f in plan["frames"]}
    assets.SCENE_INFO[name] = {"enemyCount": len(mobs), "aiImpactInstances": plan["hitCount"],
                              "rainEvents": plan["rainCount"], "size": list(SIZE)}

    def render(t, effects=True):
        canvas = ground.convert("RGBA")
        shadows = Image.new("RGBA", SIZE)
        d = ImageDraw.Draw(shadows)
        for mob in mobs:
            x, y = assets.mob_position(mob, t)
            r = mob["height"] / 3.85
            d.ellipse((x - r, y - r * .22, x + r, y + r * .22), fill=(47, 34, 23, 72))
        d.ellipse((294, 870, 346, 884), fill=(47, 34, 23, 72))
        canvas.alpha_composite(shadows.filter(ImageFilter.GaussianBlur(1.4)))
        frame = states[round(t, 9)]
        if effects:
            canvas.alpha_composite(graphics(frame["ground"]))
            for part in frame["backs"]:
                sprite(canvas, part)
        falling = sorted(frame["rain"], key=lambda part: -part["depthY"]) if effects else []
        cursor = 0
        for mob in sorted(mobs, key=lambda m: assets.mob_position(m, t)[1]):
            # Same ground-foot ordering as MonsterManager.sortDepth. A blade
            # passes behind closer bodies rather than over every character.
            foot_y = assets.mob_position(mob, t)[1]
            offset = assets.MOB_META["ground"][mob["kind"]]["offset"]
            ground_depth = (SIZE[1] / 2 - foot_y) / SCALE - assets.RADII[mob["kind"]] * 3.85 * offset
            while cursor < len(falling) and falling[cursor]["depthY"] >= ground_depth:
                sprite(canvas, falling[cursor]); cursor += 1
            assets.draw_monster(canvas, mob, t)
        while cursor < len(falling):
            sprite(canvas, falling[cursor]); cursor += 1
        assets.caster(canvas, t if effects else -1, (320, 877))
        if effects:
            canvas.alpha_composite(graphics(frame["trails"]))
            for group in ("fronts", "chips"):
                for part in frame[group]:
                    sprite(canvas, part)
        return canvas.convert("RGB")
    return render


def main():
    specs, plans = create_plans()
    for name in ("sparse", "dense"):
        render = scene(name, specs[name], plans[name])
        assets.gif_and_video(name, render)
        render(.55).save(OUT / f"ultimate-{name}-peak.png")
    report = {"status": "offline-composited; awaiting-user-in-game-review",
              "actualBattleInspected": False, "newAiCalls": 0, "newAiModels": [],
              "duration": 2, "rainCap": 96, "impactCap": 24, "impactDuration": .68, "paintedChipCap": 120,
              "renderer": "actual FrostUltimateVFX TS states exported with cc double",
              "spriteTipAnchor": [46 / 65, 1 - 2 / 156],
              "acceleration": "p=0.25u+0.75u²; solid tip at floor; tangent-aligned angle",
              "emission": "individual ordered births spread over .94s; main contacts interleaved",
              "spatial": "ground-relative projected altitude 320–360 × depth scale; actor/effect depth sorting",
              "contacts": "shadow → local flash/cracks → low ballistic chips on each landing",
              "scenes": assets.SCENE_INFO,
              "mechanics": "existing immediate one-hit full-field damage and slow, no new ticks or freeze",
              "regularSkillV10Changed": False, "expandingColdWave": False}
    (OUT / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Review files ready in", OUT)


if __name__ == "__main__":
    main()
