"""Persist action stage annotations from source production, never fabricate extra frames."""
from pathlib import Path
import argparse, json, shutil

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('--hero', choices=['sniper', 'volt'], required=True)
ap.add_argument('--boundaries', type=int, nargs='+', required=True)
args = ap.parse_args()
folder = GAME / 'docs' / f'{args.hero}-attack-choreography-v2'
resource = GAME / 'assets/resources/ux' / f'{args.hero}_attack_choreography_v2'
manifest = json.loads((folder / 'attack.frames.json').read_text(encoding='utf-8'))
count = len(manifest['animation']['frames'])
labels = ['瞄准', '发射', '上弩', '回正瞄准'] if args.hero == 'sniper' else ['轻踏稳住重心', '前伸施法', '收杖', '回位']
cuts = args.boundaries
if len(cuts) != 5 or cuts[0] != 0 or cuts[-1] != count or any(b <= a for a, b in zip(cuts, cuts[1:])):
    raise SystemExit('Provide five chronological boundaries covering all source frames.')
phases = [{'name': label, 'startIndex': start, 'endIndexExclusive': end}
          for label, start, end in zip(labels, cuts, cuts[1:])]
manifest['animation']['phases'] = phases
manifest['animation']['preparationSeconds'] = .28
manifest['animation']['recoveryBudgetRatio'] = .68
manifest['choreography'] = {'description': ' → '.join(labels), 'annotationScope': 'Source production; not user visual approval',
                           'sourceFramesAdded': 0, 'sourceFramesRemoved': 0, 'reversePlayback': False,
                           'bakedEffects': False, 'sameScaleAsCurrentIdle': True}
encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
for destination in [folder, resource]:
    (destination / 'attack.frames.json').write_text(encoded, encoding='utf-8')
report = json.loads((folder / 'packaging.json').read_text(encoding='utf-8'))
report.update(actionPhases=phases, animationAcceptedByUser=False)
(folder / 'packaging.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'hero': args.hero, 'frames': count, 'phases': phases}, ensure_ascii=False))
