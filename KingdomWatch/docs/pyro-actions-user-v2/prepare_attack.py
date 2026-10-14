"""Preserve the new user attack; reuse the established green-screen extraction."""
from pathlib import Path
import importlib.util
import shutil

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
spec = importlib.util.spec_from_file_location('pyro_attack_source_v2', GAME/'docs/pyro-attack-user-v1/prepare_source.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
source.ROOT = OUT/'attack'
source.SOURCE = Path('C:/Users/user/Downloads/lens-api-task_WHW1YsGLlVVLTH0fgJbd6F9uFMl5zUJG.mp4')
source.ROOT.mkdir(parents=True, exist_ok=True)
source.main()
idle = OUT/'idle'
idle.mkdir(exist_ok=True)
first = GAME/'docs/pyro-idle-user-v1/original-frames/frame-00.png'
shutil.copy2(first, idle/'first-frame.png')
shutil.copy2(first, GAME.parent/'美术/vfx_host/hero_pyro_idle_loop_v2_20261015_ff.png')
