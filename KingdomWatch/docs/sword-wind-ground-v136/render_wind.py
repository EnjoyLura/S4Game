"""Offscreen production GLSL/flipbook composition only. No engine or battle."""
import sys,json,re,struct,hashlib,math
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl,numpy as np
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1];W,H=600,800;BOTTOM=-100
ctx=moderngl.create_standalone_context(require=330)
tex=ctx.texture((W,H),4,dtype='f4');fbo=ctx.framebuffer(color_attachments=[tex]);fbo.use()
vert='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(ROOT/'assets/resources/fx/wind-ninja-flow.effect').read_text('utf8')
frag=re.search(r'CCProgram wind-ninja-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
program=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
program['HeroFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','pos','texcoord')])
flat=ctx.program(vertex_shader=vert,fragment_shader='''#version 330
in vec2 uv0;uniform sampler2D image;out vec4 fragColor;void main(){fragColor=texture(image,uv0);}
''');imagevao=ctx.vertex_array(flat,[(vbo,'2f 2f','pos','texcoord')])
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
def image(texture,x,y,w,h):
 vertices(x,y,w,h);texture.use();flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP)
bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA').resize((W,H));bgtex=ctx.texture((W,H),4,bg.tobytes())
mf=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text())['frames']['forest_guard']
sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA');x,y,w,h=mf;mob=sheet.crop((x,y,x+w,y+h));mobtex=ctx.texture(mob.size,4,mob.tobytes())
def scene():
 ctx.disable(moderngl.BLEND);fbo.clear();image(bgtex,0,300,W,H)
 ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for x,y in [(-100,160),(95,280),(-75,400),(40,510)]:image(mobtex,x,y,85,85*h/w)
samples=[]
for mode in [3]:
 for age in [.01,.13,.45,1.0,1.8,3.0]:
  r=181.25 if mode==2 else 30;q=[0,300,r*2.5 if mode==2 else 100,r*2.5 if mode==2 else 100,0,age,.73,1,mode,r,4]
  ctx.disable(moderngl.BLEND);fbo.clear();draw(q);a=values()
  assert np.isfinite(a).all() and a.min()>=0 and a[:,:,3].max()==0
  assert (a[:,:,:3]>.04).sum()>30
  q[7]=0;fbo.clear();draw(q);assert values().max()==0
  samples.append({'mode':mode,'age':age,'finiteNonnegative':True,'zeroAlpha':True})
for kind in ['wind-blade-close','wind-blade']:
 frames=[]
 for i in range(96):
  age=i/32;scene();ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
  if kind=='wind-blade-close':draw([0,290,200,200,90,age,.73,1,3,60,0])
  else:
   for k in range(3):
    t=(age*.8+k*.33)%1;angle=math.radians(75+k*12);x=-70+k*60+math.cos(angle)*t*360;y=40+math.sin(angle)*t*360
    draw([x,y,100,100,math.degrees(angle),t,.73,1,3,30,0])
  im=pixels();frames.append(im.resize((375,500),Image.Resampling.LANCZOS))
  if i==25:im.save(OUT/(kind+'-peak.png'))
 frames[0].save(OUT/(kind+'-review.webp'),save_all=True,append_images=frames[1:],duration=31,loop=0,quality=88,method=4)

(OUT/'wind-review.json').write_text(json.dumps({'status':'PASS','samples':samples,'frames':192,'gameEngineBrowserBattleAudioWasmStarted':False},indent=2)+'\n');print('PASS: 192 wind blade frames');ctx.release()
