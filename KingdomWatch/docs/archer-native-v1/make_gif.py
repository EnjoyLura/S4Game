"""Package browser-rendered frames; never synthesizes or repaints character artwork."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parent
frames=[Image.open(p).convert('RGB').resize((720,510),Image.Resampling.LANCZOS) for p in sorted((root/'preview-frames').glob('*.png'))]
frames[0].save(root/'archer-native-preview.gif',save_all=True,append_images=frames[1:],duration=65,loop=0,optimize=True)
print({'frames':len(frames),'bytes':(root/'archer-native-preview.gif').stat().st_size})
