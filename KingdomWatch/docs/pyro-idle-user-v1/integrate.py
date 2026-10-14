"""Record the new matched fire-mage pair without touching other heroes' media."""
from pathlib import Path
from datetime import datetime
import json
import uuid

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

meta = GAME/'assets/scripts/battle/PyroIdleAnimation.ts.meta'
if not meta.exists():
    write(meta, {'ver': '4.0.24', 'importer': 'typescript', 'imported': True,
                'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {}})
for path in [
    ROOT/'source-origin.json', ROOT/'packaging.json',
    GAME/'docs/pyro-attack-user-v1/source-origin.json',
    GAME/'docs/pyro-attack-user-v1/packaging.json',
    GAME/'docs/pyro-attack-user-v1/attack.frames.json',
    GAME/'assets/resources/ux/pyro_attack_user_v1/attack.frames.json',
]:
    value = read(path)
    value.update({'gameIntegrated': True, 'previewOnly': False,
        'pairedIdleResource': 'pyro_idle_user_v1', 'gameVisualAcceptedByUser': False})
    if path.name == 'packaging.json' and 'idleVideoReceived' in value:
        value['idleVideoReceived'] = True
    write(path, value)
write(ROOT/'integration.json', {
    'status': 'integrated_pending_build', 'date': datetime.now().astimezone().isoformat(),
    'idleResource': 'pyro_idle_user_v1', 'attackResource': 'pyro_attack_user_v1',
    'previousVisual': 'battle_heroes_v2/pyro_combat with HeroBattleMotion',
    'idleFrames': 56, 'idleSeconds': 56/24, 'attackFrames': 56, 'attackReleaseIndex': 14,
    'groundAnchor': [256,496], 'cellSize': [512,512], 'paintedHeight': 468, 'displayHeight': 146,
    'player': 'Existing whole-character HeroSequenceAnimation; actual fireball/skill/ultimate cast callbacks',
    'idleRule': 'Only outside attack/recovery, no target within own attack range and no queued attack',
    'mirroring': 'Whole art about the fixed foot; original left-facing, right-facing via horizontal reflection',
    'reversePlayback': False, 'opacityFade': False, 'paidTaskSubmitted': False,
    'gameVisualAcceptedByUser': False,
    'retained': ['archer, sniper and volt media and timing', 'mora media',
                 'damage, attack speed, target selection, fireball paths, fire effects and sound']})
print('Integrated fire-mage idle and matching user attack; awaiting build and publication')
