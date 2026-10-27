"""Golden thunder lance study. Blender 5.2; entirely procedural, no paid assets.

Run with blender.exe --background --python build_scene.py -- --frames 12,36,40
or --all. All motion is baked into editable keyframes in the saved .blend.
"""
import argparse
import bpy
import json
import math
import random
import sys
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
FPS = 24
END = 192
HIT = 1.50
R = Vector((0.880471, 0.4741, 0))
D = Vector((-0.4741, 0.880471, 0))
Z = Vector((0, 0, 1))
random.seed(271025)
parser = argparse.ArgumentParser()
parser.add_argument('--frames', default='12,30,38,42,53,80,118,158,188')
parser.add_argument('--all', action='store_true')
parser.add_argument('--size', type=int, default=960)
parser.add_argument('--samples', type=int, default=32)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)
scene = bpy.context.scene
# EEVEE provides fast material / volume previews; Cycles is a fallback only.
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'CYCLES'
scene.render.resolution_x = args.size
scene.render.resolution_y = args.size
scene.render.resolution_percentage = 100
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = END
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
if hasattr(scene, 'eevee'):
    scene.eevee.taa_render_samples = args.samples
    scene.eevee.volumetric_tile_size = '2'
    scene.eevee.volumetric_samples = 96
    scene.eevee.use_volume_custom_range = True
    scene.eevee.volumetric_start = 8
    scene.eevee.volumetric_end = 38
scene.cycles.samples = args.samples
scene.world.color = (0.045, 0.045, 0.045)
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = -0.45
scene.render.image_settings.compression = 25

def coll(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

BODY = coll('01 | crystalline thunder lance')
AIR = coll('02 | flight corona and wake')
BURST = coll('03 | contact detonation')
GROUND = coll('04 | surface lightning')
WAVE = coll('05 | advancing lightning fronts')
DEBRIS = coll('06 | ballistic fragments and embers')
STAGE = coll('00 | camera and studio lights')

def move_to(obj, collection):
    for old in list(obj.users_collection): old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def emission(name, color, power):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    e = nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = power
    m.node_tree.links.new(e.outputs[0], out.inputs['Surface'])
    m.diffuse_color = (*color, 1)
    return m

CORE = emission('Ivory plasma / restricted hot core', (1, .78, .30), 9)
GOLD = emission('Gold corona', (1, .37, .025), 3.8)
AMBER = emission('Amber edge / cool discharge', (1, .125, .008), 1.7)
FAINT = emission('Faint warm residual', (.72, .16, .008), .7)
HOT = emission('Peak contact white gold', (1, .87, .55), 17)

metal = bpy.data.materials.new('Obsidian gold crystal / faceted body')
metal.use_nodes = True
bs = metal.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value = (.16, .055, .007, 1)
bs.inputs['Metallic'].default_value = .78
bs.inputs['Roughness'].default_value = .23
bs.inputs['Emission Color'].default_value = (.55, .12, .005, 1)
bs.inputs['Emission Strength'].default_value = .22

stone = bpy.data.materials.new('Impact rock')
stone.use_nodes = True
pbs = stone.node_tree.nodes.get('Principled BSDF')
pbs.inputs['Base Color'].default_value = (.052, .042, .029, 1)
pbs.inputs['Roughness'].default_value = .85

def curve(name, pts, radius, mat, collection, taper=True):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions = '3D'
    c.resolution_u = 1
    c.bevel_depth = radius
    c.bevel_resolution = 1
    s = c.splines.new('POLY')
    s.points.add(len(pts)-1)
    for i, (p, xyz) in enumerate(zip(s.points, pts)):
        p.co = (*xyz, 1)
        p.radius = (max(.05, 1 - (i/(len(pts)-1))**2)*(.87+.13*math.sin(i*1.79))) if taper else 1
    o = bpy.data.objects.new(name, c)
    collection.objects.link(o)
    c.materials.append(mat)
    return o

def scale_key(o, t, v):
    o.scale = (v, v, v) if isinstance(v, (int, float)) else v
    o.keyframe_insert(data_path='scale', frame=t*FPS+1)

def life(o, start, end, peak=1, attack=.025, release=.08):
    keys=[(0,0),(max(0,start-.01),0),(start+attack,1),(max(start+attack,end-release),1),(end,0)]
    if o.type=='CURVE' and isinstance(peak,(int,float)):
        width=o.data.bevel_depth
        for t,v in keys:
            o.data.bevel_depth=width*v*peak
            o.data.keyframe_insert(data_path='bevel_depth',frame=t*FPS+1)
    else:
        for t,v in keys:
            scale_key(o,t,tuple(s*v for s in peak) if isinstance(peak,tuple) else peak*v)
    # Non-rounded subframe keys prevent early flashes when a short attack straddles a frame.
    o.hide_render=True;o.keyframe_insert(data_path='hide_render',frame=0)
    o.hide_render=False;o.keyframe_insert(data_path='hide_render',frame=start*FPS+1)
    o.hide_render=True;o.keyframe_insert(data_path='hide_render',frame=end*FPS+1)

def lightning(name, pts, width, collection, start, end, parent=None, outer=True):
    # Thin core and tapered amber sheath preserve a readable filament silhouette.
    objects = []
    for suffix, w, mat in [('core', width*1.35, CORE)] if outer else [('core', width, GOLD)]:
        o = curve(name+' / '+suffix, pts, w, mat, collection)
        o.parent = parent
        life(o, start, end, attack=.025, release=min(.075, (end-start)*.3))
        objects.append(o)
    return objects

def jagged(a, b, seed, spread=.14, n=18):
    rng = random.Random(seed)
    a, b = Vector(a), Vector(b)
    delta = b-a
    pts=[]
    for i in range(n+1):
        u=i/n
        jitter=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-1,1)))
        pts.append(a+delta*u+jitter*spread*math.sin(math.pi*u))
    return pts

def mesh(name, verts, faces, mat, collection):
    me=bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.materials.append(mat)
    o=bpy.data.objects.new(name,me)
    collection.objects.link(o)
    return o

root=bpy.data.objects.new('LANCE | tip anchor / all body motion',None)
BODY.objects.link(root)
root.scale=(1.45,1.45,1.23)
LENGTH=5.25
# A long irregular spine, not a cylinder or a conventional metal spear.
spine=[]
for i in range(43):
    t=i/42
    spine.append(Vector((.045*math.sin(t*23)*math.sin(math.pi*t), .035*math.sin(t*31), LENGTH*t)))
for name,rad,mat in [('hot spine',.028,CORE)]:
    obj=curve(name,spine,rad,mat,BODY,False)
    for i,p in enumerate(obj.data.splines[0].points):
        p.radius=.025+.975*math.sin(math.pi*i/42)**.42
    obj.parent=root

# Three unequal longitudinal plasma blades. No repeating spiral / diamond modules.
profile=[(0,0),(.065,.76),(.042,1.12),(.18,1.87),(.075,2.13),(.15,2.75),(.06,3.00),(.105,3.84),(.018,4.72),(0,5.25)]
for k in range(3):
    a=[.25,2.64,4.53][k]
    side=Vector((math.cos(a),math.sin(a),0))
    face=[]
    for i,(w,z) in enumerate(profile):
        pos=side*w*(1 if k==0 else .66)+Vector((.018*math.sin(z*5),0,z))
        face.append(pos)
    center=[Vector((.018*math.sin(z*5),0,z)) for w,z in profile]
    verts=face+center
    faces=[(i,i+1,len(face)+i+1,len(face)+i) for i in range(len(face)-1)]
    ob=mesh('Asymmetric plasma blade %d'%k,verts,faces,AMBER,BODY);ob.parent=root
    edge=curve('Unequal plasma ridge %d'%k,face,.014 if k==0 else .008,CORE if k==0 else GOLD,BODY)
    edge.parent=root

# Needle point, with visible amber sides and an ivory cutting edge.
tipverts=[(0,0,-.10),(-.14,0,.87),(0,.105,1.05),(.13,0,.73),(0,-.105,1.05)]
ob=mesh('Needle / contact point',tipverts,[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(1,4,3,2)],metal,BODY);ob.parent=root
for k in [1,2,3,4]:
    ob=curve('Needle cutting edge '+str(k),[Vector(tipverts[0]),Vector(tipverts[k])],.012,CORE,BODY);ob.parent=root

def pose(t):
    if t<.55:
        return R*(-2.7)+Z*(4.3+.025*math.sin(t*6)), (-R*.68+Z*.74).normalized()
    if t<HIT:
        u=(t-.55)/(HIT-.55)
        pos=R*(-2.7*(1-u))+Z*(4.3*(1-u**1.45))
        axis=(-R*2.7+Z*(4.3*1.45*max(.21,u)**.45)).normalized()
        return pos,axis
    return Z*(-.17*min(1,(t-HIT)/.12)),(-R*2.7+Z*(4.3*1.45)).normalized()

for f in range(1,END+1):
    t=(f-1)/FPS
    p,axis=pose(t)
    root.location=p
    root.rotation_mode='QUATERNION'
    root.rotation_quaternion=Z.rotation_difference(axis)
    root.keyframe_insert(data_path='location',frame=f)
    root.keyframe_insert(data_path='rotation_quaternion',frame=f)
# Dissolve upper vanes before the buried tip; do not shrink the entire spear into a toy.
for ob in list(BODY.objects):
    if ob==root:continue
    z=max([v.co.z for v in ob.data.vertices],default=2) if ob.type=='MESH' else 2
    end=6.6+(.55*(1-min(1,z/LENGTH)))
    life(ob,0,end,attack=.12,release=.48)

# Dense animated filament envelope: unequal lengths, changing curvature and radii.
# At any moment several overlapping bundles surround a clear pointed central core.
for k in range(166):
    rng=random.Random(7000+k)
    start=.015+k*.040
    end=min(6.98,start+rng.uniform(.29,.48))
    if start>end:continue
    for thread in range(3):
        angle=rng.uniform(0,math.tau)
        z0=rng.uniform(.05,1.7)
        z1=min(LENGTH+.30,z0+rng.uniform(2.1,5.5))
        radius=rng.uniform(.19,.65) if thread<2 else rng.uniform(.55,.85)
        turn=rng.uniform(2.4,6.8)*(-1 if k%2 else 1)
        pts=[]
        for j in range(38):
            u=j/37
            a=angle+u*turn+.5*math.sin(u*8+k)
            envelope=math.sin(math.pi*u)**.7
            rad=envelope*radius*(.7+.24*math.sin(u*13+k)+rng.random()*.2)
            jitter=.025 if thread<2 else .035
            pts.append(Vector((math.cos(a)*rad+rng.uniform(-jitter,jitter),math.sin(a)*rad+rng.uniform(-jitter,jitter),z0+(z1-z0)*u)))
        width=[.007,.004,.003][thread]*(1.4 if k%5==0 else 1)
        obs=lightning('Wandering sheath %03d.%d'%(k,thread),pts,width,AIR,start,end,parent=root,outer=thread==0)
        for ob in obs:
            ob.data.bevel_factor_end=.12
            ob.data.keyframe_insert(data_path='bevel_factor_end',frame=start*FPS+1)
            ob.data.bevel_factor_end=1
            ob.data.keyframe_insert(data_path='bevel_factor_end',frame=(start+.12)*FPS+1)
        if thread==0 and k%2==0:
            origin=pts[18]
            target=origin+Vector((math.cos(angle)*.5,math.sin(angle)*.5,.65))
            lightning('Sheath split %03d'%k,jagged(origin,target,k,spread=.065,n=12),.0035,AIR,start+.06,end,parent=root,outer=False)

# Afterimages follow the actual tip/shaft trajectory instead of an unrelated path.
for k in range(13):
    t=.59+k*.064
    p,axis=pose(t)
    pts=[p+axis*(.3+i*LENGTH/18) for i in range(17)]
    lightning('Flight wake %02d'%k,pts,.012,AIR,t,t+.15,outer=False)

# Initial upward crown: irregular tapered arcs, with delayed branch discharges.
for k in range(17):
    rng=random.Random(1100+k)
    a=rng.uniform(0,math.tau)
    dist=rng.uniform(1.8,4.4)
    height=rng.uniform(.7,2.7)
    pts=[]
    for j in range(19):
        u=j/18
        r=dist*u
        p=Vector((math.cos(a)*r,math.sin(a)*r,height*math.sin(math.pi*u*.85)+.03))
        p+=Vector((rng.uniform(-.13,.13),rng.uniform(-.13,.13),rng.uniform(-.09,.09)))*math.sin(math.pi*u)
        pts.append(p)
    start=HIT+.025+rng.uniform(0,.13)
    lightning('Detonation leader %02d'%k,pts,.012 if k%3 else .023,BURST,start,start+.28+rng.random()*.19)
    if k%2==0:
        origin=pts[11]
        target=origin+Vector((math.cos(a+.9)*.9,math.sin(a+.9)*.9,.3))
        lightning('Detonation fork %02d'%k,jagged(origin,target,k+90,.12,9),.006,BURST,start+.03,start+.30,outer=False)

# A compact faceted impact flare; short white peak followed by warm expanding fragments.
for k in range(10):
    rng=random.Random(1300+k)
    a=k*math.tau/10+rng.uniform(-.15,.15)
    direction=Vector((math.cos(a),math.sin(a),rng.uniform(.18,1.4)))
    side=Vector((-math.sin(a),math.cos(a),0))
    length=rng.uniform(.8,2.4)
    verts=[Vector((0,0,.05)),direction*length, direction*length*.28+side*.13, direction*length*.34-side*.11]
    ob=mesh('Contact shard flash %02d'%k,verts,[(0,2,1),(0,1,3)],HOT,BURST)
    life(ob,HIT,HIT+.21+rng.random()*.10,attack=.015,release=.15)

# Turbulent 3D ionized dust. Density has both noise erosion and radial falloff;
# these are genuine volumes, not opaque spheres or a video texture.
for k in range(9):
    rng=random.Random(1800+k)
    a=k*math.tau/9
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
    ob=move_to(bpy.context.object,BURST);ob.name='Ionized impact plume %02d'%k
    mat=bpy.data.materials.new(ob.name);mat.use_nodes=True
    nd=mat.node_tree.nodes;nd.clear();ln=mat.node_tree.links
    output=nd.new('ShaderNodeOutputMaterial');volume=nd.new('ShaderNodeVolumePrincipled')
    volume.inputs['Color'].default_value=(.18,.10,.032,1)
    volume.inputs['Emission Color'].default_value=(1,.26,.006,1)
    volume.inputs['Anisotropy'].default_value=.25
    coords=nd.new('ShaderNodeTexCoord')
    noise=nd.new('ShaderNodeTexNoise');noise.noise_dimensions='4D'
    noise.inputs['Scale'].default_value=4.7;noise.inputs['Detail'].default_value=4
    noise.inputs['Roughness'].default_value=.72
    ln.new(coords.outputs['Generated'],noise.inputs['Vector'])
    noise.inputs['W'].default_value=k*.71;noise.inputs['W'].keyframe_insert('default_value',frame=HIT*FPS+1)
    noise.inputs['W'].default_value=k*.71+1.8;noise.inputs['W'].keyframe_insert('default_value',frame=(HIT+1.1)*FPS+1)
    sub=nd.new('ShaderNodeVectorMath');sub.operation='SUBTRACT';sub.inputs[1].default_value=(.5,.5,.5)
    ln.new(coords.outputs['Generated'],sub.inputs[0])
    leng=nd.new('ShaderNodeVectorMath');leng.operation='LENGTH';ln.new(sub.outputs[0],leng.inputs[0])
    fall=nd.new('ShaderNodeMapRange');fall.inputs['From Min'].default_value=.18;fall.inputs['From Max'].default_value=.49
    fall.inputs['To Min'].default_value=1;fall.inputs['To Max'].default_value=0;fall.clamp=True
    ln.new(leng.outputs['Value'],fall.inputs['Value'])
    threshold=nd.new('ShaderNodeMath');threshold.operation='SUBTRACT';threshold.inputs[1].default_value=.41
    ln.new(noise.outputs['Fac'],threshold.inputs[0])
    product=nd.new('ShaderNodeMath');product.operation='MULTIPLY';product.use_clamp=True
    ln.new(threshold.outputs[0],product.inputs[0]);ln.new(fall.outputs[0],product.inputs[1])
    gain=nd.new('ShaderNodeMath');gain.operation='MULTIPLY';ln.new(product.outputs[0],gain.inputs[0])
    for t,val in [(HIT,0),(HIT+.10,11),(HIT+.38,5),(HIT+1.05,0)]:
        gain.inputs[1].default_value=val;gain.inputs[1].keyframe_insert('default_value',frame=t*FPS+1)
    ln.new(gain.outputs[0],volume.inputs['Density'])
    energy=nd.new('ShaderNodeMath');energy.operation='MULTIPLY';energy.inputs[1].default_value=4.8
    ln.new(gain.outputs[0],energy.inputs[0]);ln.new(energy.outputs[0],volume.inputs['Emission Strength'])
    ln.new(volume.outputs['Volume'],output.inputs['Volume']);ob.data.materials.append(mat)
    for u in [0,.12,.35,.65,1.05]:
        t=HIT+u
        r=.25+u*2.5
        ob.location=(math.cos(a)*r,math.sin(a)*r,.14+u*.45)
        ob.keyframe_insert(data_path='location',frame=t*FPS+1)
        scale_key(ob,t,(.14+u*1.25,.14+u*1.10,.12+u*(.75+rng.random()*.3)))
    ob.hide_render=True;ob.keyframe_insert(data_path='hide_render',frame=1)
    ob.hide_render=False;ob.keyframe_insert(data_path='hide_render',frame=HIT*FPS+1)
    ob.hide_render=True;ob.keyframe_insert(data_path='hide_render',frame=(HIT+1.08)*FPS+1)

# Five irregular surges: advancing branched leaders, never a closed circumference.
for wave_i,delay in enumerate([.035,.80,1.65,2.55,3.55]):
    for leader in range(9):
        rng=random.Random(3000+wave_i*70+leader)
        start=HIT+delay+rng.uniform(0,.21)
        travel=rng.uniform(.23,.46)
        a=rng.uniform(0,math.tau)
        reach=rng.uniform(2.5,5.5)
        turn=rng.uniform(-.8,.8)
        pts=[]
        for j in range(24):
            u=j/23
            theta=a+turn*u+math.sin(u*8+leader)*.1+rng.uniform(-.055,.055)
            rr=.16+reach*u
            pts.append(Vector((math.cos(theta)*rr,math.sin(theta)*rr,.055+rng.uniform(0,.05))))
        obs=lightning('Surge %d leader %02d'%(wave_i+1,leader),pts,.018 if leader%3==0 else .010,WAVE,start,start+travel+.18,outer=leader%2==0)
        for ob in obs:
            for dt,v in [(0,0),(travel,1)]:
                ob.data.bevel_factor_end=v
                ob.data.keyframe_insert(data_path='bevel_factor_end',frame=(start+dt)*FPS+1)
            for dt,v in [(0,0),(travel*.55,0),(travel+.18,1)]:
                ob.data.bevel_factor_start=v
                ob.data.keyframe_insert(data_path='bevel_factor_start',frame=(start+dt)*FPS+1)
        for fork in range(3):
            idx=[8,14,19][fork]
            origin=pts[idx]
            fa=a+rng.choice([-1,1])*rng.uniform(.45,1.1)
            endpt=origin+Vector((math.cos(fa)*reach*.33,math.sin(fa)*reach*.33,0))
            branch=jagged(origin,endpt,31000+wave_i*100+leader*3+fork,.10,14)
            for point in branch:point.z=.065+rng.random()*.035
            born=start+travel*idx/23
            obs=lightning('Surge %d fork %02d.%d'%(wave_i+1,leader,fork),branch,.006,WAVE,born,born+.25,outer=False)
            for ob in obs:
                ob.data.bevel_factor_end=0;ob.data.keyframe_insert(data_path='bevel_factor_end',frame=born*FPS+1)
                ob.data.bevel_factor_end=1;ob.data.keyframe_insert(data_path='bevel_factor_end',frame=(born+.12)*FPS+1)

# Ground leaders and branches: isolated short lifetimes, travel outward before decay.
for k in range(144):
    rng=random.Random(4600+k)
    start=HIT+.06+rng.random()*5.35
    dur=rng.uniform(.16,.38)
    a=rng.uniform(0,math.tau)
    dist=rng.uniform(1.1,4.6)
    pts=[]
    for j in range(19):
        u=j/18
        ang=a+math.sin(u*4.7+k)*.14+rng.uniform(-.10,.10)
        rr=.12+dist*u
        pts.append(Vector((math.cos(ang)*rr,math.sin(ang)*rr,.025+rng.random()*.026)))
    obs=lightning('Ground current %03d'%k,pts,.009 if k%6 else .017,GROUND,start,start+dur,outer=k%3==0)
    for ob in obs:
        ob.data.bevel_factor_end=0
        ob.data.keyframe_insert(data_path='bevel_factor_end',frame=round(start*FPS)+1)
        ob.data.bevel_factor_end=1
        ob.data.keyframe_insert(data_path='bevel_factor_end',frame=round((start+.085)*FPS)+1)
    if k%2==0:
        branch=jagged(pts[9],pts[9]+Vector((math.cos(a+.65)*dist*.42,math.sin(a+.65)*dist*.42,.01)),k,.12,9)
        for p in branch:p.z=.045
        lightning('Ground branch %03d'%k,branch,.005,GROUND,start+.055,start+dur,outer=False)

# A few towering discharge bolts connect the planted lance with the ground.
for k in range(52):
    rng=random.Random(5200+k)
    start=HIT+.19+k*.095
    a=rng.uniform(0,math.tau)
    p,axis=pose(HIT)
    origin=p+axis*rng.uniform(1.4,5.6)
    target=Vector((math.cos(a)*rng.uniform(1.5,4.4),math.sin(a)*rng.uniform(1.5,4.4),.06))
    pts=jagged(origin,target,k+320,.26,20)
    end=start+rng.uniform(.16,.25)
    lightning('Grounded high voltage %02d'%k,pts,.018 if k%3==0 else .011,AIR,start,end)
    # Each main leader has unequal side branches; they never form a regular tree.
    for branch_index in range(2 if k%3==0 else 1):
        j=rng.randrange(6,15)
        branch_target=pts[j]+Vector((rng.uniform(-.85,.85),rng.uniform(-.85,.85),rng.uniform(-.6,.35)))
        branch_target.z=max(.05,branch_target.z)
        lightning('Leader branch %02d.%d'%(k,branch_index),jagged(pts[j],branch_target,6200+k*3+branch_index,.09,9),.0045,AIR,start+.02,end-.015,outer=False)

# Small sparks shed from the charged shaft as well as the ground contact.
for k in range(75):
    rng=random.Random(7650+k)
    start=.15+k*.085
    p,axis=pose(start)
    origin=p+axis*rng.uniform(.6,5.9)
    vel=R*rng.uniform(-.9,.9)+D*rng.uniform(-.65,.65)+Z*rng.uniform(.1,.65)
    pts=[origin,origin-vel*.08]
    ob=curve('Shaft ember %02d'%k,pts,rng.uniform(.007,.016),GOLD,AIR)
    life(ob,start,start+.38,attack=.015,release=.18)
    ob.location=(0,0,0);ob.keyframe_insert(data_path='location',frame=start*FPS+1)
    ob.location=vel*.38-Z*.12;ob.keyframe_insert(data_path='location',frame=(start+.38)*FPS+1)

# Shared meshes for small ballistic debris; animation contains gravity and delayed touchdown.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
template=bpy.context.object
rockmesh=template.data
bpy.data.objects.remove(template,do_unlink=True)
rockmesh.materials.append(stone)
sparkmesh=rockmesh.copy();sparkmesh.materials.clear();sparkmesh.materials.append(GOLD)
for k in range(190):
    rng=random.Random(8800+k)
    rock=k<26
    ob=bpy.data.objects.new(('Rock ' if rock else 'Ember ')+str(k),rockmesh if rock else sparkmesh);DEBRIS.objects.link(ob)
    a=rng.uniform(0,math.tau)
    start=HIT+rng.uniform(0,.12) if k<125 else HIT+rng.uniform(.3,4.9)
    speed=rng.uniform(1.5,5.6) if k<125 else rng.uniform(.2,1.1)
    vz=rng.uniform(1.8,6.3) if k<125 else rng.uniform(.6,1.7)
    duration=rng.uniform(.6,1.1) if rock else rng.uniform(.30,.95)
    size=rng.uniform(.055,.14) if rock else rng.uniform(.008,.027)
    for i in range(13):
        age=duration*i/12
        p=Vector((math.cos(a)*speed*age,math.sin(a)*speed*age,max(.035,vz*age-4.9*age*age)))
        ob.location=p
        ob.rotation_euler=(age*3+k,age*4+k,age*2)
        ob.keyframe_insert(data_path='location',frame=round((start+age)*FPS)+1)
        ob.keyframe_insert(data_path='rotation_euler',frame=round((start+age)*FPS)+1)
    life(ob,start,start+duration,peak=(size,size*.65,size*(1 if rock else 2.5)),attack=.02,release=.23)

# Dark fissures with intermittent golden edges, staying within the impact footprint.
for k in range(9):
    rng=random.Random(9900+k)
    a=k*math.tau/9+rng.uniform(-.16,.16)
    reach=rng.uniform(.55,1.55)
    bend=rng.uniform(-.45,.45)
    pts=[]
    for i in range(12):
        r=(.06+i*.10)*reach
        angle=a+bend*i/11+rng.uniform(-.09,.09)
        pts.append(Vector((math.cos(angle)*r,math.sin(angle)*r,.012)))
    ob=curve('Scorch fissure %02d'%k,pts,.033,stone,GROUND)
    life(ob,HIT+.08,7.7,attack=.12,release=.8)
    ob=curve('Cooling fissure %02d'%k,[p+Z*.006 for p in pts],.008,AMBER,GROUND)
    life(ob,HIT+.10,5.4,attack=.05,release=2.3)

# Fixed camera; no camera shake conceals the timing or the silhouette.
bpy.ops.object.camera_add(location=(7.9,-14.7,12.6))
cam=move_to(bpy.context.object,STAGE)
target=Vector((0,0,2.2))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=15.8
cam.data.lens=45
scene.camera=cam

def area(name,loc,power,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    o=move_to(bpy.context.object,STAGE);o.name=name
    o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
area('Cool key', (2,-6,9),1700,(.5,.65,1),7)
area('Warm rim',(-4,3,6),2100,(1,.44,.08),5)

# Holdout clips buried geometry, providing clean transparent outputs for composition.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025))
plane=move_to(bpy.context.object,STAGE);plane.name='Ground holdout / clips buried tip'
holdout=bpy.data.materials.new('Transparent ground holdout');holdout.use_nodes=True
ns=holdout.node_tree.nodes;ns.clear();out=ns.new('ShaderNodeOutputMaterial');h=ns.new('ShaderNodeHoldout')
holdout.node_tree.links.new(h.outputs[0],out.inputs['Surface']);plane.data.materials.append(holdout)

# All transform and visibility curves use linear interpolation. Curved motion is sampled at 24fps.
for action in bpy.data.actions:
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    except AttributeError:
        for fc in action.fcurves:
            for kp in fc.keyframe_points:kp.interpolation='LINEAR'

for frame,name in [(1,'Charge / silhouette'),(14,'Release'),(37,'CONTACT'),(41,'Crown detonation'),(57,'Pulse 02'),(77,'Pulse 03'),(99,'Pulse 04'),(123,'Pulse 05'),(158,'Dissipation'),(192,'Clear')]:
    scene.timeline_markers.new(name,frame=frame)
scene['Study']='Golden thunder lance / independent visual prototype, not game integration'
scene['Reference']='QQ20261027-222518.mp4 plus user spear silhouette; gold palette requested'
scene['Impact seconds']=HIT
scene['FPS']=FPS
scene['Source script']='build_scene.py'
scene.frame_set(42)
for screen in bpy.data.screens:
    for area_ui in screen.areas:
        if area_ui.type=='VIEW_3D':
            area_ui.spaces.active.region_3d.view_perspective='CAMERA'
            area_ui.spaces.active.shading.type='MATERIAL'
            area_ui.spaces.active.overlay.show_overlays=False
text=bpy.data.texts.new('README - editable procedural study')
text.write('Independent 8s study, 24fps. All motion is baked into editable keyframes.\nTimeline marker CONTACT is frame 37.\nCollections separate body, corona, detonation, ground currents, fronts and debris.\nRender is transparent; compose_preview.py adds presentation background and bloom.\nNo game files changed. Source: build_scene.py.\n')
scene.render.filepath=str(OUT/'frames'/'frame_0042.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'golden-thunder-lance.blend'))
frames=list(range(1,END+1)) if args.all else [int(x) for x in args.frames.split(',')]
(OUT/'frames').mkdir(exist_ok=True)
(OUT/'scene-info.json').write_text(json.dumps({'blender':bpy.app.version_string,'engine':scene.render.engine,'fps':FPS,'frames':END,'resolution':args.size,'objects':len(scene.objects),'impact':HIT,'reference':'C:/Users/user/Downloads/QQ20261027-222518.mp4','gameIntegration':False,'published':False},indent=2))
for f in frames:
    scene.frame_set(f)
    scene.render.filepath=str(OUT/'frames'/('frame_%04d.png'%f))
    bpy.ops.render.render(write_still=True)
    print('STUDY_RENDERED',f,flush=True)
print('STUDY_COMPLETE',flush=True)
