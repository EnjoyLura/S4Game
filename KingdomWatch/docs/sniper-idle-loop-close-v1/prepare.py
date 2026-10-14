"""Regenerate only the rejected crossbow idle and record the approved mage freeze."""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
ORIGIN = GAME / 'docs/sniper-idle-natural-v1'
TARGET = GAME / 'docs/sniper-idle-natural-v2'
for name in ['ready-red.png', 'ready-transparent.png', 'image-prompt.txt', 'art.json',
             'video-first-frame.png', 'first-frame-layout.json', 'first-frame-host.json']:
    shutil.copy2(ORIGIN / name, TARGET / name)
for name in ['packaging.json', 'source-cycle.json']:
    path = GAME / 'docs/volt-idle-natural-v1' / name
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    data['userAccepted'] = True
    data['animationAcceptedByUser'] = True
    data['motionAcceptedByUser'] = True
    data['acceptedFeedback'] = '雷法师的待机动画很丝滑了'
    data['acceptedOn'] = '2026-10-14'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(ROOT / 'request.json').write_text(json.dumps({
    'scope': 'Regenerate only the sniper natural idle source to close the cycle',
    'approvedMageResource': 'volt_idle_natural_v1',
    'approvedMageMediaUnchanged': True,
    'sniperPreviousSourceRejectedFor': 'End-to-start closure',
    'sniperMasterUnchanged': True,
    'reversePlaybackAllowed': False,
    'shortenedSourceAllowed': False,
    'displayHeights': {'sniper': 153, 'volt': 146, 'archer': 185.64},
    'review': 'User manual effect review; no tests, game, browser or online QA'
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
