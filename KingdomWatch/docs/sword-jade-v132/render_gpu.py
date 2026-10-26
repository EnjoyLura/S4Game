"""Actual effect GLSL and actual cosmetic geometry, rendered offscreen; no game/engine/battle."""
import sys,json,re,struct,hashlib,math
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl,numpy as np
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
REC=ROOT/'local/art-archive/sword-jade-v132/review'
recipes=json.loads((REC/'recipes.json').read_text('utf8'));W,H=recipes['width'],recipes['height'];BOTTOM=recipes['bottom']
ctx=moderngl.create_standalone_context(require=330)
tex=ctx.texture((W,H),4,dtype='f4');fbo=ctx.framebuffer(color_attachments=[tex]);fbo.use()
vert='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(ROOT/'assets/resources/fx/sword-jade-flow.effect').read_text('utf8')
frag=re.search(r'CCProgram sword-jade-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
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
for mode in range(5):
 for age in [.01,.08,.18,.4,.75,1.2]:
  r=180;w,h=(.9*r,2.7*r) if mode==0 else (2.6*r,1.5*r)
  q=[0,320,w,h,0,age,.73,1,mode,r,1 if mode==0 else 2.8]
  ctx.disable(moderngl.BLEND);fbo.clear();draw(q);a=values()
  assert np.isfinite(a).all() and a.min()>=0 and a[:,:,3].max()==0
  lit=int((a[:,:,:3].max(axis=2)>.025).sum())
  if mode==0:assert lit>100
  q[7]=0;fbo.clear();draw(q);assert values().max()==0
  samples.append({'mode':mode,'age':age,'litPixels':lit,'alpha':0,'finiteNonnegative':True})
bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
bg=bg.resize((W,H),Image.Resampling.LANCZOS);bgtex=ctx.texture((W,H),4,bg.tobytes())
def image(texture,x,y,w,h):
 vertices(x,y,w,h);texture.use();flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP)
mobframes=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf8'))['frames']
sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA')
x,y,w,h=mobframes['forest_guard'];mob=sheet.crop((x,y,x+w,y+h));mobtex=ctx.texture(mob.size,4,mob.tobytes())
def frame(rec):
 fbo.clear();ctx.disable(moderngl.BLEND);image(bgtex,0,BOTTOM+H/2,W,H)
 ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.ONE,moderngl.ONE,moderngl.ZERO,moderngl.ONE)
 for q in rec['ground']:draw(q)
 ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for mx,my in [(-100,90),(105,190),(0,290),(-140,350),(165,370)]:image(mobtex,mx,my,110,110*h/w)
 layer=Image.open(REC/rec['graphics']).convert('RGBA');t=ctx.texture(layer.size,4,layer.tobytes());image(t,0,BOTTOM+H/2,W,H);t.release()
 ctx.blend_func=(moderngl.ONE,moderngl.ONE,moderngl.ZERO,moderngl.ONE)
 for q in rec['air']:draw(q)
 return pixels()
review=[];contacts=Image.new('RGB',(W*4,H*2))
for row,kind in enumerate(['skill','heaven']):
 rr=[r for r in recipes['frames'] if r['kind']==kind]
 for t in ([.95,2.35] if kind=='skill' else [1.70,2.85]):
  r=min(rr,key=lambda r:abs(r['age']-t));frame(r).save(OUT/(kind+'-peak-'+str(t)+'.png'))
 for col,t in enumerate([.45,.9,1.65,2.25]):
  r=min(rr,key=lambda r:abs(r['age']-t));im=frame(r);d=ImageDraw.Draw(im);d.rectangle((0,0,W,30),fill='#15252e');d.text((12,10),f'{kind.upper()} / {r["age"]:.2f}s',fill='#e2ffe8');contacts.paste(im,(col*W,row*H))
 for r in rr:review.append((kind,frame(r).resize((375,470),Image.Resampling.LANCZOS)))
contacts.resize((1500,940),Image.Resampling.LANCZOS).save(OUT/'procedural-contact-sheet.jpg',quality=94)
for kind in ['skill','heaven']:
 frames=[im for k,im in review if k==kind];frames[0].save(OUT/(kind+'-review.webp'),save_all=True,append_images=frames[1:],duration=42,loop=0,quality=87,method=4)
report={'renderer':ctx.info['GL_RENDERER'],'shaderSha256':hashlib.sha256(source.encode()).hexdigest(),'pureCodeNoTextures':True,
 'samples':samples,'cosmeticFrames':len(review),'additiveAlphaZero':True,'runtimeGameBrowserBattleAudioOrWasmStarted':False,'phonePerformance':'pending user'}
(OUT/'gpu-review.json').write_text(json.dumps(report,indent=2)+'\n','utf8');print(json.dumps({'gpu':'PASS','samples':len(samples),'cosmeticFrames':len(review)}));ctx.release()
