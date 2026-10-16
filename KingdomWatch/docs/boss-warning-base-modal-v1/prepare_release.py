"""Prepare metadata, documentation and deployment scripts for this iteration."""
from pathlib import Path
import json
import uuid

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/settlement-pause-layout-v2'

entry = GAME / 'assets/scripts/ui/BattleEntry.ts'
before_entry = OUT / 'before/assets/scripts/ui/BattleEntry.ts'
if not before_entry.exists():
    before_entry.write_text(entry.read_text(encoding='utf-8-sig').replace(
        '/** Comic outpost gates: unchanged closing/opening movement with a two-second closed-door beat. */',
        '/** Lobby-style wooden gates cover only the scene handoff, with no artificial loading hold. */').replace(
        'const MIN_HOLD = 2;', 'const MIN_HOLD = .06;'), encoding='utf-8')

script_meta = GAME / 'assets/scripts/ui/BossWarning.ts.meta'
if not script_meta.exists():
    meta = json.loads((GAME / 'assets/scripts/ui/PickArt.ts.meta').read_text(encoding='utf-8-sig'))
    meta['uuid'] = str(uuid.uuid4())
    script_meta.write_text(json.dumps(meta, indent=2), encoding='utf-8')

for filename in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR / filename).read_text(encoding='utf-8-sig')
    content = content.replace('kwSettlement', 'kwThreat').replace('settlement-pause-layout-v2', 'boss-warning-base-modal-v1')
    content = content.replace("docs/battle-entry-art-v2/deployment-stage.json", "docs/settlement-pause-layout-v2/deployment-stage.json")
    content = content.replace('lobby-paper settlement, retry via current level lobby, spaced pause layout, warm-wood gate, picker response/prewarm and high-contrast targeting range',
                              'central elite/Boss warning, persistent base upgrade/codex modal and two-second entry gate hold')
    content = content.replace('settlement controls, current-level retry, pause spacing, comic outpost gate, picker response and targeting range',
                              'central elite/Boss warning, persistent base upgrade/codex modal and two-second entry gate hold')
    (OUT / filename).write_text(content, encoding='utf-8')

integration = {
    'status': 'source-ready',
    'scope': ['central warning animation', 'main castle consecutive upgrades', 'codex mask continuity', 'entry closed hold 2s'],
    'warning': {'durationSeconds': 2.35, 'reducedMotionSeconds': 1.8, 'screenEdgeTint': False,
                'gameplayDelay': False, 'ordinarySurges': 'existing banner',
                'currentConfig': 'elite-only; no new Boss stats or entries',
                'trigger': 'once per wave, max(0, first featured group delay - 0.8s)',
                'pauseAndPick': 'hidden and suspended; no delay to upgrade picker',
                'sound': 'existing licensed surge sample, lowpass 3500Hz, gain 0.85, rate 0.95, duration <=1.05s'},
    'baseModal': {'mask': 'one persistent dim layer', 'handoff': 'retain old opaque content until art and AFTER_DRAW',
                  'keepUpgrade': 'replace contents in place, update currencies, refresh page only at final close',
                  'codex': 'forward/back and claim return share session; scroll offset retained'},
    'entry': {'closingSeconds': 0.24, 'minimumClosedSeconds': 2, 'openingSeconds': 0.32,
              'coldLoading': 'can hold longer until scene first paint; failure path unchanged'},
    'validation': {'sourceInspection': True, 'cocosBuild': False, 'DPRPatch': False,
                   'localBundleInspection': False, 'tests': 'not run by project agreement',
                   'gameplay': 'not run; user manual acceptance', 'browser': 'not opened', 'onlineAcceptance': 'not run'}
}
(OUT / 'integration.json').write_text(json.dumps(integration, ensure_ascii=False, indent=2), encoding='utf-8')
print('Prepared source metadata, before snapshot, build and publishing scripts, integration record.')
