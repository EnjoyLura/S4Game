"""Reuse the established hidden Creator build and production Pages deployment."""
from pathlib import Path
import shutil

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
prior = GAME / 'docs/battle-meters-v1'
build = (prior / 'build_game.ps1').read_text(encoding='utf-8')
build = build.replace('kwMeters', 'kwSettlement').replace('battle-meters-v1', 'settlement-comic-v1')
build = build.replace('20261014', '20261015').replace('battle progress bars and shield display', 'win/lose settlement artwork and fire-mage idle/attack integration')
(OUT / 'build_game.ps1').write_text(build, encoding='utf-8')
publish = (prior / 'publish.ps1').read_text(encoding='utf-8')
publish = publish.replace('kwMeters', 'kwSettlement').replace('battle-meters-v1', 'settlement-comic-v1')
publish = publish.replace('docs/pause-comic-v1/deployment-stage.json', 'docs/battle-meters-v1/deployment-stage.json')
publish = publish.replace('battle progress bars and shield display', 'win/lose settlement artwork and fire-mage idle/attack integration')
(OUT / 'publish.ps1').write_text(publish, encoding='utf-8')
temp = Path('C:/Users/user/AppData/Local/Temp')
for source, dest in [
    ('879cc358-8b54-4aa1-b0aa-e942b02c084c', 'before-lose.png'),
    ('36189e30-ebde-40ae-87f6-7b8bc05836b6', 'before-win.png'),
    ('15ecdabb-3c72-490e-b772-6b3f384a42c5', 'reference-win.png'),
    ('3dcf5e3b-b40f-4910-9b0b-7f1692ca5c51', 'reference-lose.png'),
]:
    shutil.copy2(temp / ('codex-clipboard-' + source + '.png'), OUT / dest)
print('Prepared settlement build, publication and reference records')
