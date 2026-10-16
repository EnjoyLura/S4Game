"""Reuse the current build and publication workflow for the shader coordinate fix."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME/'docs/hero-ultimate-ui-v3'
SCOPE = 'align thunder ground ring, synchronize sniper multi-target aim, commit pyro meteors to spread-out warned ground points'
OLD_SCOPE = 'violet thunder ultimate, blue sniper ultimate, opaque page handoff and formation close without blank frames'
for name in ['build_game.ps1', 'publish.ps1']:
    content = (PRIOR/name).read_text(encoding='utf-8-sig')
    content = content.replace('docs/sniper-cards-v1/deployment-stage.json', '__PRIOR__')
    content = content.replace('kwUltimateUI', 'kwVoltGround').replace('hero-ultimate-ui-v3', 'volt-ground-alignment-v1')
    content = content.replace('__PRIOR__', 'docs/hero-ultimate-ui-v3/deployment-stage.json')
    content = content.replace(OLD_SCOPE, SCOPE)
    (OUT/name).write_text(content, encoding='utf-8')
(OUT/'integration.json').write_text(json.dumps({
    'status': 'prepared', 'scope': SCOPE,
    'source': 'assets/resources/fx/volt-ultimate-procedural.effect',
    'reference': 'C:/Users/user/AppData/Local/Temp/codex-clipboard-62ad5da2-3462-4d09-be5d-f03c3e0be2cc.png',
    'rootCause': 'ground x centered twice, placing origin at carrier right edge',
    'before': 'p -= strikeShape.xy * 0.5; (x was already centered)',
    'after': 'p = vec2(uv0.x - 0.5, 0.5 - uv0.y) * strikeShape.xy;',
    'anchor': 'existing target foot; shared by ground light, cracks and sky contact',
    'sniper': {'countSource': 'hero.stats.ultBolts', 'clearGraphics': 'once per frame',
               'aimLinesAndReticles': 'one pair per actual target', 'maxCardCount': 3,
               'selection': 'original primary; highest-HP remaining live targets; no duplicates',
               'fireTargets': 'same array as final aim frame; no second selection',
               'originCue': 'once, not per line', 'manualAndAutoShared': True},
    'pyro': {'rootCause': 'ordinary fireball collides early; independent timer creates crater at warning',
             'landing': 'fixed ground target; projectile arrival drives blast and crater',
             'warningRadius': 140, 'meteorSpeed': 800, 'count': 'existing 5/7',
             'selection': 'new group coverage, movement prediction, preferred separation 147/176',
             'fixedAfterWarning': True, 'retryWhenProjectilePoolFull': True,
             'damage': 'existing full primary hit and splash multiplier; no blanket AoE multiplier buff',
             'reference': 'C:/Users/user/AppData/Local/Temp/codex-clipboard-515aea7d-4e95-4ec4-a307-c6725f436dfd.png'},
    'gameplayChanged': 'pyro target distribution and ground-impact correction only', 'audioAssetsChanged': False, 'heroMediaChanged': False,
    'paidMediaGeneration': False, 'validation': 'user manual; no tests, simulations, game, browser or online acceptance run',
}, ensure_ascii=False, indent=2), encoding='utf-8')
