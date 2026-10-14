"""Preserve every frame of the new source cycle and its generation provenance."""
from pathlib import Path
import hashlib
import importlib.util
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location('pyro_idle_source_v2', GAME/'docs/pyro-idle-user-v1/prepare_source.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
source.ROOT = OUT/'idle'
source.SOURCE = source.ROOT/'source.mp4'
source.main()
origin_path = source.ROOT/'source-origin.json'
record = json.loads(origin_path.read_text(encoding='utf-8'))
record.pop('userSourcePath', None)
record.update(kind='idle', userProvidedVideo=False, paidTaskSubmitted=True,
    requestedResolution='768p', model='lens-minimax-h3-768p',
    taskId=json.loads((source.ROOT/'video-task.json').read_text(encoding='utf-8'))['taskId'],
    firstFrameSha256=hashlib.sha256((source.ROOT/'first-frame.png').read_bytes()).hexdigest(),
    previousIdle='pyro_idle_user_v1', reason='User reported end-to-start jump',
    completeNativeForwardCycleRequired=True, reversePlayback=False, userVisualAccepted=False)
origin_path.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
