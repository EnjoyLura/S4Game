"""Impact-only layers inspired by the game's compressed blast and torn wavefront.
No game code is imported or executed. This builds editable Blender objects.
"""
import bpy
import math
import random
from mathutils import Vector


def add_impact_revision(ns):
    curve, mesh, life = (ns[k] for k in ('curve','mesh','life'))
    lightning, jagged, scale_key = (ns[k] for k in ('lightning','jagged','scale_key'))
    move_to=ns['move_to']
    BURST, GROUND, WAVE, DEBRIS=(ns[k] for k in ('BURST','GROUND','WAVE','DEBRIS'))
    GOLD, CORE, AMBER, HOT, stone=(ns[k] for k in ('GOLD','CORE','AMBER','HOT','stone'))
    HIT,FPS,Z=ns['HIT'],ns['FPS'],ns['Z']

    def value_key(socket,t,value):
        socket.default_value=value
        socket.keyframe_insert(data_path='default_value',frame=t*FPS+1)

    def blast_material(name,secondary=False):
        mat=bpy.data.materials.new(name);mat.use_nodes=True
        nodes=mat.node_tree.nodes;nodes.clear();links=mat.node_tree.links
        out=nodes.new('ShaderNodeOutputMaterial')
        trans=nodes.new('ShaderNodeBsdfTransparent')
        emit=nodes.new('ShaderNodeEmission')
        mix=nodes.new('ShaderNodeMixShader')
        links.new(trans.outputs[0],mix.inputs[1]);links.new(emit.outputs[0],mix.inputs[2])
        links.new(mix.outputs[0],out.inputs['Surface'])
        tex=nodes.new('ShaderNodeTexNoise');tex.noise_dimensions='4D'
        tex.inputs['Scale'].default_value=5.4;tex.inputs['Detail'].default_value=4.5
        tex.inputs['Roughness'].default_value=.73
        coord=nodes.new('ShaderNodeTexCoord');links.new(coord.outputs['Generated'],tex.inputs['Vector'])
        value_key(tex.inputs['W'],HIT,1.7 if secondary else .3)
        value_key(tex.inputs['W'],HIT+.65,3.6 if secondary else 2.3)
        ramp=nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position=.24
        ramp.color_ramp.elements[0].color=(.75,.11,.002,1)
        ramp.color_ramp.elements[1].position=.72
        ramp.color_ramp.elements[1].color=(1,.92,.49,1)
        mid=ramp.color_ramp.elements.new(.49);mid.color=(1,.48,.015,1)
        links.new(tex.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],emit.inputs['Color'])
        # Erode openings over time; the front has holes before it disappears.
        erode=nodes.new('ShaderNodeMapRange');erode.clamp=True
        links.new(tex.outputs['Fac'],erode.inputs['Value'])
        erode.inputs['From Max'].default_value=.68
        erode.inputs['To Min'].default_value=0;erode.inputs['To Max'].default_value=1
        for t,v in [(0,.15),(.11,.20),(.24,.38),(.45,.52),(.65,.66)]:
            value_key(erode.inputs['From Min'],HIT+t,v)
        facing=nodes.new('ShaderNodeLayerWeight');facing.inputs['Blend'].default_value=.35
        edge=nodes.new('ShaderNodeMath');edge.operation='MULTIPLY_ADD'
        links.new(facing.outputs['Facing'],edge.inputs[0]);edge.inputs[1].default_value=.68;edge.inputs[2].default_value=.32
        mul=nodes.new('ShaderNodeMath');mul.operation='MULTIPLY'
        links.new(erode.outputs[0],mul.inputs[0]);links.new(edge.outputs[0],mul.inputs[1])
        gain=nodes.new('ShaderNodeMath');gain.operation='MULTIPLY'
        links.new(mul.outputs[0],gain.inputs[0]);links.new(gain.outputs[0],mix.inputs[0])
        for dt,power,alpha in [(0,22,1),(.045,15,1),(.12,6,.78),(.24,3.6,.55),(.43,1.8,.30),(.65,.3,0)]:
            value_key(emit.inputs['Strength'],HIT+dt,power*(.65 if secondary else 1))
            value_key(gain.inputs[1],HIT+dt,alpha*(.65 if secondary else 1))
        return mat

    # The game expands a compressed core into an irregular, luminous cloud in ~0.3s.
    # A real displaced 3D shell keeps that silhouette while preserving plasma detail.
    for layer in range(2):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4,radius=1)
        obj=move_to(bpy.context.object,BURST)
        obj.name='Thunder detonation / '+('hot inner cloud' if not layer else 'fractured outer shell')
        for v in obj.data.vertices:
            p=v.co.normalized();x,y,z=p
            noise=.10*math.sin(x*7+y*4+layer)+.065*math.sin(y*13-z*9)+.025*math.sin(z*31+x*19)
            v.co=p*(1+noise)
        for face in obj.data.polygons:face.use_smooth=True
        obj.data.materials.append(blast_material(obj.name,bool(layer)))
        obj.location=(0,0,.26)
        times=[(0,.24),(.045,1.15),(.12,2.55),(.24,3.25),(.43,3.62),(.65,3.85)]
        for age,radius in times:
            radius*=1.08 if layer else 1
            scale_key(obj,HIT+age,(radius,radius,radius*(.78 if layer else .90)))
            obj.location.z=.15+age*.58
            obj.keyframe_insert(data_path='location',frame=(HIT+age)*FPS+1)
        obj.hide_render=True;obj.keyframe_insert(data_path='hide_render',frame=1)
        obj.hide_render=False;obj.keyframe_insert(data_path='hide_render',frame=HIT*FPS+1)
        obj.hide_render=True;obj.keyframe_insert(data_path='hide_render',frame=(HIT+.67)*FPS+1)

    # Filament lace carried by the expanding blast volume: unequal open arcs, no solid bubble outline.
    for k in range(52):
        rng=random.Random(22000+k)
        a=rng.uniform(0,math.tau)
        latitude=rng.uniform(.06,1.25)
        sweep=rng.uniform(.28,.95)*rng.choice([-1,1])
        pts=[]
        for j in range(22):
            u=j/21
            az=a+sweep*u
            el=latitude+math.sin(u*5+k)*.12+rng.uniform(-.05,.05)
            r=1+.08*math.sin(az*7)+rng.uniform(-.025,.025)
            pts.append(Vector((math.cos(az)*math.cos(el)*r,math.sin(az)*math.cos(el)*r,max(.02,math.sin(el))*r)))
        obj=curve('Blast lace %02d'%k,pts,.007 if k%3 else .012,CORE if k%3==0 else GOLD,BURST)
        start=HIT+rng.uniform(.015,.08);end=HIT+rng.uniform(.36,.56)
        life(obj,start,end,attack=.018,release=.18)
        for age,r in [(0,.35),(.045,1.16),(.12,2.6),(.24,3.3),(.43,3.7),(.6,3.9)]:
            scale_key(obj,HIT+age,(r,r,r*.82))

    # A brief high-current strike along the actual shaft meets the crater at the same instant.
    p,axis=ns['pose'](HIT)
    for k in range(6):
        rng=random.Random(22800+k)
        start=HIT+rng.uniform(0,.065)
        origin=axis*(4.9+rng.random())
        pts=jagged(origin,Vector((0,0,.04)),22800+k,.16,33)
        lightning('Contact return stroke %d'%k,pts,.027 if k==0 else .011,BURST,start,start+.13,outer=k<2)

    # The outer wave is a broad collection of wandering disconnected filaments.
    # Each arc sector advances on its own radius / delay, preserving an irregular annular impression.
    for wave_i,delay in enumerate([.025,.80,1.65,2.55,3.55]):
        for sector in range(31):
            rng=random.Random(25000+wave_i*100+sector)
            if rng.random()<.16:continue
            angle=sector*math.tau/31+rng.uniform(-.07,.07)
            start=HIT+delay+rng.uniform(0,.07)
            duration=rng.uniform(.64,.84)
            reach=rng.uniform(5.5,6.6)
            pivot=bpy.data.objects.new('Detached front %d.%02d'%(wave_i,sector),None)
            WAVE.objects.link(pivot)
            for j in range(15):
                u=j/14
                radius=.40+(reach-.40)*(1-(1-u)**1.58)
                scale_key(pivot,start+duration*u,(radius,radius,1))
                pivot.rotation_euler.z=math.sin(u*3+sector)*.055
                pivot.keyframe_insert(data_path='rotation_euler',frame=(start+duration*u)*FPS+1)
            for strand in range(4):
                sweep=rng.uniform(.09,.22)
                a=angle+rng.uniform(-.06,.06)
                radial_offset=(strand-1.5)*.038+rng.uniform(-.022,.022)
                pts=[]
                for j in range(24):
                    u=j/23
                    theta=a+sweep*u
                    r=.97+radial_offset+.075*math.sin(theta*4+wave_i)+.045*math.sin(theta*11+sector)
                    r+=rng.uniform(-.014,.014)+.022*math.sin(u*17+strand)
                    pts.append(Vector((math.cos(theta)*r,math.sin(theta)*r,.045+math.sin(u*math.pi)*rng.uniform(.02,.13))))
                obj=curve('Wandering outward front %d.%02d.%d'%(wave_i,sector,strand),pts,.004 if strand==0 else .0023,CORE if strand==0 else GOLD,WAVE)
                obj.parent=pivot
                life(obj,start+strand*.012,start+duration,attack=.035,release=.23)
                # Gaps progress along each filament as it detaches and travels outward.
                for u,v in [(0,0),(.20,0),(.90,.58),(1,.9)]:
                    obj.data.bevel_factor_start=v
                    obj.data.keyframe_insert(data_path='bevel_factor_start',frame=(start+u*duration)*FPS+1)

    # Lifted, irregular soil on the near side visibly grips and overlaps the buried tip.
    # This is the 3D counterpart of swordSoilLip used by the game's lance renderer.
    verts=[Vector((0,0,.008))]
    for k in range(25):
        a=k*math.tau/24
        r=.60*(1+.13*math.sin(k*3.1))
        verts.append(Vector((math.cos(a)*r,math.sin(a)*r,.011)))
    dark=ns['emission']('Contact cavity / dark earth',(.009,.007,.004),1)
    hole=mesh('Ground purchase / contact cavity',verts,[(0,k+1,k+2) for k in range(24)],dark,GROUND)
    life(hole,HIT,HIT+6.12,attack=.045,release=.8)
    for k in range(17):
        rng=random.Random(27000+k)
        a=k*math.tau/17+rng.uniform(-.11,.11)
        direction=Vector((math.cos(a),math.sin(a),0))
        side=Vector((-math.sin(a),math.cos(a),0))
        r=rng.uniform(.42,.67);w=rng.uniform(.11,.24);h=rng.uniform(.08,.23)
        center=direction*r
        points=[center-side*w,center+side*w,center+direction*.28+side*w*.6,
                center+direction*.31-side*w*.7,center+Z*h-direction*.045]
        obj=mesh('Raised soil crest %02d'%k,points,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],stone,GROUND)
        life(obj,HIT+.01,7.75,attack=.055,release=.8)

    ns['scene']['Impact revision']='Deeper axial insertion, compressed thunder cloud, 26 leaders per pulse, 420 ground discharges, torn migrating filament envelope'
