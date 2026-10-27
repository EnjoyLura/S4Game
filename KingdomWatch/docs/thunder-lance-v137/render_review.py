"""Offscreen actual GLSL and cosmetic draw commands only; never boots the game."""
import sys,json,re,struct,math
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl,numpy as np
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1];REC=ROOT/'local/art-archive/thunder-lance-v137/review'
recipes=json.loads((REC/'recipes.json').read_text('utf8'));W,H,BOTTOM=750,940,-100
ctx=moderngl.create_standalone_context(require=330);tex=ctx.texture((W,H),4,dtype='f4');fbo=ctx.framebuffer(color_attachments=[tex]);fbo.use()
vert='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(ROOT/'assets/resources/fx/thunder-lance-flow.effect').read_text('utf8')
frag=re.search(r'CCProgram thunder-lance-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
program=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
program['LanceFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','pos','texcoord')])
flat=ctx.program(vertex_shader=vert,fragment_shader='''#version 330
in vec2 uv0;uniform sampler2D image;out vec4 fragColor;void main(){fragColor=texture(image,uv0);}
''');imagevao=ctx.vertex_array(flat,[(vbo,'2f 2f','pos','texcoord')])
def vertices(x,y,w,h,angle=0):
 c,s=math.cos(angle),math.sin(angle);vals=[]
 for px,py,u,v in [(-w/2,-h/2,0,1),(w/2,-h/2,1,1),(-w/2,h/2,0,0),(w/2,h/2,1,0)]:vals.extend([(x+px*c-py*s)/(W/2),2*(y+px*s+py*c-BOTTOM)/H-1,u,v])
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
sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA');x,y,w,h=mf
mob=sheet.crop((x,y,x+w,y+h)).resize((105,105));mobtex=ctx.texture(mob.size,4,mob.tobytes())
def layer(name):
 im=Image.open(REC/name).convert('RGBA');tex=ctx.texture(im.size,4,im.tobytes());image(tex,0,BOTTOM+H/2,W,H);tex.release()
def frame(rec):
 fbo.clear();ctx.disable(moderngl.BLEND);image(bgtex,0,BOTTOM+H/2,W,H)
 ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE);layer(rec['groundGraphics'])
 ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for q in rec['ground']:draw(q)
 ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for x,y in [(-100,250),(120,330),(75,190)]:image(mobtex,x,y,105,105)
 layer(rec['graphics']);ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for q in rec['air']:draw(q)
 ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE);layer(rec['frontGraphics'])
 return pixels()
samples=[]
for mode in range(5):
 for t in [0,.02,.1,.3,.6,.98,1]:
  q=[0,300,300,510 if mode==0 else 300,0,t,.37,1,mode,180,t if mode else .095]
  ctx.disable(moderngl.BLEND);fbo.clear();draw(q);arr=values();assert np.isfinite(arr).all() and arr.min()>=0 and arr[:,:,3].max()<=1.00001
  q[7]=0;fbo.clear();draw(q);assert values().max()==0
  samples.append({'mode':mode,'age':t,'finite':True,'zeroPowerInvisible':True})
contact=[]
for kind in ['normal','recall-rain','ultimate']:
 rr=[r for r in recipes['frames'] if r['kind']==kind];frames=[frame(r).resize((375,470),Image.Resampling.LANCZOS) for r in rr]
 frames[0].save(OUT/(kind+'-review.webp'),save_all=True,append_images=frames[1:],duration=42,loop=0,quality=89)
 for t in ([.08,.3,1.15] if kind=='ultimate' else [.1,.8,1.8]):
  rec=min(rr,key=lambda r:abs(r['age']-t));im=frame(rec);im.save(OUT/(kind+'-'+str(t)+'.png'))
  tile=im.resize((300,376));ImageDraw.Draw(tile).text((10,10),kind+' / '+str(t)+'s',fill='white');contact.append(tile)
grid=Image.new('RGB',(900,1128))
for i,im in enumerate(contact):grid.paste(im,(i%3*300,i//3*376))
grid.save(OUT/'contact-sheet.jpg',quality=92)
(OUT/'gpu-review.json').write_text(json.dumps({'status':'PASS','samples':samples,'cosmeticFrames':len(recipes['frames']),
 'gameEngineBrowserBattleAudioOrWasmStarted':False},indent=2)+'\n')
print(json.dumps({'status':'PASS','gpuSamples':len(samples),'cosmeticFrames':len(recipes['frames'])}));ctx.release()
