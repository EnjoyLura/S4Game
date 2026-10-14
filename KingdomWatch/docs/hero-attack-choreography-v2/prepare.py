"""Prepare versioned choreography assets without changing approved artwork or idle clips."""
from pathlib import Path
import json, shutil

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
OLD = GAME / 'docs/hero-attack-natural-v1'
for hero, idle, master in [('sniper', 'sniper-idle-natural-v2', 'sniper-stance-idle-v3'),
                           ('volt', 'volt-idle-natural-v1', 'volt-stance-idle-v2')]:
    folder = GAME / 'docs' / f'{hero}-attack-choreography-v2'
    folder.mkdir(parents=True, exist_ok=True)
    for name in ['video-first-frame.png', 'first-frame-layout.json']:
        shutil.copy2(GAME / 'docs' / f'{hero}-attack-natural-v1' / name, folder / name)
    shutil.copy2(GAME / 'docs' / master / 'ready-red.png', folder / 'ready-red.png')
    rejection = {'accepted': False, 'reason': 'User rejected the attack: missing readable aim/fire/recock/return or foot plant/staff extension.',
                 'supersededBy': f'{hero}-attack-choreography-v2', 'approvedIdlePreserved': idle}
    (GAME / 'docs' / f'{hero}-attack-natural-v1' / 'user-rejection.json').write_text(json.dumps(rejection, indent=2), encoding='utf-8')
wrapper = (OLD / 'generate_video.py').read_text(encoding='utf-8')
wrapper = wrapper.replace("f'{args.hero}-attack-natural-v1'", "f'{args.hero}-attack-choreography-v2'")
(ROOT / 'generate_video.py').write_text(wrapper, encoding='utf-8')
for name in ['build_preview.cjs', 'build_game.ps1', 'publish.ps1']:
    content = (OLD / name).read_text(encoding='utf-8').replace('hero-attack-natural-v1', 'hero-attack-choreography-v2')
    if name == 'build_preview.cjs':
        content = content.replace('`${hero}-attack-natural-v1`', '`${hero}-attack-choreography-v2`')
    if name == 'publish.ps1':
        content = content.replace('build/publish-sniper-idle-loop-close-v1-20261014-092338',
                                  'build/publish-hero-attack-natural-v1-20261014-100137')
        content = content.replace("'sniper-idle-loop-close-v1/index.html'", "'hero-attack-natural-v1/index.html'")
    (ROOT / name).write_text(content, encoding='utf-8')
print('Prepared new choreography folders; old attacks marked user-rejected; idles unchanged.')
