"""Render recorded calls from the real visual classes, on static art, using standard straight alpha.
Never starts Cocos, a browser, combat, audio or WASM. This is a placement/material review.
"""
import json,math,struct,sys
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
        for v in record['sprites']:
            if ('Surface' in v['plane']) != ground:continue
            draw(texture(v['texture']),v['x'],v['y'],*v['size'],v['anchor'],v['angle'],
                [v['rect'][k] for k in ['x','y','width','height']],v['alpha'])
    passes(True)
    for mx,my in [(-145,450),(130,470),(75,290),(-95,310)]:draw(mob,mx,my,105,105,(.5,0))
    passes(False)
    im=Image.frombytes('RGB',(W,H),fbo.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    d=ImageDraw.Draw(im);d.rectangle((0,0,W,65),fill=(12,20,23));d.text((22,13),label,font=font,fill=(240,229,193))
    d.text((22,H-37),'正式纹理 / 实际渲染调用 · 静态场景离线检查',font=font,fill=(246,240,221))
    return im
writer=imageio.get_writer(OUT/'ultimate-placement.mp4',fps=60,codec='libx264',quality=8,macro_block_size=2,ffmpeg_log_level='error')
samples=[]
for i,r in enumerate(records['frames']):
    im=frame(r,'大招 · 飞行 → 贯地雷暴 → 游离电丝波')
    writer.append_data(np.asarray(im))
    if i in [60,75,80,87,101,145]:
        im.save(OUT/f'ultimate-{i:03d}.jpg',quality=94);samples.append(im.resize((300,376)))
writer.close()
tiles=[]
for r in records['cases']:
    im=frame(r,('普攻' if r['kind']=='normal' else '技能枪雨')+' · '+str(r['age'])+' s')
    im.save(OUT/(r['kind']+'-'+str(r['age'])+'.jpg'),quality=94);tiles.append(im.resize((300,376)))
grid=Image.new('RGB',(1200,1128))
for i,tile in enumerate(tiles+samples[:4]):grid.paste(tile,((i%4)*300,(i//4)*376))
grid.save(OUT/'contact-sheet.jpg',quality=94)
(OUT/'visual-review.json').write_text(json.dumps({'actualCosmeticClasses':True,'recordedFrames':len(records['frames']),
    'cases':len(records['cases']),'blend':'SRC_ALPHA / ONE_MINUS_SRC_ALPHA','battleStarted':False,
    'visualAcceptance':'pending user'},indent=2)+'\n',encoding='utf8')
ctx.release();print('Offline sprite placement review rendered')
