"""GPU art probe of the reported moving dark veil and quad borders. No game is run."""
import sys,json,re,struct,subprocess,hashlib,math
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl
import numpy as np
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
old=subprocess.check_output(['git','show','c7efe6ab:KingdomWatch/assets/resources/fx/hero-impact-flow.effect'],cwd=PROJECT.parent).decode('utf-8')
new=(PROJECT/'assets/resources/fx/hero-impact-flow.effect').read_text('utf-8')
ctx=moderngl.create_standalone_context(require=330);ctx.enable(moderngl.BLEND)
vertex='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;
void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
'''
ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0);vbo=ctx.buffer(reserve=64)
programs=[]
for text in [old,new]:
    frag=re.search(r'CCProgram hero-flow-fs %\{(.*?)\}%\s*$',text,re.S).group(1).replace('precision highp float;','')
    p=ctx.program(vertex_shader=vertex,fragment_shader='#version 330\n'+frag+'\nout vec4 fragColor;void main(){fragColor=frag();}')
    p['HeroFlow'].binding=0
    programs.append(ctx.vertex_array(p,[(vbo,'2f 2f','pos','texcoord')]))
size=(512,640);fbo=ctx.simple_framebuffer(size);fbo.use();ctx.viewport=(0,0,*size)
base=(.61,.47,.29,1)
fbo.clear(*base);before=np.frombuffer(fbo.read(components=3),np.uint8).astype('int16')
counts=[0,0];worst=[0,0]
for frame in range(96):
    time=frame/24;length=45+(1+math.sin(time*1.7))*.5*935
    angle=.25+time*.8;power=[.65,1.2,1.44][frame%3]
    height=144 if power>1.2 else 120;width=length+72
    vals=[]
    for x,y,u,v in [(-width/2,-height/2,0,1),(width/2,-height/2,1,1),(-width/2,height/2,0,0),(width/2,height/2,1,0)]:
        xx=x*math.cos(angle)-y*math.sin(angle);yy=x*math.sin(angle)+y*math.cos(angle)
        vals.extend([xx/(size[0]/2),yy/(size[1]/2),u,v])
    vbo.write(struct.pack('16f',*vals));ubo.write(struct.pack('8f',time,2.6,power,2,width,height,length,0))
    for k,vao in enumerate(programs):
        fbo.clear(*base);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA) if k==0 else (moderngl.ONE,moderngl.ONE)
        vao.render(moderngl.TRIANGLE_STRIP)
        delta=np.frombuffer(fbo.read(components=3),np.uint8).astype('int16')-before
        counts[k]+=int(np.count_nonzero(delta.reshape(-1,3).min(axis=1)<-2));worst[k]=min(worst[k],int(delta.min()))
assert counts[0]>0,'The baseline art probe did not reproduce background darkening'
assert counts[1]==0,'Emission unexpectedly darkened the background'
# Sample the carrier's own borders at different physical lengths and maximum power.
fbo=ctx.simple_framebuffer((1280,256));fbo.use();ctx.viewport=(0,0,1280,256)
vbo.write(struct.pack('16f',-1,-1,0,1,1,-1,1,1,-1,1,0,0,1,1,1,0))
edge_max=0
for length in [24,60,120,350,700,1100]:
    for power in [.65,1.2,1.44]:
        for time in [.0,.4,1.7]:
            fbo.clear(0,0,0,1);ubo.write(struct.pack('8f',time,.6,power,2,length+72,144 if power>1.2 else 120,length,0))
            programs[1].render(moderngl.TRIANGLE_STRIP)
            im=np.frombuffer(fbo.read(components=3),np.uint8).reshape(256,1280,3)
            edge_max=max(edge_max,int(max(im[:2].max(),im[-2:].max(),im[:,:2].max(),im[:,-2:].max())))
assert edge_max<=1,edge_max
report={'baselineCommit':'c7efe6ab','newShaderSha256':hashlib.sha256(new.encode('utf-8')).hexdigest(),
 'movingBeamCases':96,'baselineDarkPixelSamples':counts[0],'baselineWorstChannelDelta':worst[0],
 'newDarkPixelSamples':counts[1],'newWorstChannelDelta':worst[1],'quadBorderCases':54,
 'maximumBorderChannelByte':edge_max,'renderer':ctx.info['GL_RENDERER'],
 'scope':'isolated actual fragment output with declared normal/emission blend states; excludes engine and vector particles',
 'gameBrowserAudioOrWasmStarted':False}
(OUT/'emission-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps(report));ctx.release()
