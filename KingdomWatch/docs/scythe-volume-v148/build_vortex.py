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

silk=flowing('Blood-red soft advected veil',(1,.004,.021),1.4,.36)
rose=flowing('Scarlet luminous silk',(1,.024,.045),2.2,.42,True)
hotveil=flowing('Hot orange-white grazing film',(1,.28,.065),16,.9,True)
shadowveil=flowing('Dark carmine translucent wake',(.18,.001,.012),1,.56,True)

# A filled, raised energy mass: continuous density across the center, with moving internal eddies.
core=bpy.data.materials.new('Turbulent dense wine-red energy');core.use_nodes=True;core.surface_render_method='DITHERED'
n=core.node_tree.nodes;n.clear();l=core.node_tree.links
tex=n.new('ShaderNodeTexCoord');sep=n.new('ShaderNodeSeparateXYZ');l.new(tex.outputs['Generated'],sep.inputs[0])
sub=n.new('ShaderNodeVectorMath');sub.operation='SUBTRACT';sub.inputs[1].default_value=(.5,.5,.5);l.new(tex.outputs['Generated'],sub.inputs[0])
length=n.new('ShaderNodeVectorMath');length.operation='LENGTH';l.new(sub.outputs[0],length.inputs[0])
angle=n.new('ShaderNodeMath');angle.operation='MULTIPLY';angle.inputs[1].default_value=11;l.new(length.outputs['Value'],angle.inputs[0])
rotate=n.new('ShaderNodeVectorRotate');rotate.rotation_type='AXIS_ANGLE';rotate.inputs['Center'].default_value=(.5,.5,.5);rotate.inputs['Axis'].default_value=(0,0,1)
l.new(tex.outputs['Generated'],rotate.inputs['Vector']);l.new(angle.outputs[0],rotate.inputs['Angle'])
noise=n.new('ShaderNodeTexNoise');noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=5.2;noise.inputs['Detail'].default_value=4;noise.inputs['Roughness'].default_value=.67;l.new(rotate.outputs[0],noise.inputs[0]);flows.append(noise)
ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
for i,(v,col) in enumerate([(.18,(.003,.0001,.001,1)),(.42,(.018,.0003,.003,1)),(.59,(.09,.002,.008,1)),(.72,(.28,.007,.018,1)),(.88,(.70,.07,.026,1))]):
 e=ramp.color_ramp.elements[0] if not i else ramp.color_ramp.elements.new(v);e.position=v;e.color=col
l.new(noise.outputs['Fac'],ramp.inputs[0])
bs=n.new('ShaderNodeBsdfPrincipled');bs.inputs['Metallic'].default_value=.12;bs.inputs['Roughness'].default_value=.4
l.new(ramp.outputs[0],bs.inputs['Base Color']);l.new(ramp.outputs[0],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.8
fading=n.new('ShaderNodeMapRange');fading.clamp=True;fading.interpolation_type='SMOOTHSTEP';fading.inputs['From Min'].default_value=.72;fading.inputs['From Max'].default_value=1;fading.inputs['To Min'].default_value=.97;fading.inputs['To Max'].default_value=0
uv=n.new('ShaderNodeTexCoord');uvsep=n.new('ShaderNodeSeparateXYZ');l.new(uv.outputs['UV'],uvsep.inputs[0]);l.new(uvsep.outputs['Y'],fading.inputs[0])
trans=n.new('ShaderNodeBsdfTransparent');mix=n.new('ShaderNodeMixShader');l.new(fading.outputs[0],mix.inputs[0]);l.new(trans.outputs[0],mix.inputs[1]);l.new(bs.outputs[0],mix.inputs[2]);out=n.new('ShaderNodeOutputMaterial');l.new(mix.outputs[0],out.inputs[0])
verts=[];nu,nv=128,32
for i in range(nu+1):
 a=i/nu*math.tau
 for j in range(nv+1):
  r=j/nv*.91;rr=r*(1+.05*math.sin(a*3)+.035*math.sin(a*7+1))
  verts.append((.035+math.cos(a)*rr,-.025+math.sin(a)*rr,.055+.23*(1-(j/nv)**2)+.025*math.sin(a*4)*r))
mass=uvmesh('Raised opaque-center turbulent energy',verts,nu,nv,core,spin);massBase=verts[:]

# The two knives are glimpsed inside the flow, with shorter broken silhouettes and soft wake.
rotor=bpy.data.objects.new('Twin knives inside the energy',None);spin.objects.link(rotor)
bladeMat=emission('Dim red semi-hidden blade',(.13,.001,.009),1.1)
for side in range(2):
 outer=[];inner=[]
 for i in range(65):
  u=i/64;a=side*math.pi+.45+u*1.65;r=.84+.04*math.sin(u*math.pi)
  outer.append((math.cos(a)*r,math.sin(a)*r,.19))
  rr=r-.095*math.sin(u*math.pi)**.5;inner.append((math.cos(a)*rr,math.sin(a)*rr,.17))
 ob=strip('Brief knife glimpse %d'%side,outer,inner,bladeMat,spin);ob.parent=rotor
 for pts,width,mat in [(outer,.006,edge),(outer,.0018,hot)]:
  ob=curve('Partial knife rim',pts,width,mat,spin);ob.parent=rotor

veils=[]
for k in range(9):
 rng=random.Random(1480+k);a0=rng.random()*math.tau;span=rng.uniform(1.3,3.7);verts=[]
 for i in range(81):
  u=i/80;a=a0-span*(1-u);r=.31+u*(.65+(k%3)*.09)
  for j in range(9):
   v=j/8;rr=r+(v-.5)*(.24+.05*(k%3))*math.sin(math.pi*u)**.45
   verts.append((math.cos(a)*rr,math.sin(a)*rr,.13+.13*math.sin(u*math.pi)+.04*math.sin(a*2+k)))
 ob=uvmesh('Unequal rolling energy tongue %d'%k,verts,80,8,shadowveil if k%2==0 else silk if k%3 else rose,spin);veils.append((ob,k))

# Sparks leave the rotating body along tangents; no regular ring of light.
threads=[]
for k in range(24):
 rng=random.Random(14800+k);seed=rng.random();pts=[(0,0,0)]*28
 ob=curve('Escaping ember filament %02d'%k,pts,rng.uniform(.0018,.005),edge if k%5 else hot,spin)
 threads.append((ob,seed,k,rng.uniform(.12,.50)))
flakes=[]
for k in range(11):
 ob=mesh('Torn crimson fragment %d'%k,[(0,0,0),(-.045,-.018,0),(-.12,.015,.005),(-.04,.025,.009)],[(0,1,2),(0,2,3)],red if k%3 else faint,spin);flakes.append(ob)
coreSparks=[]
for k in range(4):
 a=k*2.39996;r=.08+k*.045;x,y=math.cos(a)*r,math.sin(a)*r
 ob=curve('Core incandescent shard %d'%k,[(x-.025,y-.02,.27),(x,y,.31),(x+.008,y+.032,.29)],.004,edge if k else hot,spin);coreSparks.append(ob)
for k in range(6):
 pts=[]
 for j in range(30):
  u=j/29;a=k*2.39996+u*(.35+.11*(k%3));r=.22+k*.065+.045*u
  pts.append((math.cos(a)*r+.025,math.sin(a)*r,.285+.035*math.sin(u*math.pi)))
 ob=curve('Brief internal shear glint %d'%k,pts,.0035 if k%2 else .005,hot if k%3==0 else edge,spin);coreSparks.append(ob)

bpy.ops.object.camera_add(location=(0,-6.0,5.5));cam=move(bpy.context.object,studio);cam.data.type='ORTHO';cam.data.ortho_scale=3.6;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
for loc,col,energy in [((1,-2,6),(1,.23,.12),650),((-3,1,5),(.5,.12,.20),500)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=move(bpy.context.object,studio);ob.data.energy=energy;ob.data.color=col;ob.data.size=4;ob.rotation_euler=(-ob.location).to_track_quat('-Z','Y').to_euler()
for c in [blade,slash,finish]:c.hide_render=True
scene.render.resolution_x=896;scene.render.resolution_y=896
directory=OUT/'layers/spin';directory.mkdir(parents=True,exist_ok=True)
meta=dict(schema=1,kind='spin',frameCount=32,fps=120,cellSize=[448,448],anchor=[.5,.5],loop=True,widthPerRadius=3.6,columns=6)
(directory/'pass.json').write_text(json.dumps(meta,indent=2)+'\n','utf8')
for i in ([0,3,7,11] if args.quick else range(32)):
 phase=i/32*math.tau
 for k,no in enumerate(flows):no.inputs['W'].default_value=math.sin(phase+k*.2)*.8+k*.37
 rotor.rotation_euler.z=phase
 mass.rotation_euler.z=-phase
 for v,b in zip(mass.data.vertices,massBase):v.co=(b[0],b[1],b[2]+.015*math.sin(b[0]*15+b[1]*7+phase*2))
 for ob,k in veils:ob.rotation_euler.z=phase*(1 if k%3 else -1)
 for ob,seed,k,span in threads:
  u=(i/32+seed)%1;a=phase+(k*2.39996)+u*.75;radius=.72+u*.81;alpha=math.sin(math.pi*u)**.75
  for j,p in enumerate(ob.data.splines[0].points):
   t=j/27;theta=a-span*t;rr=radius-t*.09;p.co=(math.cos(theta)*rr,math.sin(theta)*rr,.06+.17*math.sin(u*math.pi),1);p.radius=(1-t)*alpha
 for k,ob in enumerate(flakes):
  u=(i/32+k*.137)%1;a=phase+k*2.39996;r=.67+u*.77;ob.location=(math.cos(a)*r,math.sin(a)*r,.1+u*.2);ob.rotation_euler.z=a+1.57;ob.scale=(math.sin(u*math.pi),)*3
 for ob in coreSparks:ob.rotation_euler.z=-phase
 scene.render.filepath=str(directory/f'{i:03d}.png');bpy.ops.render.render(write_still=True)
text=bpy.data.texts.new('build_vortex.py');text.write(Path(__file__).read_text('utf8'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'scythe-vortex.blend'),compress=True)
