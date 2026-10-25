"""Offscreen art review of the actual procedural tornado; never runs the game."""
import sys, json, re, struct, math, time, hashlib, subprocess
from pathlib import Path
sys.path.insert(0, str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'))
import moderngl
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
W,H=440,500
R=130
BOTTOM=-200
ctx=moderngl.create_standalone_context(require=330)
target=ctx.texture((W,H),4,dtype='f4')
fb=ctx.framebuffer(color_attachments=[target]);fb.use()
vert='''#version 330
in vec2 position;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(position,0,1);uv0=texcoord;color=vec4(1);}
'''
source=(ROOT/'assets/resources/fx/wind-ninja-flow.effect').read_text('utf8')
code=re.search(r'CCProgram wind-ninja-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
prog=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+code+'\nout vec4 fragmentColor;void main(){fragmentColor=frag();}')
oldsource=subprocess.check_output(['git','show','95935c828ad7fb73829e32c41ca0574d6660fbaa:KingdomWatch/assets/resources/fx/wind-ninja-flow.effect'],cwd=ROOT,text=True,encoding='utf8')
oldcode=re.search(r'CCProgram wind-ninja-fs %\{(.*?)\}%\s*$',oldsource,re.S).group(1).replace('precision highp float;','')
oldprog=ctx.program(vertex_shader=vert,fragment_shader='#version 330\n'+oldcode+'\nout vec4 fragmentColor;void main(){fragmentColor=frag();}')
prog['HeroFlow'].binding=0
oldprog['HeroFlow'].binding=0
uniforms=ctx.buffer(reserve=32);uniforms.bind_to_uniform_block(0)
buffer=ctx.buffer(reserve=64)
mesh=ctx.vertex_array(prog,[(buffer,'2f 2f','position','texcoord')])
oldmesh=ctx.vertex_array(oldprog,[(buffer,'2f 2f','position','texcoord')])
flat=ctx.program(vertex_shader=vert,fragment_shader='''#version 330
in vec2 uv0;uniform sampler2D image;out vec4 fragmentColor;
void main(){fragmentColor=texture(image,uv0);}
''')
bgmesh=ctx.vertex_array(flat,[(buffer,'2f 2f','position','texcoord')])
bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
bg=bg.crop((int(bg.width*.20),int(bg.height*.25),int(bg.width*.80),int(bg.height*.72))).resize((W,H),Image.Resampling.LANCZOS)
bgtex=ctx.texture((W,H),4,bg.tobytes())
data=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf8'))['frames']
sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA')
mobs=[]
for name,x,y,w in [('forest_guard',-48,20,92),('forest_wasp',56,90,70),('forest_spider',30,-45,72)]:
    xx,yy,ww,hh=data[name];im=sheet.crop((xx,yy,xx+ww,yy+hh));tex=ctx.texture(im.size,4,im.tobytes());mobs.append((tex,x,y,w,w*hh/ww))
recipes=json.loads((ROOT/'local/art-archive/tornado-volume-v124/review-recipes.json').read_text('utf8'))['frames']
font=ImageFont.truetype(str(ROOT/'assets/resources/fonts/CombatDigits.ttf'),24)

def quad(x,y,w,h):
    values=[]
    for px,py,u,v in [(-w/2,-h/2,0,1),(w/2,-h/2,1,1),(-w/2,h/2,0,0),(w/2,h/2,1,0)]:
        values.extend([(x+px)/(W/2),2*(y+py-BOTTOM)/H-1,u,v])
    buffer.write(struct.pack('16f',*values))

def read_pixels():
    return np.frombuffer(fb.read(components=4,dtype='f4'),np.float32).reshape(H,W,4)

def read_image():
    return Image.fromarray((np.clip(read_pixels()[::-1,:,:3],0,1)*255+.5).astype('uint8'))

def draw(age,power=1,plain=False,version='new',recipe=None):
    ctx.disable(moderngl.BLEND);fb.clear(.025,.045,.05,0)
    if not plain:
        quad(0,BOTTOM+H/2,W,H);bgtex.use(0);flat['image']=0;bgmesh.render(moderngl.TRIANGLE_STRIP)
        ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
        for tex,x,y,w,h in mobs:quad(x,y,w,h);tex.use(0);bgmesh.render(moderngl.TRIANGLE_STRIP)
    if recipe:
        layer=Image.new('RGBA',(W,H));pen=ImageDraw.Draw(layer)
        for c in recipe['commands']:
            points=[(round(x+W/2),round(H-(y-BOTTOM))) for x,y in c['points']]
            if len(points)<2:continue
            if c['kind']=='fill':pen.polygon(points,fill=tuple(c['color']))
            else:pen.line(points,fill=tuple(c['color']),width=max(1,round(c['width'])),joint='curve')
        t=ctx.texture((W,H),4,layer.tobytes());quad(0,BOTTOM+H/2,W,H);t.use(0);flat['image']=0;bgmesh.render(moderngl.TRIANGLE_STRIP);t.release()
    ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.ONE,moderngl.ONE_MINUS_SRC_ALPHA,moderngl.ZERO,moderngl.ONE)
    quad(0,R*.35,R*2.6,R*3.3)
    opacity=recipe['quads'][0][7] if recipe else power
    uniforms.write(struct.pack('8f',age,.73,opacity,1,R*2.6,R*3.3,R,5))
    (oldmesh if version=='old' else mesh).render(moderngl.TRIANGLE_STRIP)
    im=read_image()
    if not plain:
        pen=ImageDraw.Draw(im)
        for _,x,y,w,h in mobs:pen.text((int(x+W/2+20),int(H-(y+22-BOTTOM))),'96',font=font,fill='white',stroke_width=2,stroke_fill='#18242c')
    return im

def shader_checks():
    checks=[]
    ctx.disable(moderngl.BLEND)
    for mode in range(5):
        for age in [0,.08,.51,1.3,3.8,4.99]:
            quad(0,R*.35,R*2.6,R*3.3)
            uniforms.write(struct.pack('8f',age,.73,1,mode,R*2.6,R*3.3,R,5))
            fb.clear();mesh.render(moderngl.TRIANGLE_STRIP);current=read_pixels().copy()
            assert np.isfinite(current).all() and current.min()>=0
            assert current[:,:,3].max()<=.72001
            if mode!=1:
                fb.clear();oldmesh.render(moderngl.TRIANGLE_STRIP)
                assert np.array_equal(current,read_pixels()),('Unchanged mode GPU output differs',mode,age)
            checks.append({'mode':mode,'age':age,'finite':True,'maxAlpha':float(current[:,:,3].max()),'unchangedModeExact':mode!=1})
    # Zero parent opacity and transparent carrier margins cannot draw a quad.
    for mode in range(5):
        fb.clear();uniforms.write(struct.pack('8f',.7,.73,0,mode,R*2.6,R*3.3,R,5));mesh.render(moderngl.TRIANGLE_STRIP)
        assert not read_pixels().any()
    fb.clear();uniforms.write(struct.pack('8f',.7,.73,1,1,R*2.6,R*3.3,R,5));mesh.render(moderngl.TRIANGLE_STRIP)
    v=read_pixels();assert not v[:3,:,:].any() and not v[-3:,:,:].any()
    # Front-facing volume over the forest is allowed to attenuate, but only
    # inside shaped density. Density-free space remains exactly transparent.
    assert (v[:,:,:3].max(axis=2)>.03).sum()>3000
    assert not re.search(r'\b(?:sampler2D|samplerCube)\b|\btexture\s*\(',code)
    return checks

def gpu_cost():
    results=[]
    for dpr in [1,2]:
        tex=ctx.texture((W*dpr,H*dpr),4);surface=ctx.framebuffer(color_attachments=[tex]);surface.use()
        quad(0,R*.35,R*2.6,R*3.3)
        uniforms.write(struct.pack('8f',1.3,.73,1,1,R*2.6,R*3.3,R,5))
        for name,vao in [('old',oldmesh),('new',mesh)]:
            for _ in range(5):vao.render(moderngl.TRIANGLE_STRIP)
            ctx.finish();samples=[]
            for _ in range(6):
                with ctx.query(time=True) as query:
                    for j in range(16):vao.render(moderngl.TRIANGLE_STRIP)
                samples.append(query.elapsed/1e6/16)
            results.append({'version':name,'dpr':dpr,'singleFieldGpuMilliseconds':round(float(np.median(samples)),4),'isolatedDraws':96})
        fb.use();surface.release();tex.release()
    return results

def main():
    times=[.25,.65,1.05,1.45,1.85]
    atlas=Image.new('RGB',(W*5,H*2))
    for row in range(2):
        for col,t in enumerate(times):
            im=draw(t,plain=row==1);ImageDraw.Draw(im).text((10,10),f'VOLUME STUDY / {t:.2f}s',fill='white');atlas.paste(im,(W*col,H*row))
    atlas.resize((1650,750),Image.Resampling.LANCZOS).save(OUT/'shape-study.jpg',quality=95)
    if '--animate' in sys.argv:
        frames=[];newframes=[];contacts=Image.new('RGB',(W*5,H*2))
        for i in range(150):
            t=i/30;pair=Image.new('RGB',(W*2,H))
            for col,name in enumerate(['old','new']):
                recipe=next(f for f in recipes if f['version']==name and abs(f['age']-t)<1e-6)
                im=draw(t,version=name,recipe=recipe);pen=ImageDraw.Draw(im);pen.rectangle((0,0,W,28),fill='#15252e');pen.text((10,8),f'{"V123 / SURFACES" if col==0 else "V124 / VOLUME"}    {t:.2f}s',fill='white');pair.paste(im,(W*col,0))
                if col:newframes.append(im)
                if i in [9,27,45,75,135]:contacts.paste(im,([9,27,45,75,135].index(i)*W,col*H))
            frames.append(pair)
        frames[0].save(OUT/'before-after.webp',save_all=True,append_images=frames[1:],duration=33,loop=0,quality=85,method=4)
        newframes[0].save(OUT/'tornado-motion.webp',save_all=True,append_images=newframes[1:],duration=33,loop=0,quality=88,method=4)
        contacts.resize((1650,750),Image.Resampling.LANCZOS).save(OUT/'before-after.jpg',quality=95)
    checks=shader_checks();cost=gpu_cost()
    report={'shaderSourceSha256':hashlib.sha256(source.encode()).hexdigest(),'renderer':ctx.info['GL_RENDERER'],'runtimeEffectHasNoImagesOrSamplers':True,
      'modeChecks':checks,'unchangedOtherModePixelComparisons':24,'artFrames':300 if '--animate' in sys.argv else 10,'gpuCost':cost,
      'costScope':'isolated desktop GPU draw only; no engine, batching, CPU cost or phone measurement',
      'actualGameBrowserCombatAudioOrWasmStarted':False,'manualPhoneVisualAndPerformanceReview':'pending user'}
    (OUT/'gpu-review.json').write_text(json.dumps(report,indent=2)+'\n','utf8')
    print(json.dumps({k:report[k] for k in ['shaderSourceSha256','renderer','gpuCost','actualGameBrowserCombatAudioOrWasmStarted']}))

if __name__=='__main__':main()
