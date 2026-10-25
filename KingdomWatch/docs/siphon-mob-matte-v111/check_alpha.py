"""Inspect sparse runtime clear rectangles through a GPU texture, without rewriting source images."""
import sys,json,hashlib,struct,time
from pathlib import Path
sys.path[:0]=[str(Path.home()/'AppData/Local/Temp/kw-fx-gpu-review'),str(Path.home()/'AppData/Local/Temp/kw-video-inspect-deps')]
import moderngl
import numpy as np
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parent;PROJECT=OUT.parents[1]
plans=json.loads((PROJECT/'assets/resources/ux/mob-arm-alpha-v111.json').read_text('utf-8'))
ctx=moderngl.create_standalone_context(require=330);ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE_MINUS_SRC_ALPHA)
program=ctx.program(vertex_shader='''#version 330
in vec2 p;in vec2 uv;out vec2 v;void main(){gl_Position=vec4(p,0,1);v=uv;}
''',fragment_shader='''#version 330
in vec2 v;uniform sampler2D image;out vec4 o;void main(){o=texture(image,v);}
''')
vbo=ctx.buffer(reserve=64);vao=ctx.vertex_array(program,[(vbo,'2f 2f','p','uv')]);fbo=ctx.simple_framebuffer((320,320));fbo.use();report={};tiles=[]
for atlas,mob,ids in [('chapter1_mob_walk_v94','goblin_shaman',[0,9,18]),('chapter1_mob_walk_v95','goblin_slinger',[23,30,37])]:
    source=PROJECT/('assets/resources/ux/'+atlas+'.png');data=np.asarray(Image.open(source).convert('RGBA')).copy()
    meta=json.loads((PROJECT/('assets/resources/ux/'+atlas+'.frames.json')).read_text('utf-8'))
    tex=ctx.texture((data.shape[1],data.shape[0]),4,data.tobytes());tex.filter=(moderngl.LINEAR,moderngl.LINEAR)
    selected=np.zeros(data.shape[:2],bool);frame_hits={}
    for x,y,w,h in plans[atlas]['rectangles']:
        assert not selected[y:y+h,x:x+w].any(),'Overlapping patch commands'
        selected[y:y+h,x:x+w]=1
    # Only warm, pale source background is cleared, restricted to the two reported monsters.
    rgb=data[selected,:3].astype('int16');assert (rgb.max(1)-rgb.min(1)<48).all() and (rgb.min(1)>140).all()
    for name,box in meta['frames'].items():
        if '_w' not in name:continue
        x,y,w,h=box;n=int(selected[y:y+h,x:x+w].sum())
        if n:frame_hits[name]=n;assert name.startswith(mob+'_w')
    before={}
    def render(frame):
        x,y,w,h=meta['frames'][frame];tw,th=tex.size
        vbo.write(struct.pack('16f',-1,-1,x/tw,(y+h)/th,1,-1,(x+w)/tw,(y+h)/th,-1,1,x/tw,y/th,1,1,(x+w)/tw,y/th))
        fbo.clear(.1,.64,.78,1);tex.use();vao.render(moderngl.TRIANGLE_STRIP)
        return Image.frombytes('RGB',(320,320),fbo.read(components=3)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    for i in ids:before[i]=render(mob+'_w'+str(i))
    start=time.perf_counter()
    for x,y,w,h in plans[atlas]['rectangles']:tex.write(bytes(w*h*4),viewport=(x,y,w,h))
    ctx.finish();ms=(time.perf_counter()-start)*1000
    result=np.frombuffer(tex.read(),np.uint8).reshape(data.shape)
    assert np.array_equal(result[~selected],data[~selected])
    assert not result[selected].any()
    for i in ids:tiles.append((mob,i,before[i],render(mob+'_w'+str(i))))
    report[mob]={'atlas':atlas,'framesChanged':frame_hits,'clearedPixels':int(selected.sum()),'rectangleUploads':len(plans[atlas]['rectangles']),
      'desktopOffscreenUploadMs':round(ms,3),'outsidePatchRGBAByteIdentical':True,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    tex.release()
sheet=Image.new('RGB',(6*224,2*252),'#22313b');d=ImageDraw.Draw(sheet)
for j,(mob,i,before,after) in enumerate(tiles):
    row=j//3;col=j%3*2
    for k,im in enumerate([before,after]):
        sheet.paste(im.resize((224,224)),((col+k)*224,row*252));d.text(((col+k)*224+5,row*252+229),f'{mob} {i} '+('before' if k==0 else 'after'),fill='white')
sheet.save(OUT/'alpha-before-after.jpg',quality=97)
(OUT/'alpha-gpu-check.json').write_text(json.dumps({'monsters':report,'runtimeMechanism':'sparse all-zero RGBA uploads into loaded atlas; no source image rewrite','sourceImageFilesChanged':False,'gameBrowserAudioOrWasmStarted':False},ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({m:{'frames':len(v['framesChanged']),'pixels':v['clearedPixels'],'outsideIdentical':True,'offscreenUploadMs':v['desktopOffscreenUploadMs']} for m,v in report.items()}));ctx.release()
