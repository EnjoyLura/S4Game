"""Export a read-only catalogue from literal game configuration and atlas rectangles.

No Cocos imports, gameplay execution, build, browser, network, or save access.
Run this again after changing chapter rosters or replacing monster art.
"""
from __future__ import annotations

import hashlib
import json
import re
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
    return result


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
