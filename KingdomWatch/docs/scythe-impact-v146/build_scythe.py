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

# One continuous curved wake, with no separate teeth or vertical comb strands.
nu,nv=112,24;verts=[]
for i in range(nu+1):
 x=i/nu*2-1;env=max(0,1-x*x)**.65
 for j in range(nv+1):
  v=j/nv;verts.append((x+.12*math.sin(v*2.4+x*2)*v*env,-.3*x*x-v*.83*env,.025+.045*math.sin(v*math.pi)*env))
normalSheet=uvmesh('Continuous translucent crescent wake',verts,nu,nv,silk,blade)
normalBase=[tuple(v) for v in verts]
front=[(i/60-1,-.3*(i/60-1)**2,.06) for i in range(121)]
curve('Needle-thin leading edge',front,.006,hot,blade)
curve('Soft scarlet leading rim',[(x,y-.012,z-.012) for x,y,z in front],.016,edge,blade)
normalRibbons=[]
for k in range(3):
 positions=[]
 for i in range(81):
  u=i/80;x=u*2-1;en=math.sin(math.pi*u)**.55
  for j in range(7):
   v=j/6;depth=(k+.4)*.15
   positions.append((x+.04*math.sin(k+u*4),-.3*x*x-depth*en-(v-.5)*(.025+.012*k)*en,.035+k*.003))
 ob=uvmesh('Flowing curved lamina %02d'%k,positions,80,6,rose if k<2 else silk,blade);normalRibbons.append((ob,positions,k))

# An actual beveled 3D weapon, viewed obliquely, surrounded by long fading sweep surfaces.
root=bpy.data.objects.new('Scythe rotation about ground normal',None);spin.objects.link(root)
shaft=curve('Tapered blackened steel haft',[(-.19,-.84,.1),(-.13,-.4,.1),(-.09,.18,.1),(-.17,.62,.1),(-.38,.66,.1)],.026,metal,spin);shaft.parent=root
ob=curve('Thin red engraving along haft',[(-.17,-.84,.125),(-.11,-.4,.125),(-.07,.18,.125),(-.15,.62,.125)],.004,edge,spin);ob.parent=root
outer=[];inner=[]
for i in range(81):
 u=i/80;a=2.12-u*2.5;r=.88
 outer.append((-.12+math.cos(a)*r,-.14+math.sin(a)*r,.12))
 inner.append((-.12+math.cos(a)*(r-.20*(1-u)**.65),-.14+math.sin(a)*(r-.20*(1-u)**.65),.12))
steel=strip('Forged crescent bevel',outer,inner,metal,spin);steel.parent=root
solid=steel.modifiers.new('Steel thickness','SOLIDIFY');solid.thickness=.025
bevel=steel.modifiers.new('Grazing bevel','BEVEL');bevel.width=.008;bevel.segments=3
for name,pts,width,mat in [('Scarlet blade spine',outer,.009,edge),('Fine ivory edge',outer,.0028,hot),('Inner rim',inner,.004,red)]:
 ob=curve(name,pts,width,mat,spin);ob.parent=root
for k in range(8):
 y=-.7+k*.12;ob=curve('Haft binding %02d'%k,[(-.16,y,.13),(-.1,y+.025,.13)],.007,metal,spin);ob.parent=root
spinTrails=[]
for k in range(8):
 verts=[];span=3.1+(k%3)*.75
 for i in range(101):
  u=i/100;a=.7-span*(1-u)-k*.055;r=.96+(k-3)*.021
  for j in range(9):
   v=j/8;rr=r+(v-.5)*(.09 if k<3 else .20)*math.sin(math.pi*u)**.3
   verts.append((math.cos(a)*rr,math.sin(a)*rr,.07+math.sin(a*2+k)*.035+(v-.5)*.05))
 mat=hotveil if k==0 else rose if k<4 else shadowveil if k==7 else silk
 ob=uvmesh('Long feathered rotary surface %02d'%k,verts,100,8,mat,spin);spinTrails.append(ob)
for k in range(14):
 rng=random.Random(470+k);a=rng.random()*math.tau;r=rng.uniform(.96,1.17)
 pts=[(math.cos(a-j/19*.35)*r,math.sin(a-j/19*.35)*r,.04) for j in range(20)]
 ob=curve('Tangential speed streak %02d'%k,pts,rng.uniform(.0015,.0035),edge if k%4 else hot,spin);spinTrails.append(ob)

# A brief luminous cutting sheet instead of an opaque crack. Animation exposes it in 30 ms.
slashObjects=[]
for k in range(5):
 verts=[]
 for i in range(121):
  u=i/120;x=(u*2-1)*1.12;env=math.sin(math.pi*u)**.7
  for j in range(9):
   v=j/8;verts.append((x,.10*math.sin(math.pi*u)+(v-.5)*(.035+k*.032)*env-k*.022,.05+math.sin(u*math.pi)*.09+k*.01))
 ob=uvmesh('Searing shear film %d'%k,verts,120,8,hotveil if k==0 else rose if k<3 else silk,slash);slashObjects.append(ob)
for k in range(2):
 pts=[(-1.09+i/79*2.18,.1*math.sin(math.pi*i/79)-k*.016,.16) for i in range(80)]
 ob=curve('Needle velocity trace %d'%k,pts,.0015 if k else .004,hot if k<2 else edge,slash);slashObjects.append(ob)

# One enlarged execution sweep, with local impact flash and directional fragments.
finishSheets=[]
for k in range(8):
 verts=[]
 for i in range(121):
  u=i/120;x=(u*2-1)*1.27;env=math.sin(math.pi*u)**.7
  for j in range(13):
   v=j/12;verts.append((x,.15*math.sin(math.pi*u)+(v-.5)*(.075+k*.048)*env-k*.018,.04+math.sin(u*math.pi)*.14+k*.008))
 ob=uvmesh('Execution broad sweep %d'%k,verts,120,12,hotveil if k<2 else rose if k<5 else silk,finish);finishSheets.append(ob)
ob=curve('Execution incandescent edge',[(-1.25+i/119*2.5,.15*math.sin(math.pi*i/119),.20) for i in range(120)],.007,hot,finish);finishSheets.append(ob)
sparks=[]
for k in range(58):
 rng=random.Random(46000+k);a=rng.uniform(0,math.tau);r=rng.uniform(.45,1.3);z=rng.uniform(.02,.45)
 ob=curve('Execution spark %02d'%k,[(0,0,0),(.04,0,0),(.13,0,0)],rng.uniform(.0015,.005),hot if k%4==0 else edge,finish);sparks.append((ob,a,r,z))
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1);flash=move(bpy.context.object,finish);flash.name='Execution contact flash';flash.data.materials.append(hot)

bpy.ops.object.camera_add(location=(0,0,20));cam=move(bpy.context.object,studio);cam.data.type='ORTHO';scene.camera=cam
for loc,color,energy in [((1,-2,6),(1,.35,.20),700),((-3,1,5),(.55,.45,.65),1100)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=move(bpy.context.object,studio);l.data.energy=energy;l.data.color=color;l.data.size=4;l.rotation_euler=(-l.location).to_track_quat('-Z','Y').to_euler()
specs={'blade':dict(cell=[320,320],count=32,fps=32,scale=2.65,loop=True,columns=6),
 'spin':dict(cell=[448,320],count=32,fps=96,scale=2.8,loop=True,columns=6),
 'slash':dict(cell=[512,192],count=12,fps=60,scale=2.8,loop=False,columns=6),
 'finish':dict(cell=[512,384],count=24,fps=40,scale=3.15,loop=False,columns=6)}
for kind,spec in specs.items():
 if args.kind and kind!=args.kind:continue
 for name,c in [('blade',blade),('spin',spin),('slash',slash),('finish',finish)]:c.hide_render=name!=kind
 w,h=spec['cell'];scene.render.resolution_x=w*2;scene.render.resolution_y=h*2;cam.data.ortho_scale=spec['scale']
 cam.location=(0,-6,5) if kind=='spin' else (0,0,20);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler() if kind=='spin' else (0,0,0)
 directory=OUT/'layers'/kind;directory.mkdir(parents=True,exist_ok=True)
 meta=dict(schema=1,kind=kind,frameCount=spec['count'],fps=spec['fps'],cellSize=[w,h],anchor=[.5,.5],loop=spec['loop'],widthPerRadius=spec['scale'],columns=spec['columns'])
 (directory/'pass.json').write_text(json.dumps(meta,indent=2)+'\n','utf8')
 for i in ([0,3,7,11] if args.quick else range(spec['count'])):
  t=i/spec['fps'];phase=i/spec['count']*math.tau
  for k,noise in enumerate(flows):noise.inputs['W'].default_value=math.sin(phase)*.65+k*.37
  if kind=='blade':
   for j,(v,base) in enumerate(zip(normalSheet.data.vertices,normalBase)):
    u=(j%(nv+1))/nv;v.co=(base[0]+math.sin(base[0]*9+u*5-phase)*.035*u,base[1]+math.sin(base[0]*7+u*8-phase*2)*.025*u,base[2])
   for ob,base,k in normalRibbons:
    for v,b in zip(ob.data.vertices,base):v.co=(b[0],b[1]+math.sin(b[0]*6-phase*2+k)*.012,b[2])
  elif kind=='spin':
   root.rotation_euler.z=phase
   for ob in spinTrails:ob.rotation_euler.z=phase
  elif kind=='slash':
   grow=min(1,t/.026);fade=max(.002,1-t/.2)
   for k,ob in enumerate(slashObjects):ob.scale=(grow,fade**.65,1);ob.location.y=t*.55;ob.location.x=(1-grow)*-.8
  else:
   strike=max(0,t-.035);grow=min(1,strike/.025);fade=max(.001,1-strike/.5)
   for k,ob in enumerate(finishSheets):ob.scale=(max(.01,grow),max(.005,grow*fade**1.3),1);ob.rotation_euler.z=math.radians(24);ob.location.y=strike*.13
   f=.07*math.exp(-strike*19) if t>=.035 else .002;flash.scale=(f*3.4,f*.22,.012);flash.location.z=.3
   for ob,a,r,z in sparks:
    d=min(1,strike*3);ob.location=(math.cos(a)*r*d,math.sin(a)*r*d*.65,z*d);ob.rotation_euler.z=a;ob.scale=(max(.001,d*(1-d)),max(.001,1-d),1)
  scene.render.filepath=str(directory/f'{i:03d}.png');bpy.ops.render.render(write_still=True)
 print('EXPORTED',kind,flush=True)
scene['description']='Scythe v146: curved translucent flow, oblique rotary volume, 200ms shearing strikes, single execution stroke.'
text=bpy.data.texts.new('build_scythe.py');text.write(Path(__file__).read_text('utf8'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'scythe-elements.blend'),compress=True)
