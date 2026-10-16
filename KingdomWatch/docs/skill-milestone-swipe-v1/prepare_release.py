"""Reuse the established build/publication workflow for this interface change."""
from pathlib import Path

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PRIOR = GAME / 'docs/page-switch-no-flash-v1'
for name in ['build_game.ps1', 'publish.ps1']:
    text = (PRIOR / name).read_text(encoding='utf-8-sig')
    text = text.replace('kwNoFlash', 'kwSkillSwipe').replace('page-switch-no-flash-v1', 'skill-milestone-swipe-v1')
    text = text.replace('docs/tap-spring-v2/deployment-stage.json', 'docs/page-switch-no-flash-v1/deployment-stage.json')
    text = text.replace('stable page and hero refresh; retain opaque prior surface until replacement art is ready',
                        'skill breakthrough cards: horizontal drag, snap, edge resistance and vertical-scroll handoff')
    (OUT / name).write_text(text, encoding='utf-8')
