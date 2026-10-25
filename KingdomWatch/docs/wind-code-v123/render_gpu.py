"""Actual isolated effect GLSL on an offscreen GPU canvas, never a game or browser."""
import sys,json,re,struct,hashlib,math,time
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1];W,H=400,440;BOTTOM=-180
ctx=moderngl.create_standalone_context(require=330)
tex=ctx.texture((W,H),4,dtype='f4');fbo=ctx.framebuffer(color_attachments=[tex]);fbo.use()
ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
vert='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(PROJECT/'assets/resources/fx/wind-ninja-flow.effect').read_text('utf-8')
frag=re.search(r'CCProgram wind-ninja-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
program=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
program['HeroFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','pos','texcoord')])
assert not re.search(r'\b(?:sampler2D|samplerCube|texture)\b',re.sub(r'//[^\n]*','',frag))
recipes=json.loads((PROJECT/'local/art-archive/wind-code-v123/review-recipes.json').read_text('utf-8'))['frames']
def vertices(x,y,w,h,angle=0):
 c,s=math.cos(angle),math.sin(angle);vals=[]
 for px,py,u,v in [(-w/2,-h/2,0,1),(w/2,-h/2,1,1),(-w/2,h/2,0,0),(w/2,h/2,1,0)]:
  xx=x+px*c-py*s;yy=y+px*s+py*c;vals.extend([xx/(W/2),2*(yy-BOTTOM)/H-1,u,v])
 vbo.write(struct.pack('16f',*vals))
def image_from_raw(raw):
 vals=memoryview(raw).cast('f');out=bytearray(W*H*3)
 for i in range(W*H):
  for k in range(3):out[i*3+k]=round(max(0,min(1,vals[i*4+k]))*255)
 return Image.frombytes('RGB',(W,H),bytes(out)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
flat=ctx.program(vertex_shader=vert,fragment_shader='''#version 330
in vec2 uv0;uniform sampler2D image;out vec4 fragColor;void main(){fragColor=texture(image,uv0);}
''')
imagevao=ctx.vertex_array(flat,[(vbo,'2f 2f','pos','texcoord')])
bg=Image.open(PROJECT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
bg=bg.crop((int(bg.width*.20),int(bg.height*.25),int(bg.width*.80),int(bg.height*.72))).resize((W,H),Image.Resampling.LANCZOS)
bgtex=ctx.texture((W,H),4,bg.tobytes())
mobframes=json.loads((PROJECT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf-8'))['frames']
mobsheet=Image.open(PROJECT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA');mobs=[]
for name,x,y,w in [('forest_guard',-42,32,94),('forest_wasp',55,86,70),('forest_spider',18,-43,80)]:
 xx,yy,ww,hh=mobframes[name];im=mobsheet.crop((xx,yy,xx+ww,yy+hh));t=ctx.texture(im.size,4,im.tobytes());mobs.append((t,x,y,w,w*hh/ww))
font=ImageFont.truetype(str(PROJECT/'assets/resources/fonts/CombatDigits.ttf'),24)
def background():
 ctx.disable(moderngl.BLEND);vertices(0,BOTTOM+H/2,W,H);bgtex.use();flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP);ctx.enable(moderngl.BLEND)
def draw(mode,age,power=1,radius=None,angle=0):
 r=radius or (120 if mode==1 else 140)
 if mode==1:w,h,x,y=r*2.6,r*3.3,0,r*.35
 elif mode==3:w,h,x,y=r/3*10,r/3*10,0,30
 else:w,h,x,y=r*2.5,r*2.5,0,0
 vertices(x,y,w,h,angle)
 ubo.write(struct.pack('8f',age,.73,power,mode,w,h,r,4));vao.render(moderngl.TRIANGLE_STRIP)
def frame(mode,age,recipe=None):
 fbo.clear(0,0,0,0);background()
 ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 for t,x,y,w,h in mobs:vertices(x,y,w,h);t.use(0);flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP)
 if recipe:
  layer=Image.new('RGBA',(W,H));pen=ImageDraw.Draw(layer)
  for c in recipe['commands']:
   points=[(round(x+W/2),round(H-(y-BOTTOM))) for x,y in c['points']]
   if len(points)<2:continue
   if c['kind']=='fill':pen.polygon(points,fill=tuple(c['color']))
   else:pen.line(points,fill=tuple(c['color']),width=max(1,round(c['width'])),joint='curve')
  t=ctx.texture((W,H),4,layer.tobytes());vertices(0,BOTTOM+H/2,W,H);t.use(0);flat['image']=0;imagevao.render(moderngl.TRIANGLE_STRIP);t.release()
 ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
 if recipe:
  for q in recipe['quads']:
   x,y,w,h,angle,a,seed,power,kind,r,*extra=q
   vertices(x,y,w,h,angle*math.pi/180);ubo.write(struct.pack('8f',a,seed,power,kind,w,h,r,extra[0] if extra else 0));vao.render(moderngl.TRIANGLE_STRIP)
 else:draw(mode,age)
 im=image_from_raw(fbo.read(components=4,dtype='f4'));d=ImageDraw.Draw(im)
 for _,x,y,w,h in mobs:d.text((int(x+W/2+24),int(H-(y+22-BOTTOM))),'96',font=font,fill='white',stroke_width=2,stroke_fill='#18242c')
 return im
names=['WIND EYE','MOVING TORNADO','NINJA ENERGY BLADE'];times=[.32,.85,1.45,2.15,2.9]
sheet=Image.new('RGB',(W*5,H*3))
for mode in range(3):
 for col,age in enumerate(times):
  kind=['eye','tornado','spiral'][mode];rec=min((f for f in recipes if f['kind']==kind),key=lambda f:abs(f['age']-age))
  im=frame(mode,age,rec);d=ImageDraw.Draw(im);d.rectangle((0,0,W,25),fill='#15252e');d.text((8,7),f'{names[mode]}   {age:.2f}s',fill='#DEF8EF');sheet.paste(im,(col*W,mode*H))
sheet.resize((1600,1056),Image.Resampling.LANCZOS).save(OUT/'gpu-contact-sheet.jpg',quality=95)
arcs=Image.new('RGB',(W*4,H))
for col,angle in enumerate([0,math.pi/2,math.pi,math.pi*1.5]):
 fbo.clear(0,0,0,0);background();draw(3,.7,radius=90,angle=angle)
 im=image_from_raw(fbo.read(components=4,dtype='f4'));d=ImageDraw.Draw(im);d.text((8,8),f'CRESCENT / TARGET AT {col*90} DEG',fill='#DEF8EF');arcs.paste(im,(col*W,0))
arcs.resize((1200,330),Image.Resampling.LANCZOS).save(OUT/'wind-blade-directions.jpg',quality=95)
# Black-background shader outputs check coverage, finite HDR and alpha without a carrier mask.
samples=[]
for mode in range(5):
 fbo.clear(0,0,0,0);ctx.disable(moderngl.BLEND);draw(mode,.73,radius=30 if mode==3 else None)
 raw=fbo.read(components=4,dtype='f4');v=memoryview(raw).cast('f')
 assert all(math.isfinite(x) and x>=0 for x in v)
 alpha=list(v[3::4]);assert all(0<=a<=.55001 for a in alpha)
 if mode>=2:assert max(alpha)==0
 lit=sum(max(v[i:i+3])>.025 for i in range(0,len(v),4));assert lit>40
 samples.append({'mode':mode,'litPixels':lit,'maxCoverageAlpha':max(alpha),'finiteNonnegative':True,'peakRGB':max(v)})
 fbo.clear(0,0,0,0);draw(mode,.73,power=0,radius=30 if mode==3 else None)
 assert max(memoryview(fbo.read(components=4,dtype='f4')).cast('f'))==0
 ctx.enable(moderngl.BLEND)
# GPU crescent front points at the target in four directions; its tail cannot define the aim axis.
directions=[]
ctx.disable(moderngl.BLEND)
for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
 fbo.clear(0,0,0,0);draw(3,.7,radius=30,angle=angle)
 values=memoryview(fbo.read(components=4,dtype='f4')).cast('f');sx=sy=n=0
 for j in range(W*H):
  if max(values[j*4:j*4+3])>.55:
   sx+=(j%W+.5)-W/2;sy+=(j//W+.5)+BOTTOM-30;n+=1
 assert n>15
 projection=(sx*math.cos(angle)+sy*math.sin(angle))/n;assert projection>3
 directions.append({'degrees':round(angle*180/math.pi),'brightArcForwardCentroid':round(projection,3),'hotPixels':n})
ctx.enable(moderngl.BLEND)
# 60 actual shader art frames per field at30fps. This is no battle/engine simulation.
start=time.perf_counter();frames=[]
for i in range(60):
 age=.10+i/30;row=Image.new('RGB',(900,330))
 for mode,kind in enumerate(['eye','tornado','spiral']):
  rec=next(f for f in recipes if f['kind']==kind and abs(f['age']-age)<1e-5)
  row.paste(frame(mode,age,rec).resize((300,330),Image.Resampling.LANCZOS),(mode*300,0))
 frames.append(row)
frames[0].save(OUT/'energy-review.webp',save_all=True,append_images=frames[1:],duration=33,loop=0,quality=85,method=4)
sequence=[frame(2,f['age'],f) for f in recipes if f['kind']=='ninja-sequence']
sequence[0].save(OUT/'ninja-launch.webp',save_all=True,append_images=sequence[1:],duration=33,loop=0,quality=85,method=4)
report={'shaderSourceSha256':hashlib.sha256((PROJECT/'assets/resources/fx/wind-ninja-flow.effect').read_bytes()).hexdigest(),
 'runtimeEffectHasNoImagesOrSamplers':True,'recipeSource':'actual cosmetic WindNinjaVFX only, no battle',
 'background':'scene_1_2.jpg (actual chapter2 forest)','previewMobs':'three existing forest sprites; compositing only, no AI or combat',
 'renderer':ctx.info['GL_RENDERER'],'version':ctx.info['GL_VERSION'],'modeChecks':samples,'crescentDirections':directions,'artFrames':270,
 'reviewWallSeconds':round(time.perf_counter()-start,3),'drawBlend':'ONE / ONE_MINUS_SRC_ALPHA; wind coverage only, ninja/crescent alpha0 emission',
 'actualGameBrowserCombatAudioOrWasmStarted':False,'phonePerformanceAndCocosPipeline':'pending user phone review'}
(OUT/'gpu-review.json').write_text(json.dumps(report,indent=2)+'\n','utf-8');print(json.dumps(report))
ctx.release()
