"""Art compositing preview on the game's floor, not a browser/gameplay capture."""
from pathlib import Path
import math
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
out = Path(__file__).parent
data = json.loads((root/'assets/resources/fx/frost_ice_v4.frames.json').read_text())
parts = {name: Image.open(out/(name+'.png')).convert('RGBA') for name in data['frames']}
mist = Image.open(root/'assets/resources/fx/frost_mist_v3.png').convert('RGB')
floor = Image.open(root/'assets/resources/scenes/scene_1_1.png').convert('RGB')
floor = floor.crop((90, 600, 1060, 1376)).resize((600, 480), Image.Resampling.LANCZOS)
cx, cy, radius, hold = 300, 274, 125, 1.5
clamp = lambda n: max(0, min(1, n))

def painted(canvas, name, x, y, width, alpha, angle=0, height=None):
    if alpha <= 1 or width < 1 or (height is not None and height < 1): return
    w, h = int(width), int(width if height is None else height)
    asset = parts[name].resize((w, h), Image.Resampling.LANCZOS)
    ax, ay = data['metrics'][name]['anchor']
    # Use a padded canvas so rotations keep the source pivot at its logical foot point.
    pad = Image.new('RGBA', (max(w,h)*3, max(w,h)*3))
    pivot = pad.width//2
    pad.alpha_composite(asset, (round(pivot-ax*w), round(pivot-(1-ay)*h)))
    if angle: pad = pad.rotate(angle, Image.Resampling.BICUBIC)
    rgb = np.array(pad)
    rgb[:,:,3] = np.clip(rgb[:,:,3].astype(float)*alpha/255, 0, 255).astype('uint8')
    canvas.alpha_composite(Image.fromarray(rgb), (round(x-pivot), round(y-pivot)))

def render(age):
    thaw = clamp((age-hold)/.55); fade = 1-thaw
    opening = 1-(1-clamp((age+.025)/.14))**3
    canvas = floor.convert('RGBA')
    if age >= hold+.55: return canvas.convert('RGB')
    # This preview approximates the shader's circulating wisps; source ground stays visible.
    span = radius*2.4*(.52+.48*opening)*(1+thaw*.09)
    vapor = mist.resize((int(span),int(span)),Image.Resampling.LANCZOS).rotate(age*35+46,Image.Resampling.BICUBIC)
    light = Image.new('RGB',floor.size)
    light.paste(vapor,(round(cx-span/2),round(cy-span/2)))
    rgb = np.clip(np.array(floor).astype(float)+np.array(light).astype(float)*.50*fade,0,255).astype('uint8')
    canvas = Image.fromarray(rgb).convert('RGBA')
    rim = radius*2/data['metrics']['rim']['span']*(.58+opening*.42+thaw*.035)
    painted(canvas,'rim',cx,cy,rim,(155+35*math.exp(-age*8))*fade*opening)
    growth = 1-(1-clamp(age/.16))**3
    settle = 1+math.sin(clamp(age/.28)*math.pi)*.10
    size = radius*.96/data['metrics']['spire']['height']
    painted(canvas,'spire',cx,cy-4,size*(.65+growth*.35),(174+30*math.exp(-age*9))*growth*(1-clamp(thaw/.60)),height=size*growth*settle)
    release = clamp(age/.32); breaking = age >= hold
    progress = thaw if breaking else release
    alpha = math.sin(progress*math.pi)*(180 if breaking else 96)
    size = radius*((.90+thaw*1.40) if breaking else (.55+release*1.45))/data['metrics']['burst']['span']
    painted(canvas,'burst',cx,cy-(5 if breaking else 0),size,alpha)
    for k in range(6):
        a = k*2.399+.8
        travel = .16+progress*(.66+k%3*.09) if breaking else .32+progress*(.37+k%3*.07)
        rr = radius*travel
        alpha = math.sin(progress*math.pi)*(200 if breaking else 165)
        height = (10 if breaking else 7)+k%3*3
        size = height/data['metrics']['shard']['height']*(1-progress*.32)
        x = cx+math.cos(a)*rr
        y = cy-math.sin(a)*rr-math.sin(progress*math.pi)*(20 if breaking else 13)
        painted(canvas,'shard',x,y,size,alpha,a*57.2958+progress*(65 if k%2 else -65))
    return canvas.convert('RGB')

frames = [render(k*.05) for k in range(48)]
palette_source=Image.new('RGB',(1200,960))
for k,t in enumerate((.08,.4,1.6,1.8)): palette_source.paste(render(t),(k%2*600,k//2*480))
palette=palette_source.quantize(colors=256)
frames=[im.quantize(palette=palette,dither=Image.Dither.NONE) for im in frames]
frames[0].save(out/'ice-effect-preview.gif',save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=False)
render(.35).save(out/'ice-effect-preview.png')
print(out/'ice-effect-preview.gif')
