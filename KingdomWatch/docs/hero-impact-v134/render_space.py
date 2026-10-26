"""Actual effect GLSL and actual cosmetic geometry, rendered offscreen; no game/engine/battle."""
import sys,json,re,struct,hashlib,math
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl,numpy as np
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
REC=ROOT/'local/art-archive/hero-impact-v134/review'
recipes=json.loads((REC/'space-recipes.json').read_text('utf8'));W,H=recipes['width'],recipes['height'];BOTTOM=recipes['bottom']
ctx=moderngl.create_standalone_context(require=330)
tex=ctx.texture((W,H),4,dtype='f4');fbo=ctx.framebuffer(color_attachments=[tex]);fbo.use()
vert='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(ROOT/'assets/resources/fx/space-sword-burst.effect').read_text('utf8')
frag=re.search(r'CCProgram space-sword-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
program=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
program['HeroFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','pos','texcoord')])
flat=ctx.program(vertex_shader=vert,fragment_shader='''#version 330
in vec2 uv0;uniform sampler2D image;out vec4 fragColor;void main(){fragColor=texture(image,uv0);}
''')
imagevao=ctx.vertex_array(flat,[(vbo,'2f 2f','pos','texcoord')])
def vertices(x,y,w,h,angle=0):
 c,s=math.cos(angle),math.sin(angle);vals=[]
 for px,py,u,v in [(-w/2,-h/2,0,1),(w/2,-h/2,1,1),(-w/2,h/2,0,0),(w/2,h/2,1,0)]:
  vals.extend([(x+px*c-py*s)/(W/2),2*(y+px*s+py*c-BOTTOM)/H-1,u,v])
 vbo.write(struct.pack('16f',*vals))
def draw(q):
 x,y,w,h,angle,age,seed,power,mode,r,duration=q
 vertices(x,y,w,h,math.radians(angle));ubo.write(struct.pack('8f',age,seed,power,mode,w,h,r,duration));vao.render(moderngl.TRIANGLE_STRIP)
def values():return np.frombuffer(fbo.read(components=4,dtype='f4'),dtype=np.float32).reshape(H,W,4)
def pixels():return Image.fromarray(np.uint8(np.clip(values()[:,:,:3],0,1)*255)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
samples=[]
for mode in [0,1,3,4,5,6,7]:
 for age in [.01,.18,.55,.9,1.2,2.8]:
  r=105;w,h=(r*3.2,r*3.8) if mode==1 else (r*2.8,r*2.8)
  q=[0,300,w,h,0,age,.73,1,mode,r,3 if mode==1 else 1.5]
  ctx.disable(moderngl.BLEND);fbo.clear();draw(q);a=values()
  assert np.isfinite(a).all() and a.min()>=0 and a[:,:,3].max()<=1.00001
  q[7]=0;fbo.clear();draw(q);assert values().max()==0
  samples.append({'mode':mode,'age':age,'alphaMax':float(a[:,:,3].max()),'finite':True})
bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA').resize((W,H));bgtex=ctx.texture((W,H),4,bg.tobytes())
def image(texture,x,y,w,h):
 vertices(x,y,w,h);texture.use();flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP)
mf=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text())['frames']['forest_guard']
sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA');x,y,w,h=mf;mob=sheet.crop((x,y,x+w,y+h)).resize((110,110));mobtex=ctx.texture(mob.size,4,mob.tobytes())
def frame(rec):
 fbo.clear();ctx.disable(moderngl.BLEND);image(bgtex,0,BOTTOM+H/2,W,H)
 ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 if rec['kind']=='space-transit':
  actor=mob.copy();actor.putalpha(actor.getchannel('A').point(lambda v:round(v*rec['transitOpacity'])))
  tex=ctx.texture(actor.size,4,actor.tobytes());image(tex,-90,507 if rec['moved'] else 207,110,110);tex.release()
  image(mobtex,110,357,110,110)
 else:
  for x,y in [(-90,207),(110,357),(-140,490)]:image(mobtex,x,y,110,110)
 layer=Image.open(REC/rec['graphics']).convert('RGBA');tex=ctx.texture(layer.size,4,layer.tobytes());image(tex,0,BOTTOM+H/2,W,H);tex.release()
 ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for q in rec['quads']:draw(q)
 return pixels()
for kind in ['space-ult','space-transit','space-normal']:
 rr=[r for r in recipes['frames'] if r['kind']==kind];frames=[frame(r).resize((375,470),Image.Resampling.LANCZOS) for r in rr]
 frames[0].save(OUT/(kind+'-review.webp'),save_all=True,append_images=frames[1:],duration=42,loop=0,quality=88)
 for t in ([.6,1.12,1.7] if kind=='space-ult' else [.22,.58,1.05]):
  rec=min(rr,key=lambda r:abs(r['age']-t));frame(rec).save(OUT/(kind+'-'+str(t)+'.png'))
report={'shaderSha256':hashlib.sha256(source.encode()).hexdigest(),'samples':samples,'frames':len(recipes['frames']),'actualGameEngineBrowserBattleAudioWasmStarted':False}
(OUT/'space-gpu-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'PASS','samples':len(samples),'frames':len(recipes['frames'])}));ctx.release()
