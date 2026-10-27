"""Short 30fps previews from the 60fps offline render. GIF ticks must preserve duration."""
from pathlib import Path
from PIL import Image
import imageio.v2 as imageio

out=Path(__file__).resolve().parent
palette=Image.open(out/'contact-sheet.jpg').convert('RGB').quantize(colors=256)
for kind in ['skill','ultimate']:
    reader=imageio.get_reader(out/(kind+'-review.mp4'))
    frames=[Image.fromarray(frame).resize((450,564),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.NONE)
            for i,frame in enumerate(reader) if i%2==0]
    reader.close()
    frames[0].save(out/(kind+'-review.gif'),save_all=True,append_images=frames[1:],
        duration=[[30,40,30][i%3] for i in range(len(frames))],loop=0,disposal=1,optimize=False)
    print(kind,len(frames),'frames')
