"""Export a read-only catalogue from literal game configuration and atlas rectangles.

No Cocos imports, gameplay execution, build, browser, network, or save access.
Run this again after changing chapter rosters or replacing monster art.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
CONFIG = PROJECT / "assets/scripts/config"
ART = PROJECT / "assets/resources/ux"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def literal(text: str, name: str):
    match = re.search(r"export const " + re.escape(name) + r"\b[^=]*=\s*", text)
    if not match:
        raise ValueError("Missing literal configuration: " + name)
    return json.JSONDecoder().raw_decode(text[match.end():])[0]


def named_fields(body: str) -> dict:
    result = {}
    for key in ("id", "name", "kind", "description"):
        match = re.search(r"\b" + key + r"\s*:\s*'((?:\\.|[^'\\])*)'", body)
        if match:
            result[key] = match[1]
    for key in ("elite", "boss"):
        result[key] = bool(re.search(r"\b" + key + r"\s*:\s*true\b", body))
    speed = re.search(r"\bspeed\s*:\s*([\d.]+)", body)
    if speed:
        result["speed"] = float(speed[1])
    return result


def animation_payload(rows, definitions, manifests, inputs, runtime_text):
    """Copy the actual atlases and retain their complete ordered frame rectangles."""
    rate_rule = re.search(r"playbackRate:\s*(.*?)\s*,\s*\n\s*referenceSpeed:", runtime_text)
    if not rate_rule:
        raise ValueError("Cannot resolve animation playback rate")
    slowed = set()
    if re.fullmatch(r"\d+(?:\.\d+)?", rate_rule[1]):
        slow_rate = default_rate = float(rate_rule[1])
    else:
        rule = re.fullmatch(r"([\w\s.|()]+)\?\s*([\d.]+)\s*:\s*([\d.]+)", rate_rule[1])
        if not rule:
            raise ValueError("Unsupported animation playback rule")
        names = re.findall(r"(\w+)\.has\(mob\)", rule[1])
        if not names or re.sub(r"\w+\.has\(mob\)|\|\||\s", "", rule[1]):
            raise ValueError("Unsupported animation playback sets")
        slow_rate, default_rate = float(rule[2]), float(rule[3])
        for name in names:
            declaration = re.search(r"const " + re.escape(name) + r"\s*=\s*new Set\(\[([^\]]*)\]\)", runtime_text)
            if not declaration:
                raise ValueError("Missing animation set: " + name)
            slowed.update(re.findall(r"'([^']+)'", declaration[1]))
    output = HERE / "live/animations"
    output.mkdir(parents=True, exist_ok=True)
    atlas_rows, clips = {}, {}
    for row in rows:
        if not row["animation"]:
            continue
        atlas, mob_id = row["atlas"], row["id"]
        manifest = manifests[atlas]
        if atlas not in atlas_rows:
            source = ART / (atlas + ".png")
            target = output / source.name
            if not target.is_file() or digest(target) != inputs[source]:
                shutil.copyfile(source, target)
            if digest(target) != inputs[source]:
                raise ValueError("Animation atlas copy differs: " + atlas)
            with Image.open(target) as image:
                width, height = image.size
            atlas_rows[atlas] = dict(image=target.relative_to(HERE).as_posix(),
                                    width=width, height=height, sha256=inputs[source], bytes=target.stat().st_size)
        keys = sorted((key for key in manifest["frames"] if re.fullmatch(re.escape(mob_id) + r"_w\d+", key)),
                      key=lambda key: int(key.rsplit("_w", 1)[1]))
        if keys != [f"{mob_id}_w{i}" for i in range(len(keys))]:
            raise ValueError("Non-contiguous walk sequence: " + mob_id)
        rectangles = [manifest["frames"][key] for key in keys]
        width, height = rectangles[0][2:]
        for x, y, w, h in rectangles:
            if (w, h) != (width, height) or x < 0 or y < 0 or x + w > atlas_rows[atlas]["width"] or y + h > atlas_rows[atlas]["height"]:
                raise ValueError("Invalid animation rectangle: " + mob_id)
        cycle = manifest.get("cycles", {}).get(mob_id) or 1
        rate = slow_rate if mob_id in slowed else default_rate
        reference_speed = manifest.get("walkSpeeds", {}).get(mob_id) or 45
        base_speed = definitions[mob_id].get("speed", reference_speed)
        tempo = min(1.25, max(0.75, base_speed / reference_speed))
        if cycle <= 0 or rate <= 0:
            raise ValueError("Invalid animation timing: " + mob_id)
        clips[mob_id] = dict(atlas=atlas, frames=rectangles, width=width, height=height,
                            cycleSeconds=cycle, playbackRate=rate, baseTempo=tempo,
                            effectiveCycleSeconds=cycle / rate / tempo)
    return dict(version=1, atlases=atlas_rows, clips=clips,
                counts=dict(atlases=len(atlas_rows), clips=len(clips), frames=sum(len(clip["frames"]) for clip in clips.values())))


def base_monsters(text: str) -> dict:
    start = re.search(r"export const MOBS\b[^=]*=\s*\{", text)
    if not start:
        raise ValueError("Missing MOBS declaration")
    end = re.search(r"^};", text[start.end():], re.M)
    if not end:
        raise ValueError("Missing MOBS closing brace")
    body = text[start.end():start.end() + end.start()]
    monsters = {}
    for match in re.finditer(r"^  (\w+):\s*\{(.*?)^  \},?\s*$", body, re.M | re.S):
        value = named_fields(match[2])
        if value.get("id") != match[1] or not value.get("name"):
            raise ValueError("Unsupported base monster declaration: " + match[1])
        monsters[match[1]] = value
    for match in re.finditer(r"MOBS\.(\w+)\s*=\s*\{\s*\.\.\.MOBS\.(\w+),(.*?)\};", text, re.S):
        extra = named_fields(match[3])
        # Unspecified boolean fields inherit from the reused combat template.
        for key in ("elite", "boss"):
            if not re.search(r"\b" + key + r"\s*:", match[3]):
                extra.pop(key, None)
        monsters[match[1]] = {**monsters[match[2]], **extra}
    return monsters


def first_chapter_art(text: str, mob_id: str) -> tuple[str, str]:
    helper = text.split("export function enemyArtRef", 1)[1]
    rules = re.finditer(
        r"if\s*\((?:portrait\s*&&\s*)?\[([^\]]+)\]\.includes\(id\)\)\s*"
        r"return\s*\{\s*atlas:\s*'([^']+)',\s*frame:\s*([^}]+)\}", helper)
    for rule in rules:
        if mob_id in re.findall(r"'([^']+)'", rule[1]):
            frame = mob_id + "_w0" if "'_w0'" in rule[3] else mob_id
            return rule[2], frame
    fallback = re.search(r"return\s*\{\s*atlas:\s*'([^']+)',\s*frame:\s*id\s*\}", helper)
    if not fallback:
        raise ValueError("Cannot resolve art for " + mob_id)
    return fallback[1], mob_id


def main():
    text_paths = [CONFIG / name for name in (
        "ChapterContent.ts", "ChapterWaves.ts", "Mobs.ts", "LevelDifficulty.ts",
        "FirstLevel.ts", "SecondLevel.ts", "ThirdLevel.ts", "FourthLevel.ts",
        "FifthLevel.ts", "SixthLevel.ts", "SeventhLevel.ts", "Endless.ts",
    )]
    text_paths += [PROJECT / "assets/scripts/battle/Monster.ts",
                   PROJECT / "assets/scripts/battle/MobAnim.ts"]
    inputs = {p: digest(p) for p in text_paths}
    texts = {p.name: p.read_text(encoding="utf-8-sig") for p in text_paths}
    content = texts["ChapterContent.ts"]
    chapters = literal(content, "CHAPTER_CONTENT")
    expansion = literal(content, "EXPANSION_MOBS")
    base = base_monsters(texts["Mobs.ts"])
    definitions = {**base, **expansion}

    # Actual chapter-one spawn references, including authored formations and swaps.
    one_ids = set()
    for name in ("Mobs.ts", "LevelDifficulty.ts", "FirstLevel.ts", "SecondLevel.ts",
                 "ThirdLevel.ts", "FourthLevel.ts", "FifthLevel.ts", "SixthLevel.ts", "SeventhLevel.ts"):
        for mob_id in re.findall(r"(?:\bmob\s*:\s*|\b(?:group|add)\(\s*)['\"]([\w]+)['\"]", texts[name]):
            if mob_id in base:
                one_ids.add(mob_id)
    if not one_ids:
        raise ValueError("Chapter-one spawn references are empty")
    variants = {}
    for match in re.finditer(r"chapter\s*===\s*(\d+)\s*\?\s*\[([^\]]+)\]", texts["ChapterWaves.ts"]):
        variants.setdefault(int(match[1]), []).extend(re.findall(r"'([\w]+)'", match[2]))

    memberships = {}
    chapter_rows = []
    for chapter in chapters:
        number = chapter["number"]
        ids = list(base_id for base_id in base if base_id in one_ids) if number == 1 else list(chapter["roster"])
        ids += [mob_id for mob_id in variants.get(number, []) if mob_id not in ids]
        # Offspring that actually spawn also belong to the chapter using their parent.
        index = 0
        while index < len(ids):
            mob = definitions[ids[index]]
            for key in ("summon", "split"):
                child = (mob.get(key) or {}).get("id")
                if child and child not in ids:
                    ids.append(child)
            index += 1
        ids.sort(key=lambda mob_id: 2 if definitions[mob_id].get("boss") else 1 if definitions[mob_id].get("elite") else 0)
        for mob_id in ids:
            if mob_id not in definitions:
                raise ValueError("Unknown roster monster: " + mob_id)
            memberships.setdefault(mob_id, []).append(number)
        chapter_rows.append(dict(number=number, name=chapter["name"], ids=ids))

    atlases = {}
    manifests = {}
    refs = {}
    for mob_id in memberships:
        mob = definitions[mob_id]
        atlas, frame = (mob["artAtlas"], mob_id) if mob_id in expansion else first_chapter_art(content, mob_id)
        refs[mob_id] = (atlas, frame)
        if atlas not in atlases:
            image_path, manifest_path = ART / (atlas + ".png"), ART / (atlas + ".frames.json")
            if not image_path.is_file() or not manifest_path.is_file():
                raise ValueError("Current game asset is not ready: " + atlas)
            inputs[image_path], inputs[manifest_path] = digest(image_path), digest(manifest_path)
            atlases[atlas] = Image.open(image_path).convert("RGBA")
            manifests[atlas] = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        if frame not in manifests[atlas]["frames"]:
            raise ValueError("Missing game frame: " + atlas + "/" + frame)

    output = HERE / "live/monsters"
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    for mob_id, used_in in memberships.items():
        mob = definitions[mob_id]
        atlas, frame = refs[mob_id]
        frames = manifests[atlas]["frames"]
        image = atlases[atlas]

        def export_frame(key, suffix=""):
            rect = frames[key]
            if len(rect) != 4 or any(not isinstance(v, int) for v in rect):
                raise ValueError("Unsupported frame rectangle: " + key)
            x, y, w, h = rect
            if not (w > 0 and h > 0 and x >= 0 and y >= 0 and x + w <= image.width and y + h <= image.height):
                raise ValueError("Frame outside atlas: " + key)
            crop = image.crop((x, y, x + w, y + h))
            if not crop.getbbox():
                raise ValueError("Empty monster frame: " + key)
            path = output / (mob_id + suffix + ".png")
            crop.save(path, optimize=True)
            # Full RGBA pixels are kept; no redraw, resize, matte, or alpha trimming.
            with Image.open(path) as saved:
                if saved.convert("RGBA").tobytes() != crop.tobytes():
                    raise ValueError("Pixel mismatch: " + key)
            return dict(image=path.relative_to(HERE).as_posix(), frame=key, rect=rect,
                        width=w, height=h, sha256=digest(path),
                        pixelSha256=hashlib.sha256(crop.tobytes()).hexdigest())

        still = export_frame(frame)
        walk_keys = [key for key in frames if re.fullmatch(re.escape(mob_id) + r"_w\d+", key)]
        phase_key = mob_id + "_phase"
        phase = export_frame(phase_key, "-phase") if mob.get("boss") and not walk_keys and phase_key in frames else None
        rows.append(dict(
            id=mob_id, name=mob["name"], chapters=used_in,
            role="关底 Boss" if mob.get("boss") else "精英怪" if mob.get("elite") else "普通怪",
            kind=mob["kind"], airborne=bool(mob.get("airborne")),
            description=mob.get("description", ""), traits=mob.get("traits", []),
            atlas=atlas, gameAsset="assets/resources/ux/" + atlas + ".png",
            atlasSha256=inputs[ART / (atlas + ".png")],
            animation=dict(frames=len(walk_keys), cycleSeconds=manifests[atlas].get("cycles", {}).get(mob_id)) if walk_keys else None,
            phase=phase, **still,
        ))

    animations = animation_payload(rows, definitions, manifests, inputs, texts["MobAnim.ts"])
    # Another art task may still be editing the same project. Publish one consistent snapshot.
    for path, before in inputs.items():
        if digest(path) != before:
            raise ValueError("Game input changed while exporting; run again: " + str(path))
    timestamp = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")
    payload = dict(version=1, generatedAt=timestamp, chapters=chapter_rows, monsters=rows,
                   inputs=[dict(file=p.relative_to(PROJECT).as_posix(), sha256=h) for p, h in inputs.items()],
                   counts=dict(chapters=len(chapter_rows), monsters=len(rows),
                               animated=sum(bool(row["animation"]) for row in rows),
                               phases=sum(bool(row["phase"]) for row in rows)))
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    for name, body in (
        ("live-catalog.json", json.dumps(payload, ensure_ascii=False, indent=2) + "\n"),
        ("live-catalog-data.js", "window.LIVE_MONSTER_CATALOG=" + serialized + ";\n"),
        ("animation-catalog.json", json.dumps(animations, ensure_ascii=False, indent=2) + "\n"),
        ("animation-catalog-data.js", "window.MONSTER_ANIMATION_CATALOG=" + json.dumps(animations, ensure_ascii=False, separators=(",", ":")) + ";\n"),
    ):
        destination = HERE / name
        staging = destination.with_suffix(destination.suffix + ".tmp")
        staging.write_text(body, encoding="utf-8")
        staging.replace(destination)
    for image in atlases.values():
        image.close()
    print(json.dumps(dict(**payload["counts"], pixelIdentity=True, generatedAt=timestamp,
                          chapterSummary=[dict(number=c["number"], name=c["name"], monsters=len(c["ids"])) for c in chapter_rows]), ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
