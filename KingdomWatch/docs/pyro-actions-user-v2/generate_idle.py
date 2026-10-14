"""Submit one explicitly 768p MiniMax task; persist id before waiting."""
from pathlib import Path
from argparse import Namespace
from datetime import datetime
import importlib.util
import json
import sys

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location('project_video_api', GAME.parent/'美术/tools/art_video_gen.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
sys.stdout.reconfigure(encoding='utf-8')
folder = OUT/'idle'
task_file = folder/'video-task.json'
if task_file.exists():
    task = json.loads(task_file.read_text(encoding='utf-8'))['taskId']
else:
    args = Namespace(model='lens-minimax-h3-768p', seconds=2, ratio='16:9', resolution='768p',
        image='https://kw-vfx-src.pages.dev/hero_pyro_idle_loop_v2_20261015_ff.png',
        additional_images=['https://kw-vfx-src.pages.dev/hero_pyro_idle_loop_v2_20261015_ff.png'],
        prompt_file=str(folder/'idle-prompt.txt'), prompt=None)
    task = api.submit(args)
    if not task:
        raise SystemExit(1)
    task_file.write_text(json.dumps({'taskId':task,'model':args.model,'resolution':args.resolution,
        'secondsRequested':args.seconds,'ratio':args.ratio,'image':args.image,'prompt':'idle-prompt.txt',
        'date':datetime.now().astimezone().isoformat(),'firstFrameUnchanged':True,
        'images':[args.image,*args.additional_images], 'identicalStartEndReferencesRequested':True,
        'providerEnforcesLastFrame':None,
        'closureRequired':True,'reversePlaybackAllowed':False,'userVisualAccepted':False},indent=2),encoding='utf-8')
raise SystemExit(api.poll(task,str(folder/'source.mp4'),12))
