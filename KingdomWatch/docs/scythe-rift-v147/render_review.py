"""Render recorded calls from the real visual classes, on static art, using standard straight alpha.
Never starts Cocos, a browser, combat, audio or WASM. This is a placement/material review.
"""
import json,math,struct,sys,re
from pathlib import Path
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'))
import moderngl
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import imageio.v2 as imageio
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
W,H,BOTTOM=750,940,-100
records=json.loads((OUT/'sprite-frames.json').read_text('utf8'))
ctx=moderngl.create_standalone_context(require=330)
target=ctx.texture((W,H),4);fbo=ctx.framebuffer(color_attachments=[target]);fbo.use()
program=ctx.program(vertex_shader='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv;
void main(){gl_Position=vec4(pos,0,1);uv=texcoord;}
''',fragment_shader='''#version 330
in vec2 uv;uniform sampler2D image;uniform float opacity;out vec4 fragColor;
void main(){vec4 c=texture(image,uv);fragColor=vec4(c.rgb,c.a*opacity);}
''')
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','pos','texcoord')])
source=(ROOT/'assets/resources/fx/scythe-flow.effect').read_text('utf8')
fragment=re.search(r'CCProgram scythe-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
shader=ctx.program(vertex_shader='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
''',fragment_shader='#version 330\n'+fragment+'\nout vec4 fragColor;void main(){fragColor=frag();}')
shader['ScytheFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
shaderVao=ctx.vertex_array(shader,[(vbo,'2f 2f','pos','texcoord')])
def shader_draw(q):
    x,y,w,h,angle,age,seed,power,mode,radius,t=q
    c,s=math.cos(math.radians(angle)),math.sin(math.radians(angle));values=[]
    for xx,yy,u,v in [(-.5,-.5,0,1),(.5,-.5,1,1),(-.5,.5,0,0),(.5,.5,1,0)]:
        px,py=xx*w,yy*h
        values.extend([(x+px*c-py*s)/(W/2),2*(y+px*s+py*c-BOTTOM)/H-1,u,v])
    vbo.write(struct.pack('16f',*values));ubo.write(struct.pack('8f',age,seed,power,mode,w,h,radius,t));shaderVao.render(moderngl.TRIANGLE_STRIP)
textures={}
def texture(key,im=None):
    if key not in textures:
        im=im if im is not None else Image.open(ROOT/'assets/resources'/key).convert('RGBA')
        tex=ctx.texture(im.size,4,im.tobytes());tex.filter=(moderngl.LINEAR,moderngl.LINEAR)
        tex.repeat_x=False;tex.repeat_y=False;textures[key]=tex
    return textures[key]
def draw(tex,x,y,w,h,anchor=(.5,.5),angle=0,rect=None,alpha=1):
    c,s=math.cos(math.radians(angle)),math.sin(math.radians(angle))
    rx,ry,rw,rh=rect if rect else [0,0,tex.width,tex.height]
    values=[]
    for xx,yy,u,v in [(0,0,rx,ry+rh),(1,0,rx+rw,ry+rh),(0,1,rx,ry),(1,1,rx+rw,ry)]:
        px,py=(xx-anchor[0])*w,(yy-anchor[1])*h
        values.extend([(x+px*c-py*s)/(W/2),2*(y+px*s+py*c-BOTTOM)/H-1,u/tex.width,v/tex.height])
    vbo.write(struct.pack('16f',*values));tex.use();program['image']=0;program['opacity']=alpha;vao.render(moderngl.TRIANGLE_STRIP)
bg=texture('background',Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA').resize((W,H)))
mf=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text())['frames']['forest_guard']
x,y,w,h=mf
mob=texture('mob',Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA').crop((x,y,x+w,y+h)).resize((105,105)))
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',19)
def frame(record,label):
    fbo.clear();ctx.disable(moderngl.BLEND);draw(bg,0,BOTTOM+H/2,W,H)
    ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
    def passes(ground):
        ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
        for v in record['shaders']:
            if v['belowMobs']==ground:shader_draw(v['q'])
        ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
        for v in record['sprites']:
            if v['belowMobs'] != ground:continue
            draw(texture(v['texture']),v['x'],v['y'],*v['size'],v['anchor'],v['angle'],
                [v['rect'][k] for k in ['x','y','width','height']],v['alpha'])
    passes(True)
    for mx,my in [(-145,450),(130,470),(75,290),(-95,310)]:draw(mob,mx,my,105,105,(.5,0))
    passes(False)
    im=Image.frombytes('RGB',(W,H),fbo.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    d=ImageDraw.Draw(im);d.rectangle((0,0,W,65),fill=(12,20,23));d.text((22,13),label,font=font,fill=(240,229,193))
    d.text((22,H-37),'正式纹理 / 实际渲染调用 · 静态场景离线检查',font=font,fill=(246,240,221))
    return im
tiles=[]
for kind,label in [('normal','普攻 · 厚弧刀锋 / 红黑焰尾'),('skill','技能 · 无柄双镰 / 红黑漩涡'),('ultimate','大招 · 区域升起 → 多向绞杀 → 最后一击收束')]:
    writer=imageio.get_writer(OUT/(kind+'-review.mp4'),fps=60,codec='libx264',quality=8,macro_block_size=2,ffmpeg_log_level='error')
    rr=[r for r in records if r['kind']==kind];indices={'normal':[8,18,28,38],'skill':[30,55,110,230],'ultimate':[20,55,110,156]}[kind]
    for i,record in enumerate(rr):
        im=frame(record,label);writer.append_data(np.asarray(im))
        if i in indices:im.save(OUT/(kind+'-'+str(i)+'.jpg'),quality=95);tiles.append(im.resize((300,376)))
    writer.close()
grid=Image.new('RGB',(1200,1128))
for i,tile in enumerate(tiles):grid.paste(tile,((i%4)*300,(i//4)*376))
grid.save(OUT/'contact-sheet.jpg',quality=94)
# The pixel checks compile the actual GLSL, including rising-domain and convergence modes.
floatTex=ctx.texture((W,H),4,dtype='f4');floatFbo=ctx.framebuffer(color_attachments=[floatTex]);floatFbo.use();ctx.disable(moderngl.BLEND)
samples=0
for mode in range(8):
 for age in [0,.1,.3,.6,1,2.7,3.16]:
    floatFbo.clear();shader_draw([0,390,700,700,0,age,.37,1,mode,320,min(1,age/3.16)])
    values=np.frombuffer(floatFbo.read(components=4,dtype='f4'),np.float32)
    assert np.isfinite(values).all() and values.min()>=0
    floatFbo.clear();shader_draw([0,390,700,700,0,age,.37,0,mode,320,min(1,age/3.16)])
    assert np.frombuffer(floatFbo.read(components=4,dtype='f4'),np.float32).max()==0
    samples+=1
(OUT/'visual-review.json').write_text(json.dumps({'actualCosmeticClasses':True,'recordedFrames':len(records),
    'gpuSamples':samples,'spriteBlend':'SRC_ALPHA / ONE_MINUS_SRC_ALPHA','shaderBlend':'ONE / ONE_MINUS_SRC_ALPHA','battleStarted':False,
    'visualAcceptance':'pending user'},indent=2)+'\n',encoding='utf8')
ctx.release();print('Offline sprite placement review rendered')
