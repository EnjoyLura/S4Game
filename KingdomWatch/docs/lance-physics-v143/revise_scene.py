"""Replace opaque spear geometry with animated electrical filaments; widen contact blast.
Applied to the preserved v2 Blender file in memory. The source study is never overwritten.
"""
import bpy,math,random
from mathutils import Vector

def revise():
    body=bpy.data.collections['01 | crystalline thunder lance']
    root=bpy.data.objects['LANCE | tip anchor / all body motion']
    for obj in list(body.objects):
        if obj!=root:bpy.data.objects.remove(obj,do_unlink=True)
    core=bpy.data.materials['Ivory plasma / restricted hot core']
    gold=bpy.data.materials['Gold corona']
    # Every point changes position. No metal, filled blade faces, static spine or opaque tip.
    for k in range(32):
        rng=random.Random(143000+k)
        primary=k<12
        start=-.1 if primary else rng.uniform(.2,1.7)
        end=5.25 if k<4 else rng.uniform(3.6,5.2)
        curve=bpy.data.curves.new('Living current %02d'%k,'CURVE')
        curve.dimensions='3D';curve.bevel_depth=.012 if k<3 else .0065 if primary else .004
        curve.bevel_resolution=2;curve.resolution_u=1
        spline=curve.splines.new('POLY');spline.points.add(63)
        obj=bpy.data.objects.new(curve.name,curve);body.objects.link(obj);obj.parent=root
        curve.materials.append(core if k<7 else gold)
        phase=rng.uniform(0,math.tau);freq=rng.uniform(7,15)
        offset=rng.uniform(.018,.115)
        for frame in range(49):
            t=frame/24;theta=t*math.pi
            for j,point in enumerate(spline.points):
                u=j/63;z=start+(end-start)*u
                envelope=math.sin(math.pi*u)**.62
                # Counter-travelling kinks and knots; no regular helix or rigid luminous slab.
                x=(offset*math.sin(z*freq+phase-theta*3)+.045*math.sin(z*19+theta*5+k))*envelope
                y=(offset*math.cos(z*(freq*.79)+phase+theta*2)+.035*math.sin(z*27-theta*4+k))*envelope
                z+=.024*math.sin(u*39-theta*4+k)*envelope
                point.co=(x,y,z,1)
                point.radius=(.07+.93*envelope)*(.55+.45*(.5+.5*math.sin(z*11-theta*6+phase))**2)
                point.keyframe_insert('co',frame=13+frame)
                point.keyframe_insert('radius',frame=13+frame)
        action=curve.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        fc.modifiers.new('CYCLES')
                        for key in fc.keyframe_points:key.interpolation='LINEAR'
    # All burst geometry shares a parent, so its animated radii and branching stay coherent.
    burst=bpy.data.collections['03 | contact detonation']
    expansion=bpy.data.objects.new('Blast footprint / 2.15x lateral expansion',None)
    burst.objects.link(expansion)
    for obj in list(burst.objects):
        if obj!=expansion and obj.parent is None:obj.parent=expansion
    expansion.scale=(2.15,2.15,1.35)
    bpy.context.scene['v143 revision']='32 fully animated lightning core filaments, no solid spear meshes; 2.15x lateral thunder detonation'
