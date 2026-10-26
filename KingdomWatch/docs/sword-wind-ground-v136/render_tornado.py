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

paths=json.loads((ROOT/'local/art-archive/sword-wind-ground-v136/review/motion.json').read_text())['paths']
m=json.loads((ROOT/'assets/resources/fx/wind_tornado_video_v129.frames.json').read_text());atlas=Image.open(ROOT/'assets/resources/fx/wind_tornado_video_v129.png').convert('RGBA');cells=[]
for i in range(m['frameCount']):
 x,y,wc,hc=m['frames'][m['framePrefix']+str(i)];im=atlas.crop((x,y,x+wc,y+hc));cells.append(ctx.texture(im.size,4,im.tobytes()))
frames=[]
for i in range(120):
 pair=Image.new('RGB',(750,500))
 for side in range(2):
  point=paths[side][i];scene();rw=95*m['visualWidthPerRadius'];rh=rw*hc/wc
  index=math.floor(point['age']*m['fps']*m['playbackSpeed']+1e-7)%m['frameCount']
  image(cells[index],point['x'],point['y']+25+rh*(.5-m['groundAnchor'][1]),rw,rh)
  im=pixels().resize((375,500));d=ImageDraw.Draw(im);d.text((10,10),'DIRECT RETARGET' if side==0 else 'DAMPED MOVEMENT',fill='white');pair.paste(im,(side*375,0))
 frames.append(pair)
frames[0].save(OUT/'tornado-steering-review.webp',save_all=True,append_images=frames[1:],duration=33,loop=0,quality=88)
frames[60].save(OUT/'tornado-steering-comparison.jpg',quality=92)
(OUT/'tornado-review.json').write_text(json.dumps({'frames':120,'usesOriginalAtlas':True,'isolatedGeometryOnly':True,'gameEngineBrowserBattleAudioWasmStarted':False},indent=2)+'\n');print('PASS: 120 pure-motion tornado comparison frames');ctx.release()
