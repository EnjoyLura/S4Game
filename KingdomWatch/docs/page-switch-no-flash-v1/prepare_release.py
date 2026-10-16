"""Prepare existing Cocos/Pages release commands; no runtime acceptance."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/tap-spring-v2'
SCOPE = 'stable page and hero refresh; retain opaque prior surface until replacement art is ready'

for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR / name).read_text(encoding='utf-8-sig')
    text = text.replace('kwTapSpring', 'kwNoFlash').replace('tap-spring-v2', 'page-switch-no-flash-v1')
    text = text.replace('docs/combat-audio-v2/deployment-stage.json', 'docs/tap-spring-v2/deployment-stage.json')
    text = text.replace('whole-game tap feedback and elastic buttons without whitening', SCOPE)
    (OUT / name).write_text(text.rstrip() + '\n', encoding='utf-8')

