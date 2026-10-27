"""Editable red/dark-red scythe elements. Blender 5.2, orthographic, fixed anchors.
Render blade / rotating weapon / tearing slash independently, never a full-screen movie.
"""
import bpy,math,random,json,sys,argparse
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--quick',action='store_true');p.add_argument('--kind',default='');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.resolution_percentage=100;scene.eevee.taa_render_samples=64
scene.world.color=(.04,.025,.03);scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.9
def emission(name,color,power):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear();e=n.new('ShaderNodeEmission');e.inputs[0].default_value=(*color,1);e.inputs[1].default_value=power
 o=n.new('ShaderNodeOutputMaterial');m.node_tree.links.new(e.outputs[0],o.inputs[0]);return m
edge=emission('Scarlet cutting edge',(1,.065,.012),7)
hot=emission('Restricted ivory orange edge',(1,.32,.10),13)
red=emission('Blood-red energy',(1,.007,.016),2.7)
faint=emission('Dark crimson wake',(.31,.001,.008),.9)
black=emission('Obsidian red negative core',(.035,.001,.004),1)
metal=bpy.data.materials.new('Blackened steel with crimson veins');metal.use_nodes=True
bs=metal.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.048,.009,.018,1);bs.inputs['Metallic'].default_value=.65;bs.inputs['Roughness'].default_value=.28
def collection(name):
 c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
blade=collection('01 flowing crescent');spin=collection('02 spatial rotary wake');slash=collection('03 fast searing cut');finish=collection('04 execution stroke');studio=collection('00 studio')
def move(o,c):
 for old in list(o.users_collection):old.objects.unlink(o)
 c.objects.link(o);return o
def mesh(name,verts,faces,mat,c):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.materials.append(mat);o=bpy.data.objects.new(name,d);c.objects.link(o);return o
def curve(name,points,width,mat,c):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=width;d.bevel_resolution=2
 s=d.splines.new('POLY');s.points.add(len(points)-1)
 for i,(p,v) in enumerate(zip(s.points,points)):p.co=(*v,1);p.radius=.04+.96*math.sin(math.pi*i/(len(points)-1))**.35
 d.materials.append(mat);o=bpy.data.objects.new(name,d);c.objects.link(o);return o
def strip(name,front,back,mat,c):
 verts=front+back;n=len(front);return mesh(name,verts,[(i,i+1,n+i+1,n+i) for i in range(n-1)],mat,c)

def uvmesh(name,positions,nu,nv,mat,c):
 faces=[(i*(nv+1)+j,(i+1)*(nv+1)+j,(i+1)*(nv+1)+j+1,i*(nv+1)+j+1) for i in range(nu) for j in range(nv)]
 o=mesh(name,positions,faces,mat,c);uv=o.data.uv_layers.new(name='Flow UV')
 for face in o.data.polygons:
  for li in face.loop_indices:
   vi=o.data.loops[li].vertex_index;uv.data[li].uv=(vi//(nv+1)/nu,vi%(nv+1)/nv)
 return o

flows=[]
def flowing(name,color,power,opacity,tail=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.surface_render_method='DITHERED'
 n=m.node_tree.nodes;n.clear();l=m.node_tree.links
 def mathnode(op,a,b=None):
  q=n.new('ShaderNodeMath');q.operation=op
  for i,v in enumerate([a,b]):
   if v is None:continue
   if isinstance(v,(float,int)):q.inputs[i].default_value=v
   else:l.new(v,q.inputs[i])
  return q.outputs[0]
 uv=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(uv.outputs['UV'],sep.inputs[0])
 mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(7,24,1);l.new(uv.outputs['UV'],mapping.inputs[0])
 noise=n.new('ShaderNodeTexNoise');noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=3.3;noise.inputs['Roughness'].default_value=.7;l.new(mapping.outputs[0],noise.inputs[0])
 grain=mathnode('MULTIPLY_ADD',noise.outputs['Fac'],.72);grain.node.inputs[2].default_value=.28
 edge=mathnode('POWER',mathnode('SINE',mathnode('MULTIPLY',sep.outputs['Y'],math.pi)),.8)
 longfade=mathnode('POWER',sep.outputs['X'],1.5) if tail else mathnode('POWER',mathnode('SINE',mathnode('MULTIPLY',sep.outputs['X'],math.pi)),.55)
 alpha=mathnode('MULTIPLY',mathnode('MULTIPLY',edge,longfade),mathnode('MULTIPLY',grain,opacity))
 transparent=n.new('ShaderNodeBsdfTransparent');emit=n.new('ShaderNodeEmission');emit.inputs[0].default_value=(*color,1);emit.inputs[1].default_value=power
 mix=n.new('ShaderNodeMixShader');l.new(alpha,mix.inputs[0]);l.new(transparent.outputs[0],mix.inputs[1]);l.new(emit.outputs[0],mix.inputs[2]);out=n.new('ShaderNodeOutputMaterial');l.new(mix.outputs[0],out.inputs[0])
 flows.append(noise);return m

silk=flowing('Blood-red soft advected veil',(1,.004,.021),2.8,.52)
rose=flowing('Scarlet luminous silk',(1,.024,.045),4,.6,True)
hotveil=flowing('Hot orange-white grazing film',(1,.28,.065),16,.9,True)
shadowveil=flowing('Dark carmine translucent wake',(.18,.001,.012),1,.56,True)

# The reference's single solid flame body: hot curved lip, red transition, black torn wake.
flame=bpy.data.materials.new('Orange-white edge into flowing black-red flame');flame.use_nodes=True;flame.surface_render_method='DITHERED'
n=flame.node_tree.nodes;n.clear();l=flame.node_tree.links
uv=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(uv.outputs['UV'],sep.inputs[0])
scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(12,3,1);l.new(uv.outputs['UV'],scale.inputs[0])
noise=n.new('ShaderNodeTexNoise');noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=2;noise.inputs['Roughness'].default_value=.65;l.new(scale.outputs[0],noise.inputs[0]);flows.append(noise)
warp=n.new('ShaderNodeMath');warp.operation='MULTIPLY_ADD';warp.inputs[1].default_value=.16;warp.inputs[2].default_value=-.08;l.new(noise.outputs['Fac'],warp.inputs[0])
depth=n.new('ShaderNodeMath');depth.operation='ADD';l.new(sep.outputs['Y'],depth.inputs[0]);l.new(warp.outputs[0],depth.inputs[1])
ramp=n.new('ShaderNodeValToRGB');cr=ramp.color_ramp;cr.elements.remove(cr.elements[1])
stops=[(0,(1,.58,.20,1)),(.065,(1,.35,.015,1)),(.16,(1,.13,.003,1)),(.26,(.65,.003,.008,1)),(.42,(.003,.00005,.00015,1)),(1,(.0001,0,.0001,1))]
for i,(pos,col) in enumerate(stops):
 e=cr.elements[0] if i==0 else cr.elements.new(pos);e.position=pos;e.color=col
l.new(depth.outputs[0],ramp.inputs[0]);emit=n.new('ShaderNodeEmission');l.new(ramp.outputs[0],emit.inputs[0]);emit.inputs[1].default_value=5
fade=n.new('ShaderNodeMapRange');fade.clamp=True;fade.interpolation_type='SMOOTHSTEP';fade.inputs['From Min'].default_value=.70;fade.inputs['From Max'].default_value=1;fade.inputs['To Min'].default_value=1;fade.inputs['To Max'].default_value=0;l.new(sep.outputs['Y'],fade.inputs[0])
trans=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');l.new(fade.outputs[0],mix.inputs[0]);l.new(trans.outputs[0],mix.inputs[1]);l.new(emit.outputs[0],mix.inputs[2]);out=n.new('ShaderNodeOutputMaterial');l.new(mix.outputs[0],out.inputs[0])
nu,nv=144,24;verts=[]
def bladepoint(u,v,phase):
 x=u*2-1;env=math.sqrt(max(0,1-x*x));front=.72*(env-1)
 tear=.72+.19*math.sin(u*31-phase)+.13*math.sin(u*59-phase*2+1.4)
 return (x,front-v*env*tear,.06+.10*math.sin(math.pi*v)*env)
for i in range(nu+1):
 for j in range(nv+1):verts.append(bladepoint(i/nu,j/nv,0))
sheet=uvmesh('Continuous thick arc and torn flame',verts,nu,nv,flame,blade)
leading=curve('Incandescent cutting lip',[bladepoint(i/144,0,0) for i in range(145)],.008,hot,blade)

# Two handleless crescent knives, dark helical body, glowing core, and dense rotary threads.
rotor=bpy.data.objects.new('Counterposed blade rotor',None);spin.objects.link(rotor)
for side in range(2):
 outer=[];inner=[]
 for i in range(81):
  u=i/80;a=side*math.pi+.3+u*2.35;r=.90
  outer.append((math.cos(a)*r,math.sin(a)*r,.11))
  ri=r-.22*math.sin(math.pi*u)**.6;inner.append((math.cos(a)*ri,math.sin(a)*ri,.13))
 ob=strip('Handleless curved blade %d'%side,outer,inner,metal,spin);ob.parent=rotor
 so=ob.modifiers.new('Blade thickness','SOLIDIFY');so.thickness=.026
 be=ob.modifiers.new('Razor bevel','BEVEL');be.width=.008;be.segments=3
 for pts,width,mat in [(outer,.013,edge),(outer,.004,hot),(inner,.009,red)]:
  ob=curve('Glowing sickle edge',pts,width,mat,spin);ob.parent=rotor
vortex=[]
darkflow=flowing('Opaque black-crimson rotating undertow',(.002,.00003,.0003),1,.96)
for arm in range(8):
 verts=[]
 for i in range(101):
  u=i/100;a=arm*math.pi*.5-u*4.4;r=.12+u*.81
  for j in range(9):
   v=j/8;rr=r+(v-.5)*(.24 if arm<4 else .085)*math.sin(math.pi*u)**.3
   verts.append((math.cos(a)*rr,math.sin(a)*rr,.06+.13*(1-u)+arm*.003))
 mat=darkflow if arm<4 else rose if arm<6 else silk
 ob=uvmesh('Coiled red-black vortex arm %d'%arm,verts,100,8,mat,spin);vortex.append(ob)
for k in range(12):
 verts=[];a0=k*math.pi/6
 for i in range(81):
  u=i/80;a=a0-(1-u)*(2.4+.15*(k%3));r=.85+(k%4)*.035
  for j in range(7):
   v=j/6;rr=r+(v-.5)*(.075 if k%3 else .13)*math.sin(math.pi*u)**.5
   verts.append((math.cos(a)*rr,math.sin(a)*rr,.045+math.sin(a*2+k)*.03))
 ob=uvmesh('Blended sweeping fringe %d'%k,verts,80,6,hotveil if k%6==0 else rose if k%3==0 else silk,spin);vortex.append(ob)
for k in range(30):
 rng=random.Random(14700+k);a=rng.uniform(0,math.tau);r=rng.uniform(.82,1.10)
 pts=[(math.cos(a-j/29*.9)*r,math.sin(a-j/29*.9)*r,.05+.03*math.sin(a+j/20)) for j in range(30)]
 ob=curve('Fine orbiting light thread %d'%k,pts,rng.uniform(.0012,.003),edge if k%4 else hot,spin);vortex.append(ob)
# Small angular luminous ornaments occupy the center, never a handle or giant light ball.
crystals=[]
for k in range(5):
 a=k*math.tau/5;r=.16 if k else 0;x,y=math.cos(a)*r,math.sin(a)*r
 vs=[(x,y,.35),(x-.05,y,.16),(x,y-.04,.16),(x+.05,y,.16),(x,y+.04,.16),(x,y,.04)]
 ob=mesh('Blood-red core shard %d'%k,vs,[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(5,2,1),(5,3,2),(5,4,3),(5,1,4)],red,spin);crystals.append(ob)
 for j in range(1,5):
  o=curve('Shard glowing seam',[vs[0],vs[j],vs[5]],.0025,edge if k else hot,spin);crystals.append(o)
bpy.ops.object.camera_add(location=(0,0,20));cam=move(bpy.context.object,studio);cam.data.type='ORTHO';scene.camera=cam
for loc,col,energy in [((1,-2,6),(1,.25,.10),900),((-3,1,5),(.6,.3,.4),650)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=move(bpy.context.object,studio);ob.data.energy=energy;ob.data.color=col;ob.data.size=4;ob.rotation_euler=(-ob.location).to_track_quat('-Z','Y').to_euler()
specs={'blade':dict(cell=[320,320],count=32,fps=40,scale=2.65,loop=True,columns=6),'spin':dict(cell=[384,384],count=32,fps=120,scale=2.65,loop=True,columns=6)}
for kind,spec in specs.items():
 if args.kind and kind!=args.kind:continue
 for name,c in [('blade',blade),('spin',spin),('slash',slash),('finish',finish)]:c.hide_render=name!=kind
 w,h=spec['cell'];scene.render.resolution_x=w*2;scene.render.resolution_y=h*2;cam.data.ortho_scale=spec['scale']
 cam.location=(0,-3.2,6.5) if kind=='spin' else (0,0,20);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler() if kind=='spin' else (0,0,0)
 directory=OUT/'layers'/kind;directory.mkdir(parents=True,exist_ok=True)
 meta=dict(schema=1,kind=kind,frameCount=spec['count'],fps=spec['fps'],cellSize=[w,h],anchor=[.5,.5],loop=True,widthPerRadius=spec['scale'],columns=spec['columns'])
 (directory/'pass.json').write_text(json.dumps(meta,indent=2)+'\n','utf8')
 for i in ([0,3,7,11] if args.quick else range(spec['count'])):
  phase=i/spec['count']*math.tau
  for k,no in enumerate(flows):no.inputs['W'].default_value=math.sin(phase)*.8+k*.37
  if kind=='blade':
   for index,v in enumerate(sheet.data.vertices):v.co=bladepoint(index//(nv+1)/nu,index%(nv+1)/nv,phase)
  else:
   rotor.rotation_euler.z=phase
   for ob in vortex:ob.rotation_euler.z=phase
   for ob in crystals:ob.rotation_euler.z=-phase
  scene.render.filepath=str(directory/f'{i:03d}.png');bpy.ops.render.render(write_still=True)
 print('EXPORTED',kind,flush=True)
text=bpy.data.texts.new('build_scythe.py');text.write(Path(__file__).read_text('utf8'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'scythe-elements.blend'),compress=True)

