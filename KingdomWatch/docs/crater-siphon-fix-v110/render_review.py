"""Render the actual isolated fragment program in a hidden offscreen OpenGL context.
No game engine, scene, browser, damage simulation, audio or WASM is launched.
"""
import sys,json,re,struct,hashlib
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
r=json.loads((OUT/'review-recipes.json').read_text('utf-8'));W,H=r['width'],r['height'];bottom=r['bottom']
ctx=moderngl.create_standalone_context(require=330)
fbo=ctx.simple_framebuffer((W,H));fbo.use();ctx.enable(moderngl.BLEND)
ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA)
vert='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(PROJECT/'assets/resources/fx/hero-impact-flow.effect').read_text('utf-8')
frag=re.search(r'CCProgram hero-flow-fs %\{(.*?)\}%\s*$',source,re.S).group(1)
frag=frag.replace('precision highp float;','')
program=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
program['HeroFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
flat=ctx.program(vertex_shader=vert,fragment_shader='''#version 330
in vec2 uv0;uniform sampler2D image;out vec4 fragColor;void main(){fragColor=texture(image,uv0);}
''')
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','pos','texcoord')]);imagevao=ctx.vertex_array(flat,[(vbo,'2f 2f','pos','texcoord')])
def vertices(x,y,w,h,angle=0):
    import math
    c,s=math.cos(math.radians(angle)),math.sin(math.radians(angle));vals=[]
    for px,py,u,v in [(-w/2,-h/2,0,1),(w/2,-h/2,1,1),(-w/2,h/2,0,0),(w/2,h/2,1,0)]:
        xx=x+px*c-py*s;yy=y+px*s+py*c
        vals.extend([xx/(W/2),2*(yy-bottom)/H-1,u,v])
    vbo.write(struct.pack('16f',*vals))
def texture(im):return ctx.texture(im.size,4,im.convert('RGBA').tobytes())
bg=Image.open(PROJECT/'assets/resources/scenes/scene_1_1.png').convert('RGBA')
# Crop the existing ground; this is an art placement review, not a captured game scene.
bg=bg.crop((int(bg.width*.16),int(bg.height*.23),int(bg.width*.84),int(bg.height*.75))).resize((W,H),Image.Resampling.LANCZOS)
bgtex=texture(bg)
def image(t):
    vertices(0,bottom+H/2,W,H);t.use();flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP)
allframes={'bomb':[],'siphon':[]}
for frame in r['frames']:
    fbo.clear(.1,.1,.1,1);image(bgtex)
    for layer in frame['layers']:
        ctx.blend_func=(moderngl.ONE,moderngl.ONE) if layer.get('emissive') else (moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA)
        if 'image' in layer:
            t=texture(Image.open(OUT/'review-frames'/layer['image']));image(t);t.release()
        else:
            for x,y,w,h,angle,age,seed,power,mode,metric,*extra in layer['quads']:
                ubo.write(struct.pack('8f',age,seed,power,mode,w,h,metric,extra[0] if extra else 0))
                vertices(x,y,w,h,angle);vao.render(moderngl.TRIANGLE_STRIP)
    im=Image.frombytes('RGB',(W,H),fbo.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    allframes[frame['kind']].append(im)
sheet=Image.new('RGB',(W*4,H*2),'#18222b')
for row,(kind,ids) in enumerate([('bomb',[6,18,45,78]),('siphon',[8,32,73,105])]):
    for col,i in enumerate(ids):
        im=allframes[kind][i].copy();d=ImageDraw.Draw(im);d.rectangle((0,0,W,26),fill='#21313a');d.text((9,7),f'{kind}   {i/30:.2f}s',fill='white');sheet.paste(im,(col*W,row*H))
sheet.resize((1440,810),Image.Resampling.LANCZOS).save(OUT/'gpu-contact-sheet.jpg',quality=94)
for name,frames in allframes.items():
    frames=[im.resize((384,432),Image.Resampling.LANCZOS) for im in frames]
    frames[0].save(OUT/(name+'-review.gif'),save_all=True,append_images=frames[1:],duration=([30,30,40]*((len(frames)+2)//3))[:len(frames)],loop=0,optimize=False)
(OUT/'gpu-review.json').write_text(json.dumps({'renderer':ctx.info['GL_RENDERER'],'version':ctx.info['GL_VERSION'],'fragmentProgram':'actual hero-impact-flow.effect, vertex projection adapted to offscreen art canvas','shaderSourceSha256':hashlib.sha256(source.encode('utf-8')).hexdigest(),'drawingSourceSha256':hashlib.sha256((PROJECT/'assets/scripts/battle/AdvancedHeroVFX.ts').read_bytes()).hexdigest(),'frames':{k:len(v) for k,v in allframes.items()},'gameBrowserAudioOrWasmStarted':False,'engineBlendingAndPhonePerformance':'not verified'},ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'gpu':ctx.info['GL_RENDERER'],'renderedArtFrames':sum(map(len,allframes.values())),'gameStarted':False}))
ctx.release()
