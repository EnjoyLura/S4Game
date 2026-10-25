"""Probe the thick plasma's real premultiplied shader output; excludes gameplay."""
import sys,json,re,struct,hashlib
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl
import numpy as np
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
source=(PROJECT/'assets/resources/fx/hero-impact-flow.effect').read_text('utf-8')
ctx=moderngl.create_standalone_context(require=330)
frag=re.search(r'CCProgram hero-flow-fs %\{(.*?)\}%\s*$',source,re.S).group(1).replace('precision highp float;','')
p=ctx.program(vertex_shader='''#version 330
in vec2 pos;in vec2 texcoord;out vec2 uv0;out vec4 color;void main(){gl_Position=vec4(pos,0,1);uv0=texcoord;color=vec4(1);}
''',fragment_shader='#version 330\n'+frag+'\nout vec4 o;void main(){o=frag();}')
p['HeroFlow'].binding=0;ubo=ctx.buffer(reserve=32);ubo.bind_to_uniform_block(0)
vbo=ctx.buffer(struct.pack('16f',-1,-1,0,1,1,-1,1,1,-1,1,0,0,1,1,1,0))
vao=ctx.vertex_array(p,[(vbo,'2f 2f','pos','texcoord')]);fbo=ctx.simple_framebuffer((1280,256));fbo.use()
edge=black=outside=0;alpha_peak=0;cases=0
for length in [24,60,120,350,700,1100]:
 for power in [.65,1.2,1.44]:
  for time in [0,.27,.6,1.7,2.2]:
   width=length+72;height=144 if power>1.2 else 120
   fbo.clear(0,0,0,0);ubo.write(struct.pack('8f',time,.6,power,2,width,height,length,0));vao.render(moderngl.TRIANGLE_STRIP)
   im=np.frombuffer(fbo.read(components=4),np.uint8).reshape(256,1280,4);rgb=im[:,:,:3].max(2);alpha=im[:,:,3]
   edge=max(edge,int(max(im[:2].max(),im[-2:].max(),im[:,:2].max(),im[:,-2:].max())))
   black+=int(np.count_nonzero((alpha>5)&(rgb<alpha*.2)))
   alpha_peak=max(alpha_peak,int(alpha.max()));cases+=1
   # At least the outer carrier strip, 0..2 physical units, must be fully clear.
   rows=(np.arange(256)+.5)/256*height
   outside=max(outside,int(alpha[(rows<2)|(rows>height-2)].max()))
assert edge<=1 and outside<=1 and black==0
assert alpha_peak>100,'The purple volume disappeared back into thin emission only'
r={'cases':cases,'maxCarrierBorderByte':edge,'maxOutsidePlasmaAlphaByte':outside,'blackVeilPixelSamples':black,
 'maxShapedPlasmaAlphaByte':alpha_peak,'blend':'ONE / ONE_MINUS_SRC_ALPHA, premultiplied pigment + emitted light',
 'shaderSha256':hashlib.sha256(source.encode('utf-8')).hexdigest(),'scope':'actual offscreen fragment output, no engine/gameplay or phone performance claim','gameStarted':False}
(OUT/'plasma-check.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps(r));ctx.release()
