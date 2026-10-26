"""Actual effect GLSL and actual cosmetic geometry, rendered offscreen; no game/engine/battle."""
import sys,json,re,struct,hashlib,math
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl,numpy as np
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
REC=ROOT/'local/art-archive/sword-wind-ground-v136/review'
recipes=json.loads((REC/'recipes.json').read_text('utf8'));W,H=recipes['width'],recipes['height'];BOTTOM=recipes['bottom']
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

def compiled(name,programName):
 source=(ROOT/('assets/resources/fx/'+name+'.effect')).read_text('utf8')
 frag=re.search(r'CCProgram '+programName+r' %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
 p=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
 p['HeroFlow'].binding=0
 return p,ctx.vertex_array(p,[(vbo,'2f 2f','pos','texcoord')])
spaceVAO=vao;swordProgram,swordVAO=compiled('sword-jade-flow','sword-jade-fs')
bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA').resize((W,H));bgtex=ctx.texture((W,H),4,bg.tobytes())
def image(texture,x,y,w,h):
 vertices(x,y,w,h);texture.use();flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP)

def layer(name):
 im=Image.open(REC/name).convert('RGBA');tex=ctx.texture(im.size,4,im.tobytes());image(tex,0,BOTTOM+H/2,W,H);tex.release()
mf=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text())['frames']['forest_guard']
sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA');x,y,w,h=mf;mob=sheet.crop((x,y,x+w,y+h)).resize((110,110));mobtex=ctx.texture(mob.size,4,mob.tobytes())
eyeManifest=json.loads((ROOT/'assets/resources/fx/wind_eye_video_v129.frames.json').read_text())
atlas=Image.open(ROOT/'assets/resources/fx/wind_eye_video_v129.png').convert('RGBA');cells=[];reverseCells=[]
for i in range(eyeManifest['frameCount']):
 x,y,wc,hc=eyeManifest['frames'][eyeManifest['framePrefix']+str(i)];cell=atlas.crop((x,y,x+wc,y+hc));cells.append(ctx.texture(cell.size,4,cell.tobytes()));reverseCells.append(ctx.texture(cell.size,4,cell.transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes()))

def frame(rec,beforeEye=False):
 global vao
 vao=swordVAO if 'sword' in rec['kind'] else spaceVAO
 fbo.clear();ctx.disable(moderngl.BLEND);image(bgtex,0,BOTTOM+H/2,W,H)
 ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 if not beforeEye:layer(rec['groundGraphics'])
 ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for q in rec['ground']:draw(q)
 ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 if rec['kind']=='wind-eye':
  m=eyeManifest;rw=150*m['visualWidthPerRadius'];rh=rw*hc/wc*m['displayHeightScale']
  index=math.floor(rec['age']*m['fps']*m['playbackSpeed']+1e-7)%m['frameCount']
  image((cells if beforeEye else reverseCells)[index],0,220+m['displayOffsetY']+rh*(.5-m['groundAnchor'][1]),rw,rh)
 if rec['kind']=='space-transit':
  actor=mob.copy();actor.putalpha(actor.getchannel('A').point(lambda v:round(v*rec['transitOpacity'])))
  tex=ctx.texture(actor.size,4,actor.tobytes());image(tex,-90,507 if rec['moved'] else 207,110,110);tex.release()
  image(mobtex,110,357,110,110)
 else:
  for x,y in [(-90,207),(110,357),(-140,490)]:image(mobtex,x,y,110,110)
 layer(rec['graphics'])
 ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for q in rec['air']:draw(q)
 ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 layer(rec['frontGraphics'])
 return pixels()
samples=[]
for mode in [1,3,4,5,6,7,8,9]:
 for age in [.01,.18,.55,.9,1.2,2.8]:
  vao=spaceVAO;r=105;w,h=(r*3.2,r*3.8) if mode==1 else (r*2.8,r*2.8)
  q=[0,300,w,h,0,age,.73,1,mode,r,3 if mode==1 else 1.5]
  ctx.disable(moderngl.BLEND);fbo.clear();draw(q);a=values()
  assert np.isfinite(a).all() and a.min()>=0 and a[:,:,3].max()<=1.00001
  q[7]=0;fbo.clear();draw(q);assert values().max()==0
  samples.append({'mode':mode,'age':age,'finite':True})
for age in [.01,.10,.30,.55,.68,.9]:
 vao=swordVAO;q=[0,300,928,464,0,age,.37,.65,7,320,.68]
 ctx.disable(moderngl.BLEND);fbo.clear();draw(q);a=values();assert np.isfinite(a).all() and a.min()>=0 and a[:,:,3].max()==0
 if age>=.68:assert a.max()==0
 samples.append({'mode':'swordWave','age':age,'finite':True})
# The part beyond the ground plane is absent in both alpha and emitted RGB, for both sword classes.
for variant in [2,3]:
 for age in [.04,.12,.50]:
  vao=swordVAO;r=180 if variant==2 else 358.4;t=min(1,age/.12);buried=(.075 if variant==2 else .085)*t*t*(3-2*t)
  q=[0,300,r*.9,r*2.7,0,age,.37,1,0,r,variant]
  ctx.disable(moderngl.BLEND);fbo.clear();draw(q);a=values()
  y=300+(.65-buried)*r+3;row=max(0,min(H,int(y-BOTTOM)+1))
  assert np.isfinite(a).all() and a.min()>=0 and a[row:,:,:].max()<1e-5
  samples.append({'mode':'buriedSword','age':age,'variant':variant,'buriedPartInvisible':True})
contacts=[]
for kind in ['space-transit','skill-swords','final-sword','wind-eye']:
 rr=[r for r in recipes['frames'] if r['kind']==kind];frames=[frame(r).resize((375,470),Image.Resampling.LANCZOS) for r in rr]
 frames[0].save(OUT/(kind+'-review.webp'),save_all=True,append_images=frames[1:],duration=42,loop=0,quality=88)
 for t in ([.22,1.50,2.70] if kind=='space-transit' else [.08,.24,.65]):
  rec=min(rr,key=lambda r:abs(r['age']-t));im=frame(rec);im.save(OUT/(kind+'-'+str(t)+'.png'))
  tile=im.resize((300,376));ImageDraw.Draw(tile).text((10,10),kind+' / '+str(t)+'s',fill='white');contacts.append(tile)
 if kind=='wind-eye':
  rec=rr[15];comparison=Image.new('RGB',(750,470));comparison.paste(frame(rec,True).resize((375,470)),(0,0));comparison.paste(frame(rec).resize((375,470)),(375,0));d=ImageDraw.Draw(comparison);d.text((10,10),'BEFORE / perspective',fill='white');d.text((385,10),'AFTER / reversed perspective',fill='white');comparison.save(OUT/'eye-ground-comparison.jpg',quality=92)
contact=Image.new('RGB',(900,1504))
for i,im in enumerate(contacts):contact.paste(im,(i%3*300,i//3*376))
contact.save(OUT/'contact-sheet.jpg',quality=92)
report={'status':'PASS','samples':samples,'frames':len(recipes['frames']),'actualGameEngineBrowserBattleAudioWasmStarted':False}
(OUT/'gpu-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'PASS','samples':len(samples),'frames':len(recipes['frames'])}));ctx.release()
