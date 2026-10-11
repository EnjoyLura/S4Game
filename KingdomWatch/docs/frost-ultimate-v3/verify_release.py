"""Check published files by hash. Does not open the game or run a battle."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import sys
import tempfile

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
BUILD = GAME / "build/web-mobile"


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def main():
    index = (BUILD / "index.html").read_text(encoding="utf-8")
    stamp = re.search(r"index\.js\?v=(\d+)", index).group(1)
    version = "frost-ult-stagger-" + stamp
    assert "__KW_DPR_CAP" in index
    assert "Cache-Control: no-cache" in (BUILD / "_headers").read_text(encoding="utf-8")
    entry = (BUILD / "assets/main/index.js").read_text(encoding="utf-8")
    assert "RAIN_CAP = 96" in entry and "HIT_CAP = 24" in entry
    assert "registerDepthSprite" in entry and "sortDepth" in entry
    engine = next(p for p in (BUILD / "cocos-js").glob("_virtual_cc-*.js")
                  if "window.__KW_DPR_CAP || 2" in p.read_text(encoding="utf-8"))
    files = {"index.html": "index.html", "main.js": "assets/main/index.js",
             "resources-config.json": "assets/resources/config.json",
             "dpr-engine.js": engine.relative_to(BUILD).as_posix()}
    natives = {}
    for name in ("frost_ultimate_impact_v1", "frost_ultimate_rain_v1", "frost_domain_video_v10"):
        source = GAME / f"assets/resources/fx/{name}.png"
        uuid = json.loads(source.with_suffix(".png.meta").read_text(encoding="utf-8"))["uuid"]
        rel = f"assets/resources/native/{uuid[:2]}/{uuid}.png"
        assert sha(source) == sha(BUILD / rel), name + " native file differs from source"
        natives[name] = sha(source)
        files[name + ".png"] = rel

    def fetch(item):
        name, rel = item
        dest = Path(tempfile.gettempdir()) / ("kw-frost-v3-online-" + name)
        command = ["curl.exe", "--fail", "--location", "--silent", "--show-error", "--retry", "2",
                   "--retry-delay", "2", "--max-time", "30", "--proxy", "http://127.0.0.1:10808",
                   "--user-agent", "Mozilla/5.0", "--output", str(dest),
                   "https://kingdom-watch.pages.dev/" + rel + "?v=" + version]
        subprocess.run(command, check=True, capture_output=True)
        local_hash, online_hash = sha(BUILD / rel), sha(dest)
        assert local_hash == online_hash, name + " production hash mismatch"
        return name, {"matchesLocal": True, "sha256": online_hash, "bytes": dest.stat().st_size}

    with ThreadPoolExecutor(max_workers=4) as pool:
        online = dict(pool.map(fetch, files.items()))
    preview = json.loads((OUT / "validation.json").read_text(encoding="utf-8"))
    assert all(s["finalEffectPixelDifference"] == 0 for s in preview["scenes"].values())
    record = {"date": datetime.now(timezone.utc).isoformat(), "status": "deployed-awaiting-in-game-user-review",
              "gameIntegrated": True, "actualBattleBrowserInspected": False,
              "newAIGenerationCallsThisTurn": 0, "version": version,
              "url": "https://kingdom-watch.pages.dev/?v=" + version,
              "deployment": sys.argv[1],
              "pools": {"iceImpactPairs": 24, "rainSlots": 96, "paintedChipSlots": 120},
              "rainCount": "min(96,48+2*visibleTargets)",
              "localContacts": "6 small shards/cracks per landing; short fixed shadows/flash",
              "fall": {"start": "projected overhead altitude relative to each ground footprint",
                       "motion": "0.25u+0.75u^2; tangent-aligned angle; subtle near/far scale",
                       "tipAnchor": [46 / 65, 1 - 2 / 156], "opacityAtFloor": .9,
                       "emissionSpread": .94, "impactDuration": .68, "actorDepthSorting": True,
                       "impactClock": "drop.start+drop.flight", "duration": 2},
              "gameplay": "same immediate one hit and moraUltCfg slow; no extra damage or freeze",
              "regularSkillV10Changed": False, "expandingColdWave": False,
              "checks": {"typeCheck": "passed", "offlineRuntimeCheck": "passed: tools/frost-ultimate-check.cjs",
                         "creatorBuild": "passed: 3.8.8 web-mobile debug",
                         "dprPatch": "passed", "nativeSourceHashes": natives, "online": online},
              "remaining": "User manually reviews battle appearance and phone performance."}
    (OUT / "integration-validation.json").write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"url": record["url"], "onlineHashMatches": len(online),
                      "deployment": record["deployment"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
