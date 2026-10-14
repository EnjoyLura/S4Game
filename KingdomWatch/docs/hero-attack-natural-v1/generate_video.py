"""Submit/resume full forward attack videos through the project MiniMax H3 tool."""
from pathlib import Path
from types import SimpleNamespace
import argparse, json, sys, time

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[2] / '美术/tools'))
import art_video_gen

ap = argparse.ArgumentParser()
ap.add_argument('--hero', choices=['sniper', 'volt'], required=True)
ap.add_argument('--image-url', required=True)
ap.add_argument('--return-image-url', help='Extra same-pose image reference; server endpoint role is not assumed')
ap.add_argument('--resume')
ap.add_argument('--take', help='Keep each new generation in a separate production subfolder')
ap.add_argument('--model', default='lens-minimax-h3-768p')
ap.add_argument('--seconds', type=int, default=2)
ap.add_argument('--ratio', default='3:4')
ap.add_argument('--resolution')
args = ap.parse_args()
base = ROOT.parent / f'{args.hero}-attack-natural-v1'
folder = base / 'takes' / args.take if args.take else base
folder.mkdir(parents=True, exist_ok=True)
path = folder / 'video-task.json'
record = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
task = args.resume or record.get('taskId')
if not task:
    if args.model == 'lens-video-0f4c4ca37ccb' and len((base / 'attack-prompt.txt').read_text(encoding='utf-8').strip()) > 2000:
        raise SystemExit('This project H3 channel limits its prompt to 2000 characters; shorten before submission')
    spec = SimpleNamespace(model=args.model, seconds=args.seconds, ratio=args.ratio, resolution=args.resolution,
                           image=args.image_url, additional_images=[args.return_image_url] if args.return_image_url else [],
                           prompt_file=str(base / 'attack-prompt.txt'), prompt=None)
    task = art_video_gen.submit(spec)
    if not task:
        raise SystemExit(1)
    record = {'hero': args.hero, 'kind': 'attack', 'taskId': task, 'model': spec.model,
              'secondsRequested': spec.seconds, 'ratioRequested': spec.ratio, 'resolutionRequested':spec.resolution, 'imageUrl': args.image_url,
              'promptFile': 'attack-prompt.txt', 'status': 'submitted', 'sourceTool': '美术/tools/art_video_gen.py',
              'fullSourceRequired': True, 'reversePlayback': False, 'effectsBakedIntoCharacter': False}
    record['returnPoseImageReference'] = args.return_image_url
    record['returnPoseServerRoleVerified'] = False
    if folder != base:
        (folder / 'attack-prompt.txt').write_text((base / 'attack-prompt.txt').read_text(encoding='utf-8'), encoding='utf-8')
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
else:
    print('resuming same task:', task, flush=True)
clip = folder / 'source.mp4'
if clip.exists() and clip.stat().st_size >= 1024 and b'ftyp' in clip.read_bytes()[:128] and record.get('status') == 'completed':
    print('already saved:', clip, flush=True)
    raise SystemExit(0)
for attempt in range(3):
    try:
        result = art_video_gen.poll(task, str(clip), 12)
        record.update(status='completed' if result == 0 else 'not_completed', video='source.mp4' if result == 0 else None)
        path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
        raise SystemExit(result)
    except (TimeoutError, OSError) as exc:
        print('transport issue; retain and resume task:', type(exc).__name__, flush=True)
        if attempt == 2:
            raise
        time.sleep(15)
