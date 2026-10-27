"""Editable red/dark-red scythe elements. Blender 5.2, orthographic, fixed anchors.
Render blade / rotating weapon / tearing slash independently, never a full-screen movie.
"""
import bpy,math,random,json,sys,argparse
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--quick',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
scene.render.resolution_percentage=100;scene.eevee.taa_render_samples=48
scene.world.color=(.04,.025,.03);scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.6
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
blade=collection('01 crescent blade');spin=collection('02 hooked scythe and rotary wake');slash=collection('03 cross-cut tear');studio=collection('00 studio')
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
# Normal attack: the leading parabola exactly matches scytheBladeEntry's visible collider.
front=[(s,-.3*s*s,.03) for s in [i/40-1 for i in range(81)]]
back=[(x,y-.13*max(0,1-x*x)**.65,.02) for x,y,z in front]
strip('Solid crescent cutting ribbon',front,back,red,blade)
curve('Unbroken sharp leading edge',front,.012,hot,blade)
curve('Scarlet secondary edge',[(x,y-.025,z) for x,y,z in front],.024,edge,blade)
wisps=[]
# Interrupted translucent crimson sheets break up the simple ribbon into wind-torn energy.
tail=bpy.data.materials.new('Flowing eroded blade tail');tail.use_nodes=True
nodes=tail.node_tree.nodes;nodes.clear();links=tail.node_tree.links
out=nodes.new('ShaderNodeOutputMaterial');transparent=nodes.new('ShaderNodeBsdfTransparent');emit=nodes.new('ShaderNodeEmission')
emit.inputs[0].default_value=(1,.008,.015,1);emit.inputs[1].default_value=1.7
mix=nodes.new('ShaderNodeMixShader');links.new(transparent.outputs[0],mix.inputs[1]);links.new(emit.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],out.inputs[0])
coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(24,4,1);links.new(coord.outputs['Generated'],mapping.inputs[0])
noise=nodes.new('ShaderNodeTexNoise');noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=3;links.new(mapping.outputs[0],noise.inputs['Vector'])
ramp=nodes.new('ShaderNodeMapRange');ramp.clamp=True;ramp.inputs['From Min'].default_value=.42;ramp.inputs['From Max'].default_value=.68;ramp.inputs['To Max'].default_value=.55
links.new(noise.outputs['Fac'],ramp.inputs['Value']);links.new(ramp.outputs[0],mix.inputs[0])
for k in range(15):
 x=-.91+k*.13;env=(1-x*x)**.7
 verts=[(x-.045,-.3*x*x-.06,.005),(x+.045,-.3*x*x-.06,.005),(x+.025,-.3*x*x-env*.6,.005),(x-.03,-.3*x*x-env*.84,.005)]
 mesh('Eroding trailing energy sheet %d'%k,verts,[(0,1,2,3)],tail,blade)
for k in range(54):
 rng=random.Random(14400+k);x=rng.uniform(-.98,.98);length=rng.uniform(.22,.92)*(1-x*x)**.65
 points=[(x,-.3*x*x-length*j/25,.01) for j in range(26)]
 obj=curve('Advecting ripped blade trail %02d'%k,points,rng.uniform(.002,.007),red if k%3 else edge,blade)
 wisps.append((obj,x,length,rng.random()*math.tau,k))
# Skill: long handle, asymmetrical single hooked blade, readable even in the moving wake.
root=bpy.data.objects.new('SCYTHE / rotation pivot',None);spin.objects.link(root)
shaft=curve('Crooked long steel haft',[(-.21,-.91,.04),(-.16,-.38,.04),(-.11,.22,.04),(-.15,.62,.04),(-.36,.69,.04)],.035,metal,spin);shaft.parent=root
shaft=curve('Crimson haft edge',[(-.19,-.91,.075),(-.14,-.38,.075),(-.09,.22,.075),(-.13,.62,.075)],.009,edge,spin);shaft.parent=root
outer=[];inner=[]
for i in range(65):
 u=i/64;a=2.12-u*2.5;r=.89
 outer.append((-.12+math.cos(a)*r,-.14+math.sin(a)*r,.09))
 inner.append((-.12+math.cos(a)*(r-.24*(1-u)**.7),-.14+math.sin(a)*(r-.24*(1-u)**.7),.09))
for obj in [strip('Broad hooked obsidian blade',outer,inner,metal,spin),curve('Scythe outer red edge',outer,.016,edge,spin),curve('Scythe thin hot edge',outer,.005,hot,spin),curve('Inner serrated red edge',inner,.009,red,spin)]:obj.parent=root
for k in range(9):
 y=-.72+k*.11;obj=curve('Haft grip %d'%k,[(-.19,y,.08),(-.125,y+.02,.09)],.012,red if k%3==0 else metal,spin);obj.parent=root
for k in range(5):
 a=1.7-k*.29;center=Vector((-.12+math.cos(a)*.76,-.14+math.sin(a)*.76,.10));direction=Vector((math.cos(a),math.sin(a),0))
 obj=mesh('Blade jagged spine %d'%k,[center,center+Vector((.09,.03,0)),center-direction*.14],[(0,1,2)],red,spin);obj.parent=root
trails=[]
for k in range(13):
 pts=[]
 for j in range(70):
  u=j/69;a=-u*(1.5+k*.08)+.4;r=.95+(k-6)*.009
  pts.append((math.cos(a)*r,math.sin(a)*r,.01))
 ob=curve('Rotary trailing filament %d'%k,pts,.012 if k%3 else .027,edge if k<3 else red if k<7 else faint,spin)
 trails.append(ob)
for k in range(3):
 # Wide tapered wake segments leave the rest of the circle open.
 a0=.4-k*.07;aa=[a0-j/64*(1.6+k*.12) for j in range(65)]
 outer=[(math.cos(a)*(1.02+k*.012),math.sin(a)*(1.02+k*.012),.0) for a in aa]
 inner=[(math.cos(a)*(1.02+k*.012-.11*math.sin(math.pi*j/64)),math.sin(a)*(1.02+k*.012-.11*math.sin(math.pi*j/64)),.0) for j,a in enumerate(aa)]
 ob=strip('Broad rotational smear %d'%k,outer,inner,faint if k else red,spin);trails.append(ob)
# Ultimate modular cut: black-red torn center bordered by thin incandescent scarlet lips.
slash_dynamic=[]
for layer in range(5):
 rng=random.Random(18800+layer);n=81;top=[];bottom=[]
 for i in range(n):
  u=i/(n-1);x=(u*2-1)*1.0;env=math.sin(math.pi*u)**1.6
  width=(.041+layer*.012)*env*(.6+.4*rng.random());bend=.013*math.sin(u*17+layer)
  top.append((x,bend+width,.05-layer*.01));bottom.append((x,bend-width,.05-layer*.01))
 mat=black if layer==0 else red if layer<3 else faint
 obj=strip('Ragged slash core %d'%layer,top,bottom,mat,slash);slash_dynamic.append(obj)
 for side,pts in enumerate([top,bottom]):
  obj=curve('Tearing lip %d.%d'%(layer,side),pts,.0035 if layer==0 else .0018,hot if layer==0 else edge,slash);slash_dynamic.append(obj)
for k in range(22):
 rng=random.Random(19900+k);x=rng.uniform(-.9,.85);side=rng.choice([-1,1]);length=rng.uniform(.05,.23)
 ob=curve('Shredded trailing splinter %02d'%k,[(x,.015*side,.01),(x-length*.45,side*.07,.01),(x-length,side*rng.uniform(.08,.14),.01)],.0025,red if k%3 else edge,slash);slash_dynamic.append(ob)
bpy.ops.object.camera_add(location=(0,0,20));cam=move(bpy.context.object,studio);cam.rotation_euler=(0,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=2.7;scene.camera=cam
for loc,color,energy in [((1,-2,6),(1,.22,.12),500),((-3,1,5),(.55,.35,.5),700)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=move(bpy.context.object,studio);l.data.energy=energy;l.data.color=color;l.data.size=4;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
specs={'blade':dict(cell=[256,256],count=32,fps=32,scale=2.65,loop=True),
 'spin':dict(cell=[384,384],count=32,fps=80,scale=2.65,loop=True),
 'slash':dict(cell=[640,160],count=18,fps=30,scale=2.6,loop=False)}
for kind,spec in specs.items():
 for name,c in [('blade',blade),('spin',spin),('slash',slash)]:c.hide_render=name!=kind
 w,h=spec['cell'];scene.render.resolution_x=w*2;scene.render.resolution_y=h*2;cam.data.ortho_scale=spec['scale']
 directory=OUT/'layers'/kind;directory.mkdir(parents=True,exist_ok=True)
 meta=dict(schema=1,kind=kind,frameCount=spec['count'],fps=spec['fps'],cellSize=[w,h],anchor=[.5,.5],loop=spec['loop'],widthPerRadius=spec['scale'],columns=8 if kind!='slash' else 4)
 (directory/'pass.json').write_text(json.dumps(meta,indent=2)+'\n','utf8')
 for i in ([0,4,8,12,16] if args.quick else range(spec['count'])):
  t=i/spec['fps'];phase=i/spec['count']*math.tau
  if kind=='blade':
   noise.inputs['W'].default_value=phase*.7
   for obj,x,length,seed,k in wisps:
    for j,point in enumerate(obj.data.splines[0].points):
     u=j/25;wav=math.sin(u*18-phase*2+seed)*.018*u
     point.co=(x+wav,-.3*x*x-length*u*(.82+.18*math.sin(phase+seed)),.01,1)
     point.radius=(1-u)**.7*(.16+.84*(.5+.5*math.sin(u*21-phase*3+seed))**2)
  elif kind=='spin':
   root.rotation_euler.z=phase
   for obj in trails:obj.rotation_euler.z=phase
  else:
   u=i/(spec['count']-1);growth=min(1,u/.17);fade=(1-u)**.6
   for k,obj in enumerate(slash_dynamic):
    obj.scale=(growth*(.78+.22*u),max(.02,fade),1)
    obj.location.x=(k%3-1)*u*.08
    if obj.type=='CURVE':obj.data.bevel_factor_start=max(0,(u-.55)*1.1)
  scene.render.filepath=str(directory/f'{i:03d}.png');bpy.ops.render.render(write_still=True)
 print('EXPORTED',kind,flush=True)
scene['description']='Scythe v144: red crescent, fast physical hook, modular crossed execution cuts. Run embedded production script to regenerate.'
text=bpy.data.texts.new('build_scythe.py');text.write(Path(__file__).read_text('utf8'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'scythe-elements.blend'),compress=True)
