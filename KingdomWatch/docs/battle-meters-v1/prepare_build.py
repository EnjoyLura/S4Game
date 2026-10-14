"""Create new script metadata and reuse the project's established build/deploy workflow."""
from pathlib import Path
import json
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
meta = GAME / 'assets/scripts/ui/BattleProgressBar.ts.meta'
if not meta.exists():
    meta.write_text(json.dumps({'ver': '4.0.24', 'importer': 'typescript', 'imported': True,
        'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}}, indent=2), encoding='utf-8')
prior = GAME / 'docs/pause-comic-v1'
build = (prior / 'build_game.ps1').read_text(encoding='utf-8')
build = build.replace('kwPause', 'kwMeters').replace('pause-comic-v1', 'battle-meters-v1').replace('pause art only', 'battle progress bars and shield display')
(OUT / 'build_game.ps1').write_text(build, encoding='utf-8')
publish = (prior / 'publish.ps1').read_text(encoding='utf-8')
publish = publish.replace('kwPause', 'kwMeters').replace('pause-comic-v1', 'battle-meters-v1')
publish = publish.replace('docs/volt-attack-user-v2/deployment-stage.json', 'docs/pause-comic-v1/deployment-stage.json')
publish = publish.replace("scope = 'pause menu art only'; layoutChanged = $false", "scope = 'battle progress bars and shield display'; layoutChanged = $true")
(OUT / 'publish.ps1').write_text(publish, encoding='utf-8')
print('Created script metadata and build/deploy entrypoints')
