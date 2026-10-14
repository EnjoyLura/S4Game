"""Use the existing project MiniMax H3 tool, recording the task before polling."""
from pathlib import Path
import argparse, json, sys, time
from types import SimpleNamespace

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[2] / '美术' / 'tools'))
import art_video_gen
from hero_idle_loop import CONTRACT

ap = argparse.ArgumentParser()
ap.add_argument('--hero', choices=['archer', 'sniper', 'volt'], required=True)
ap.add_argument('--image-url', required=True)
ap.add_argument('--resume')
ap.add_argument('--seconds', type=int, default=1)
ap.add_argument('--take', choices=['idle-v2', 'idle-v3', 'idle-v4'])
ap.add_argument('--output-dir', type=Path, help='Optional standalone production directory; existing task resume rules still apply')
ap.add_argument('--prompt-file', type=Path, help='Optional motion prompt; defaults to idle-prompt.txt in the production directory')
args = ap.parse_args()
outdir = args.output_dir.resolve() if args.output_dir else (ROOT / args.hero / args.take if args.take else ROOT / args.hero)
outdir.mkdir(parents=True, exist_ok=True)
prompt_path = args.prompt_file.resolve() if args.prompt_file else outdir / 'idle-prompt.txt'
record_path = outdir / 'video-task.json'
record = json.loads(record_path.read_text(encoding='utf-8')) if record_path.exists() else {}
task = args.resume or record.get('taskId')
if not task:
    # Apply the persistent user requirement on every new idle submission.
    # Existing task records and their historical prompts are left untouched.
    loop_prompt = (ROOT.parents[2] / '美术/tools/hero_idle_loop_prompt.txt').read_text(encoding='utf-8')
    effective_prompt = outdir / 'idle-prompt-effective.txt'
    effective_prompt.write_text(prompt_path.read_text(encoding='utf-8').rstrip() + '\n\n' + loop_prompt,
                                encoding='utf-8')
    spec = SimpleNamespace(model='lens-minimax-h3-768p', seconds=args.seconds, ratio='3:4',
                           resolution=None, image=args.image_url,
                           prompt_file=str(effective_prompt), prompt=None)
    task = art_video_gen.submit(spec)
    if not task:
        raise SystemExit(1)
    record = {'hero': args.hero, 'taskId': task, 'model': spec.model,
              'secondsRequested': spec.seconds, 'ratioRequested': spec.ratio,
              'imageUrl': args.image_url, 'promptFile': effective_prompt.name,
              'basePromptFile': prompt_path.name, 'idleLoopRequirement': CONTRACT,
              'status': 'submitted', 'sourceTool': '美术/tools/art_video_gen.py'}
    record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
else:
    print('resume task:', task, flush=True)
clip = outdir / 'source.mp4'
valid_saved_video = clip.exists() and clip.stat().st_size >= 1024 and b'ftyp' in clip.read_bytes()[:128]
if valid_saved_video and record.get('status') == 'completed':
    print('already saved:', clip, flush=True)
    raise SystemExit(0)
for attempt in range(3):
    try:
        result = art_video_gen.poll(task, str(clip), 12)
        record['status'] = 'completed' if result == 0 else 'not_completed'
        record['video'] = 'source.mp4' if result == 0 else None
        record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
        raise SystemExit(result)
    except (TimeoutError, OSError) as exc:
        print('transport issue; resuming same task:', type(exc).__name__, flush=True)
        if attempt == 2:
            raise
        time.sleep(15)
