"""Five Peaks Heavenfall - jade sword ultimate cinematic study.

Blender 5.2, entirely procedural. Renders a 10 s 24 fps sequence; every beat is
baked into editable keyframes. Not integrated into the game.

Run:
  blender.exe -b --python build_scene.py -- --all
  blender.exe -b --python build_scene.py -- --still 56,149
"""
from __future__ import annotations
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Quaternion, Vector

OUT = Path(__file__).resolve().parent
FRAMES = OUT / 'frames'
FPS = 24
END = 240
ARENA_Z = 0.10
JADE = (0.30, 1.00, 0.62)
JADE_PALE = (0.72, 1.00, 0.86)
GOLD = (1.00, 0.66, 0.22)
IMPACTS = [
    # time, position, power, lean axis, final
    (56, (-6.0, 0.0), 1.00, 'left', False),
    (68, (0.0, 5.8), 1.00, 'back', False),
    (80, (6.0, 0.0), 1.00, 'right', False),
    (92, (0.0, -5.8), 1.00, 'front', False),
]
FINAL = 149
FINAL_POS = (0.0, 0.0)

parser = argparse.ArgumentParser()
parser.add_argument('--all', action='store_true')
parser.add_argument('--still', default='')
parser.add_argument('--size', type=int, default=1280)
parser.add_argument('--samples', type=int, default=48)
parser.add_argument('--percent', type=int, default=100)
parser.add_argument('--nosave', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

random.seed(14159)

# ----------------------------------------------------------------------------
# scene reset
# ----------------------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.materials, bpy.data.meshes, bpy.data.curves):
    for block in list(datablocks):
        datablocks.remove(block)
for coll in list(bpy.data.collections):
    bpy.data.collections.remove(coll)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = args.size
scene.render.resolution_y = round(args.size * 9 / 16)
scene.render.resolution_percentage = args.percent
scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = END
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.38
scene.eevee.taa_render_samples = args.samples
scene.eevee.volumetric_tile_size = '4'
scene.eevee.volumetric_samples = 64
scene.eevee.use_volume_custom_range = True
scene.eevee.volumetric_start = 1.0
scene.eevee.volumetric_end = 90.0
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.0
try:
    scene.eevee.use_raytracing = True
except AttributeError:
    pass

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def coll(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

C_ENV = coll('00 environment')
C_SEAL = coll('01 seal and arena')
C_SWORD = coll('02 five giant swords')
C_SWARM = coll('03 sword intent swarm')
C_AIR = coll('04 air ribbons and beam')
C_IMPACT = coll('05 impacts')
C_DUST = coll('06 dust and debris')
C_CAM = coll('07 camera and lights')


def move_to(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def link(obj, collection):
    collection.objects.link(obj)
    return obj


def mesh(name, verts, faces, mat, collection, smooth=False, colors=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if smooth:
        me.shade_smooth()
    if colors is not None:
        attr = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
        for i, c in enumerate(colors):
            attr.data[i].color = c
    if mat is not None:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def curve(name, pts, radius, mat, collection, taper=True, res=2):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 1
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, xyz in enumerate(pts):
        p = sp.points[i]
        p.co = (*xyz, 1)
        p.radius = (0.08 + 0.92 * math.sin(math.pi * i / max(1, len(pts) - 1)) ** .45) if taper else 1.0
    cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    collection.objects.link(ob)
    return ob


def curve_multi(name, splines, radius, mat, collection):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 1
    cu.bevel_depth = radius
    cu.bevel_resolution = 1
    for pts in splines:
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for i, xyz in enumerate(pts):
            sp.points[i].co = (*xyz, 1)
    cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu)
    collection.objects.link(ob)
    return ob


def emission(name, color, power, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = m.node_tree.nodes
    nd.clear()
    out = nd.new('ShaderNodeOutputMaterial')
    em = nd.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = power
    if alpha >= 1:
        m.node_tree.links.new(em.outputs[0], out.inputs['Surface'])
    else:
        tr = nd.new('ShaderNodeBsdfTransparent')
        mix = nd.new('ShaderNodeMixShader')
        mix.inputs[0].default_value = alpha
        m.node_tree.links.new(tr.outputs[0], mix.inputs[1])
        m.node_tree.links.new(em.outputs[0], mix.inputs[2])
        m.node_tree.links.new(mix.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'DITHERED'
    m.diffuse_color = (*color, 1)
    return m


def principled(name, color, metallic, roughness, emission_color=None, emission_power=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    if emission_color:
        bs.inputs['Emission Color'].default_value = (*emission_color, 1)
        bs.inputs['Emission Strength'].default_value = emission_power
    return m


def key_value(node_input, frame, value):
    node_input.default_value = value
    node_input.keyframe_insert('default_value', frame=frame)


def key_loc(ob, frame, loc):
    ob.location = loc
    ob.keyframe_insert('location', frame=frame)


def key_rot(ob, frame, rot):
    ob.rotation_euler = rot
    ob.keyframe_insert('rotation_euler', frame=frame)


def key_scale(ob, frame, scale):
    ob.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    ob.keyframe_insert('scale', frame=frame)


def life(ob, start, end, peak=1.0, attack=0.03, release=0.10):
    t0 = max(0.0, start - .01)
    keys = [(0, 0), (t0, 0), (start + attack, 1), (max(start + attack, end - release), 1), (end, 0)]
    if ob.type == 'CURVE' and isinstance(peak, (int, float)):
        base = ob.data.bevel_depth
        for t, v in keys:
            ob.data.bevel_depth = base * v * peak
            ob.data.keyframe_insert('bevel_depth', frame=t * FPS + 1)
    else:
        for t, v in keys:
            key_scale(ob, t * FPS + 1, tuple(s * v for s in peak) if isinstance(peak, tuple) else peak * v)
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=0)
    ob.hide_render = False
    ob.keyframe_insert('hide_render', frame=start * FPS + 1)
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=end * FPS + 1)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ease_in(t, p=2.6):
    return max(0.0, min(1.0, t)) ** p


def lerp(a, b, t):
    return a + (b - a) * t


def vlerp(a, b, t):
    return Vector(a) + (Vector(b) - Vector(a)) * t


def look_quat(eye, target):
    return (Vector(target) - Vector(eye)).to_track_quat('-Z', 'Y')


# ----------------------------------------------------------------------------
# world, sky, mountains
# ----------------------------------------------------------------------------
world = bpy.data.worlds.new('Night arena')
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes
wn.clear()
wout = wn.new('ShaderNodeOutputWorld')
wbg = wn.new('ShaderNodeBackground')
wgrad = wn.new('ShaderNodeTexGradient')
wmap = wn.new('ShaderNodeMapping')
wtex = wn.new('ShaderNodeTexCoord')
wsep = wn.new('ShaderNodeSeparateXYZ')
wramp = wn.new('ShaderNodeValToRGB')
wramp.color_ramp.elements[0].position = 0.20
wramp.color_ramp.elements[0].color = (0.002, 0.005, 0.007, 1)
wramp.color_ramp.elements[1].position = 0.62
wramp.color_ramp.elements[1].color = (0.012, 0.026, 0.034, 1)
wmap.inputs['Rotation'].default_value = (math.radians(90), 0, 0)
world.node_tree.links.new(wtex.outputs['Generated'], wmap.inputs['Vector'])
world.node_tree.links.new(wmap.outputs[0], wgrad.inputs['Vector'])
world.node_tree.links.new(wgrad.outputs['Fac'], wramp.inputs['Fac'])
world.node_tree.links.new(wramp.outputs['Color'], wbg.inputs['Color'])
wbg.inputs['Strength'].default_value = 0.55
world.node_tree.links.new(wbg.outputs[0], wout.inputs['Surface'])

# the sky stays clean: no moon disc competing with the jade swords

# mountain silhouettes in three fog layers
ridge_mat = principled('Distant ridge', (0.008, 0.018, 0.022), 0.0, 0.95,
                       (0.02, 0.06, 0.055), 0.025)
for layer, (dist, height, shade) in enumerate([(62, 8, 1.0), (82, 12, 0.7), (104, 18, 0.45)]):
    rng = random.Random(700 + layer)
    pts = []
    x = -95.0
    while x <= 95.0:
        pts.append((x, dist + rng.uniform(-2, 2), rng.uniform(0.5, 1.0) * height))
        x += 7.5
    verts = [(px, py, -2) for px, py, _ in pts] + [(px, py, pz) for px, py, pz in pts]
    n = len(pts)
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    ob = mesh(f'Ridge {layer}', verts, faces, ridge_mat, C_ENV)
    ob.color = (0, 0, 0, 1)

# arena stone dais
stone_mat = principled('Arena slate', (0.030, 0.037, 0.034), 0.15, 0.64)
stone_bs = stone_mat.node_tree.nodes['Principled BSDF']
stex = stone_mat.node_tree.nodes.new('ShaderNodeTexNoise')
stex.inputs['Scale'].default_value = 7.5
stex.inputs['Detail'].default_value = 8
sbump = stone_mat.node_tree.nodes.new('ShaderNodeBump')
sbump.inputs['Strength'].default_value = 0.16
stone_mat.node_tree.links.new(stex.outputs['Fac'], sbump.inputs['Height'])
stone_mat.node_tree.links.new(sbump.outputs['Normal'], stone_bs.inputs['Normal'])
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=10.6, depth=0.18, location=(0, 0, ARENA_Z - 0.09))
dais = move_to(bpy.context.object, C_SEAL)
dais.name = 'Arena stone dais'
dais.data.materials.append(stone_mat)

soil_mat = principled('Battle soil', (0.022, 0.026, 0.021), 0.0, 0.86)
soil_bs = soil_mat.node_tree.nodes['Principled BSDF']
tex = soil_mat.node_tree.nodes.new('ShaderNodeTexNoise')
tex.inputs['Scale'].default_value = 3.2
tex.inputs['Detail'].default_value = 9
tex.inputs['Roughness'].default_value = 0.7
bump = soil_mat.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.42
soil_mat.node_tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
soil_mat.node_tree.links.new(bump.outputs['Normal'], soil_bs.inputs['Normal'])
# scattered darker patches
patch = soil_mat.node_tree.nodes.new('ShaderNodeTexVoronoi')
patch.inputs['Scale'].default_value = 1.6
ramp = soil_mat.node_tree.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = .36
ramp.color_ramp.elements[0].color = (0.018, 0.021, 0.017, 1)
ramp.color_ramp.elements[1].position = .62
ramp.color_ramp.elements[1].color = (0.035, 0.038, 0.030, 1)
soil_mat.node_tree.links.new(patch.outputs['Distance'], ramp.inputs['Fac'])
soil_mat.node_tree.links.new(ramp.outputs['Color'], soil_bs.inputs['Base Color'])
bpy.ops.mesh.primitive_plane_add(size=240, location=(0, 0, -0.005))
ground = move_to(bpy.context.object, C_ENV)
ground.name = 'Battlefield soil'
ground.data.materials.append(soil_mat)

# broken pillars framing the far edge
pillar_mat = principled('Broken pillar', (0.045, 0.052, 0.046), 0.05, 0.8)
for i, (x, y, h, w) in enumerate([(-8.5, 7.5, 5.2, 0.7), (9.2, 6.0, 3.6, 0.55), (-12.0, -2.0, 2.4, 0.75)]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, h / 2 - 0.1))
    ob = move_to(bpy.context.object, C_ENV)
    ob.name = f'Broken pillar {i}'
    ob.scale = (w, w, h)
    ob.rotation_euler = (random.uniform(-.05, .05), random.uniform(-.08, .08), random.uniform(0, .4))
    ob.data.materials.append(pillar_mat)

# low scattered rubble at the arena rim (kept away from the camera path)
rock_rim = principled('Rim rubble', (0.035, 0.042, 0.036), 0.0, 0.88)
for i, (x, y, s) in enumerate([(-11.6, 4.0, .55), (12.2, 2.8, .4), (-5.5, 11.8, .5)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=s, location=(x, y, s * .35))
    ob = move_to(bpy.context.object, C_ENV)
    ob.name = f'Rim rubble {i}'
    ob.scale = (1.3, .9, .6)
    ob.rotation_euler = (0, 0, random.uniform(0, 3))
    ob.data.materials.append(rock_rim)

# ----------------------------------------------------------------------------
# ground seal
# ----------------------------------------------------------------------------
seal_mat = emission('Seal jade lines', (0.10, 1.0, 0.50), 0.0)
seal_mat.node_tree.nodes['Emission'].inputs['Strength'].default_value = 0.0
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 1, 0.0)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 14, 0.0)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 27, 0.9)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 92, 1.2)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 120, 1.4)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 148, 1.6)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 152, 1.5)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 190, 0.7)
key_value(seal_mat.node_tree.nodes['Emission'].inputs['Strength'], 228, 0.0)
seal_soft = emission('Seal secondary', (0.06, 0.55, 0.36), 0.0)
key_value(seal_soft.node_tree.nodes['Emission'].inputs['Strength'], 1, 0.0)
key_value(seal_soft.node_tree.nodes['Emission'].inputs['Strength'], 22, 0.5)
key_value(seal_soft.node_tree.nodes['Emission'].inputs['Strength'], 145, 1.4)
key_value(seal_soft.node_tree.nodes['Emission'].inputs['Strength'], 200, 0.4)
key_value(seal_soft.node_tree.nodes['Emission'].inputs['Strength'], 228, 0.0)


def ring_mesh(name, r0, r1, z, mat, seg=128, jitter=0.0, seed=1):
    rng = random.Random(seed)
    verts, faces = [], []
    for i in range(seg):
        a = i / seg * math.tau
        j = rng.uniform(-jitter, jitter)
        verts.append((math.cos(a) * (r0 + j), math.sin(a) * (r0 + j), z))
        verts.append((math.cos(a) * (r1 + j), math.sin(a) * (r1 + j), z))
    for i in range(seg):
        n = (i + 1) % seg
        faces.append((i * 2, n * 2, n * 2 + 1, i * 2 + 1))
    return mesh(name, verts, faces, mat, C_SEAL)


ring_mesh('Seal outer ring', 9.35, 9.47, ARENA_Z + .015, seal_mat, jitter=.03, seed=3)
ring_mesh('Seal middle ring', 7.55, 7.63, ARENA_Z + .015, seal_mat, jitter=.02, seed=4)
ring_mesh('Seal inner ring', 5.45, 5.51, ARENA_Z + .015, seal_soft, jitter=.02, seed=5)
ring_mesh('Seal fifth ring', 2.55, 2.60, ARENA_Z + .016, seal_soft)

# dashed ticks
tick_objs = []
for i in range(36):
    a = i / 36 * math.tau + .02
    if i % 3 == 0:
        continue
    x0, y0 = math.cos(a) * 8.05, math.sin(a) * 8.05
    x1, y1 = math.cos(a) * 8.55, math.sin(a) * 8.55
    tick_objs.append([(x0, y0, ARENA_Z + .02), (x1, y1, ARENA_Z + .02)])
curve_multi('Seal radial ticks', tick_objs, .018, seal_mat, C_SEAL)

# angular seal-script glyphs around the outer ring
glyphs = []
patterns = [
    [((-.16, -.30), (-.02, .28)), ((-.10, -.05), (.16, -.05)), ((.0, .28), (.14, .10))],
    [((-.14, .30), (-.14, -.10)), ((-.14, .12), (.12, .12)), ((.12, .12), (.12, -.28))],
    [((-.18, -.28), (.16, -.28)), ((.0, -.28), (.0, .30)), ((-.10, .02), (.14, .24))],
    [((-.16, .24), (.04, .30)), ((.04, .30), (.04, -.30)), ((-.12, -.02), (.16, -.02))],
    [((-.15, -.30), (-.15, .28)), ((-.15, .28), (.15, .10)), ((.15, .10), (-.05, -.30))],
    [((-.16, .28), (.16, .28)), ((-.16, -.28), (.16, -.28)), ((.0, .28), (.0, -.28))],
]
for i in range(12):
    a = i / 12 * math.tau + math.pi / 12
    cx, cy = math.cos(a) * 8.25, math.sin(a) * 8.25
    rot = a + math.pi / 2
    ca, sa = math.cos(rot), math.sin(rot)
    for pat in patterns[i % len(patterns)]:
        pts = []
        for (gx, gy) in pat:
            pts.append((cx + gx * ca - gy * sa, cy + gx * sa + gy * ca, ARENA_Z + .022))
        glyphs.append(pts)
curve_multi('Seal glyphs', glyphs, .030, seal_mat, C_SEAL)

# five-peak emblem in the centre
peak_verts, peak_faces, peak_cols = [], [], []
for k in range(5):
    a = k / 5 * math.tau - math.pi / 2
    a2 = (k + 1) / 5 * math.tau - math.pi / 2
    am = (a + a2) / 2
    base = len(peak_verts)
    peak_verts += [
        (math.cos(a) * .55, math.sin(a) * .55, ARENA_Z + .025),
        (math.cos(am) * 2.05, math.sin(am) * 2.05, ARENA_Z + .025),
        (math.cos(a2) * .55, math.sin(a2) * .55, ARENA_Z + .025),
    ]
    peak_faces.append((base, base + 1, base + 2))
peaks = mesh('Five peak emblem', peak_verts, peak_faces, seal_mat, C_SEAL)
peak_line = curve('Five peak outline', [(math.cos(k / 5 * math.tau - math.pi / 2) * 2.05,
                                        math.sin(k / 5 * math.tau - math.pi / 2) * 2.05,
                                        ARENA_Z + .03) for k in range(6)], .035, seal_mat, C_SEAL)

# ----------------------------------------------------------------------------
# energy ribbon material helper
# ----------------------------------------------------------------------------
def ribbon_material(name, color, power, alpha=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = m.node_tree.nodes
    nd.clear()
    ln = m.node_tree.links
    out = nd.new('ShaderNodeOutputMaterial')
    em = nd.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = power
    tr = nd.new('ShaderNodeBsdfTransparent')
    mix = nd.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = alpha
    ln.new(tr.outputs[0], mix.inputs[1])
    ln.new(em.outputs[0], mix.inputs[2])
    ln.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    return m


def vcol_flat_glow(name, color, power):
    """Vertex-alpha emission without fresnel; correct for flat ground rings."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = m.node_tree.nodes
    nd.clear()
    ln = m.node_tree.links
    out = nd.new('ShaderNodeOutputMaterial')
    em = nd.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = power
    tr = nd.new('ShaderNodeBsdfTransparent')
    mix = nd.new('ShaderNodeMixShader')
    vc = nd.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    ln.new(vc.outputs['Alpha'], mix.inputs[0])
    ln.new(tr.outputs[0], mix.inputs[1])
    ln.new(em.outputs[0], mix.inputs[2])
    ln.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    return m


def vcol_fade_glow(name, color, power):
    """Vertex-alpha emission with a keyable global fade."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = m.node_tree.nodes
    nd.clear()
    ln = m.node_tree.links
    out = nd.new('ShaderNodeOutputMaterial')
    em = nd.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = power
    tr = nd.new('ShaderNodeBsdfTransparent')
    mix = nd.new('ShaderNodeMixShader')
    vc = nd.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    fade = nd.new('ShaderNodeValue')
    fade.name = 'Fade'
    fade.outputs[0].default_value = 1.0
    mul = nd.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    ln.new(vc.outputs['Alpha'], mul.inputs[0])
    ln.new(fade.outputs[0], mul.inputs[1])
    ln.new(mul.outputs[0], mix.inputs[0])
    ln.new(tr.outputs[0], mix.inputs[1])
    ln.new(em.outputs[0], mix.inputs[2])
    ln.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    return m, fade


def vcol_glow(name, color, power):
    """Emission whose opacity is driven by the mesh colour attribute alpha."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = m.node_tree.nodes
    nd.clear()
    ln = m.node_tree.links
    out = nd.new('ShaderNodeOutputMaterial')
    em = nd.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = power
    tr = nd.new('ShaderNodeBsdfTransparent')
    mix = nd.new('ShaderNodeMixShader')
    vc = nd.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    lw = nd.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = .5
    inv = nd.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    ln.new(lw.outputs['Facing'], inv.inputs[1])
    mul = nd.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    ln.new(vc.outputs['Alpha'], mul.inputs[0])
    ln.new(inv.outputs[0], mul.inputs[1])
    ln.new(mul.outputs[0], mix.inputs[0])
    ln.new(tr.outputs[0], mix.inputs[1])
    ln.new(em.outputs[0], mix.inputs[2])
    ln.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    return m


jade_ribbon = ribbon_material('Jade energy ribbon', (0.18, 1.0, 0.55), 2.6, .34)
jade_ribbon_soft = ribbon_material('Jade energy ribbon soft', (0.30, 1.0, 0.66), 1.25, .16)
gold_ribbon = ribbon_material('Gold spark ribbon', GOLD, 3.0, .5)

# ----------------------------------------------------------------------------
# sword builder
# ----------------------------------------------------------------------------
blade_mat = principled('Jade steel blade', (0.30, 0.44, 0.38), 0.92, 0.20,
                       (0.10, 0.52, 0.31), 0.18)
blade_bs = blade_mat.node_tree.nodes['Principled BSDF']
try:
    blade_bs.inputs['Coat Weight'].default_value = 0.35
    blade_bs.inputs['Coat Roughness'].default_value = 0.12
except KeyError:
    pass
lw = blade_mat.node_tree.nodes.new('ShaderNodeLayerWeight')
lw.inputs['Blend'].default_value = .32
ramp2 = blade_mat.node_tree.nodes.new('ShaderNodeValToRGB')
ramp2.color_ramp.elements[0].position = .55
ramp2.color_ramp.elements[0].color = (0.01, 0.05, 0.03, 1)
ramp2.color_ramp.elements[1].position = .97
ramp2.color_ramp.elements[1].color = (0.14, 0.60, 0.36, 1)
blade_mat.node_tree.links.new(lw.outputs['Facing'], ramp2.inputs['Fac'])
blade_mat.node_tree.links.new(ramp2.outputs['Color'], blade_bs.inputs['Emission Color'])
blade_bs.inputs['Emission Strength'].default_value = 0.35
bump_tex = blade_mat.node_tree.nodes.new('ShaderNodeTexNoise')
bump_tex.inputs['Scale'].default_value = 14.0
bump_tex.inputs['Detail'].default_value = 3.0
blade_bump = blade_mat.node_tree.nodes.new('ShaderNodeBump')
blade_bump.inputs['Strength'].default_value = 0.025
blade_mat.node_tree.links.new(bump_tex.outputs['Fac'], blade_bump.inputs['Height'])
blade_mat.node_tree.links.new(blade_bump.outputs['Normal'], blade_bs.inputs['Normal'])
gold_mat = principled('Sword gold', (0.58, 0.36, 0.09), 1.0, 0.30,
                      (0.50, 0.26, 0.05), 0.06)
grip_mat = principled('Wrapped grip', (0.012, 0.030, 0.024), 0.10, 0.64)
gem_mat = emission('Jade gem', (0.10, 1.0, 0.50), 3.2)
blade_core = emission('Blade jade core', (0.40, 1.0, 0.66), 1.0)
blade_edge = emission('Blade edge glow', (0.12, 1.0, 0.48), 1.6)
rune_mat = emission('Blade gold runes', (1.0, .72, .30), 0.6)


def diamond(name, sx, sy, sz, mat, collection):
    verts = [(sx, 0, 0), (0, sy, 0), (-sx, 0, 0), (0, -sy, 0), (0, 0, sz), (0, 0, -sz)]
    faces = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)]
    return mesh(name, verts, faces, mat, collection)


def build_sword(name, scale=1.0, collection=C_SWORD, aura=True, detail=True):
    root = bpy.data.objects.new(name, None)
    root.empty_display_size = .5
    collection.objects.link(root)
    root.scale = (scale, scale, scale)

    zs = [0.0, .22, .55, 1.2, 2.2, 3.4, 4.8, 6.0, 6.9, 7.35]
    wf = [.0, .11, .24, .37, .49, .55, .53, .47, .40, .33]
    tf = [.0, .014, .028, .046, .060, .066, .062, .054, .048, .042]
    verts = []
    for z, w, th in zip(zs, wf, tf):
        verts += [
            (w, 0, z), (w * .58, th, z), (0, th * 1.25, z), (-w * .58, th, z),
            (-w, 0, z), (-w * .58, -th, z), (0, -th * 1.25, z), (w * .58, -th, z),
        ]
    faces = []
    for i in range(len(zs) - 1):
        for j in range(8):
            a = i * 8 + j
            b = i * 8 + (j + 1) % 8
            c = (i + 1) * 8 + (j + 1) % 8
            d = (i + 1) * 8 + j
            faces.append((a, b, c, d))
    faces.append(tuple(range(7, -1, -1)))
    faces.append(tuple(range((len(zs) - 1) * 8, len(zs) * 8)))
    blade = mesh(name + ' / blade', verts, faces, blade_mat, collection)
    blade.parent = root

    # jade core strip on both faces
    for side in (1, -1):
        cv, cf = [], []
        for z in [0.65, 1.4, 2.4, 3.6, 4.8, 5.9, 6.9]:
            w = .013 + .005 * math.sin(z * 2.1)
            cv += [(-w, side * .086, z), (w, side * .086, z)]
        for i in range(len(cv) // 2 - 1):
            cf.append((i * 2, i * 2 + 2, i * 2 + 3, i * 2 + 1))
        strip = mesh(f'{name} / core {side}', cv, cf, blade_core, collection)
        strip.parent = root

    # glowing cutting edges
    for side in (1, -1):
        pts = []
        for z, w in zip(zs[2:], wf[2:]):
            pts.append((side * (w + .006), 0, z))
        e = curve(f'{name} / edge {side}', pts, .012, blade_edge, collection, taper=True)
        e.parent = root

    # gold habaki band at the blade root
    hv, hf = [], []
    for z, w, th in [(7.18, .345, .046), (7.34, .335, .045), (7.44, .300, .041)]:
        hv += [(-w, -.060, z), (w, -.060, z), (w, .060, z), (-w, .060, z)]
    for i in range(2):
        a = i * 4
        for j in range(4):
            hf.append((a + j, a + (j + 1) % 4, a + 4 + (j + 1) % 4, a + 4 + j))
    hf.append((0, 1, 2, 3))
    hf.append((11, 10, 9, 8))
    habaki = mesh(name + ' / habaki', hv, hf, gold_mat, collection)
    habaki.parent = root

    # curved gold guard bar with a jade heart
    sections = [(-1.02, .52), (-.62, .78), (-.26, 1.0), (0, .90), (.26, 1.0), (.62, .78), (1.02, .52)]
    gv, gf = [], []
    for x, s in sections:
        zc = 7.62 + .035 * math.cos(x / 1.02 * math.pi / 2)
        gv += [(x, -.055, zc - .062 * s), (x, .055, zc - .062 * s),
               (x, .055, zc + .062 * s), (x, -.055, zc + .062 * s)]
    for i in range(len(sections) - 1):
        a = i * 4
        for j in range(4):
            gf.append((a + j, a + (j + 1) % 4, a + 4 + (j + 1) % 4, a + 4 + j))
    gf.append((0, 1, 2, 3))
    last = (len(sections) - 1) * 4
    gf.append((last + 3, last + 2, last + 1, last))
    guard = mesh(name + ' / guard', gv, gf, gold_mat, collection)
    guard.parent = root
    for side in (1, -1):
        horn = curve(f'{name} / horn {side}', [
            (side * .98, 0, 7.64), (side * 1.18, 0, 7.72), (side * 1.30, 0, 7.92),
            (side * 1.33, 0, 8.10),
        ], .048, gold_mat, collection, taper=True)
        horn.parent = root
    # gold ridge line on the guard face
    gr = curve(name + ' / guard ridge', [(-.92, -.060, 7.66), (-.36, -.060, 7.72),
                                         (0, -.060, 7.66), (.36, -.060, 7.72),
                                         (.92, -.060, 7.66)], .014, gold_mat, collection, taper=False)
    gr.parent = root
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.205, depth=.11, location=(0, 0, 7.50))
    collar = move_to(bpy.context.object, collection)
    collar.name = name + ' / collar'
    collar.parent = root
    collar.data.materials.append(gold_mat)
    # jade heart, front and back
    for side in (1, -1):
        gem = diamond(f'{name} / guard gem {side}', .15, .10, .24, gem_mat, collection)
        gem.location = (0, side * .07, 7.70)
        gem.parent = root

    # grip, rings, pommel
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.10, depth=1.15, location=(0, 0, 8.06))
    grip = move_to(bpy.context.object, collection)
    grip.name = name + ' / grip'
    grip.parent = root
    grip.data.materials.append(grip_mat)
    for i in range(4):
        bpy.ops.mesh.primitive_torus_add(major_radius=.118, minor_radius=.018,
                                         location=(0, 0, 7.64 + i * .24))
        ring = move_to(bpy.context.object, collection)
        ring.name = f'{name} / grip ring {i}'
        ring.parent = root
        ring.data.materials.append(gold_mat)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=.165, location=(0, 0, 8.73))
    pommel = move_to(bpy.context.object, collection)
    pommel.name = name + ' / pommel'
    pommel.parent = root
    pommel.scale = (1.0, 1.0, .7)
    pommel.data.materials.append(gold_mat)
    pg = diamond(name + ' / pommel gem', .09, .09, .15, gem_mat, collection)
    pg.location = (0, 0, 8.90)
    pg.parent = root

    if detail:
        # restrained gold inlay near the blade root
        for side in (1, -1):
            pts = [(side * -.055, side * .075, 6.35), (side * .055, side * .075, 6.55),
                   (side * -.045, side * .075, 6.75), (side * .045, side * .075, 6.95)]
            r = curve(f'{name} / inlay {side}', pts, .009, rune_mat, collection, taper=False)
            r.parent = root

    auras = []
    trails = []
    if aura:
        for k in range(3):
            phase = k / 3 * math.tau
            pts = []
            for i in range(33):
                u = i / 32
                z = .6 + u * 8.2
                r = .52 + .18 * math.sin(u * math.pi)
                a = phase + u * math.tau * 1.55
                pts.append((math.cos(a) * r, math.sin(a) * r, z))
            a = curve(f'{name} / aura {k}', pts, .012, jade_ribbon, collection, taper=True)
            a.parent = root
            auras.append(a)
        # long fall wake above the hilt
        for k in range(3):
            off = (k - 1) * .22
            length = 15.0 if scale < .5 else 22.0
            pts = []
            for i in range(20):
                u = i / 19
                pts.append((off * (1 - u) + math.sin(u * 5 + k) * .18,
                            off * .5 * (1 - u),
                            8.9 + u * length))
            tr = curve(f'{name} / fall trail {k}', pts, .038 if scale >= .5 else .012,
                       jade_ribbon, collection, taper=True)
            tr.parent = root
            trails.append(tr)
    return {'root': root, 'auras': auras, 'trails': trails, 'blade': blade}


# four giant swords + final
giant = {}
for k, (t, pos, power, lean, final) in enumerate(IMPACTS):
    built = build_sword(f'Giant sword {k + 1}', 1.0, C_SWORD, aura=True, detail=True)
    giant[k] = built
final_sword = build_sword('Fifth heaven sword', 1.40, C_SWORD, aura=True, detail=True)

# ----------------------------------------------------------------------------
# fall / plant animation for the giant swords
# ----------------------------------------------------------------------------
LEAN_SIGN = {'left': -1, 'right': 1, 'back': -1, 'front': 1}


def sword_fall(index, built, impact_frame, pos, lean, begin):
    root = built['root']
    rng = random.Random(900 + index)
    x, y = pos
    outward = Vector((x, y, 0))
    if outward.length < .01:
        outward = Vector((0, -1, 0))
    outward.normalize()
    sign = LEAN_SIGN[lean]
    final_lean = math.radians(14.0) * sign
    start_lean = final_lean + math.radians(16.0) * sign
    hi = 23.0 + index * .8
    start = Vector((x + outward.x * 3.4, y + outward.y * 3.4, hi))
    target = Vector((x, y, ARENA_Z - .34))
    f0, f1 = begin, impact_frame
    axis = 'X' if lean in ('front', 'back') else 'Y'
    for f in range(f0, f1 + 1):
        u = (f - f0) / (f1 - f0)
        e = ease_in(u, 2.9)
        p = start.lerp(target, e)
        p.x += math.sin(u * math.pi) * outward.x * .45
        p.y += math.sin(u * math.pi) * outward.y * .45
        key_loc(root, f, p)
        lean_angle = lerp(start_lean, final_lean, smooth(min(1, u * 1.55)))
        if axis == 'Y':
            key_rot(root, f, (0, lean_angle, 0))
        else:
            key_rot(root, f, (lean_angle, 0, 0))
    # settle into the ground
    for f, drop in [(f1 + 1, -.50), (f1 + 4, -.22), (f1 + 8, -.30), (f1 + 14, -.28)]:
        p = Vector((x, y, ARENA_Z + drop))
        key_loc(root, f, p)
        lean_angle = final_lean
        key_rot(root, f, (lean_angle, 0, 0) if axis == 'X' else (0, lean_angle, 0))
    for f in range(f1 + 15, 202):
        p = Vector((x, y, ARENA_Z - .28))
        key_loc(root, f, p)
        key_rot(root, f, (final_lean, 0, 0) if axis == 'X' else (0, final_lean, 0))
    # aura and wake only while falling
    for a in built['auras']:
        life(a, (f0 - 1) / FPS, (f1 + 2) / FPS, attack=.01, release=.05)
    for tr in built.get('trails', []):
        life(tr, (f0 - 1) / FPS, (f1 + 3) / FPS, attack=.01, release=.04)


for k, (t, pos, power, lean, final) in enumerate(IMPACTS):
    sword_fall(k, giant[k], t, pos, lean, begin=t - [17, 15, 14, 13][k])

# final sword: materialises, hovers, plunges
fr = final_sword['root']
final_built = final_sword
for f in range(1, 110):
    key_scale(fr, f, 0)
key_scale(fr, 110, 1.50)
for f in range(1, 110):
    key_loc(fr, f, (0, 0, 30))
    key_rot(fr, f, (0, 0, 0))
for f in range(110, 135):
    u = (f - 110) / 24
    key_loc(fr, f, (0, 0, lerp(26, 8.4, smooth(u))))
    key_rot(fr, f, (0, 0, 0))
# hovering charge with a fine tremble
rng = random.Random(66)
for f in range(135, 142):
    t = (f - 135) / 7
    key_loc(fr, f, (math.sin(t * 31) * .035, math.cos(t * 27) * .03, 8.4 + math.sin(t * 44) * .05))
    key_rot(fr, f, (math.sin(t * 19) * .006, 0, math.sin(t * 23) * .01))
for f in range(142, FINAL + 1):
    u = (f - 142) / (FINAL - 142)
    key_loc(fr, f, (0, 0, lerp(8.4, ARENA_Z - .55, ease_in(u, 2.4))))
    key_rot(fr, f, (0, 0, 0))
for f, drop in [(FINAL + 1, -.85), (FINAL + 5, -.35), (FINAL + 10, -.48), (FINAL + 18, -.44)]:
    key_loc(fr, f, (0, 0, ARENA_Z + drop))
for f in range(FINAL + 19, 219):
    key_loc(fr, f, (0, 0, ARENA_Z - .44))
for a in final_sword['auras']:
    life(a, 110 / FPS, (FINAL + 4) / FPS, attack=.02, release=.06)
for tr in final_sword.get('trails', []):
    life(tr, 112 / FPS, (FINAL + 2) / FPS, attack=.01, release=.03)

# dismissal: the five swords sink back into the seal while the last light fades
for k, (t_i, pos, _, lean, _) in enumerate(IMPACTS):
    r = giant[k]['root']
    x, y = pos
    for f in range(206, END + 1):
        u = smooth((f - 206) / 32)
        key_loc(r, f, (x, y, lerp(ARENA_Z - .28, -9.5, u)))
for f in range(218, END + 1):
    u = smooth((f - 218) / 20)
    key_loc(fr, f, (0, 0, lerp(ARENA_Z - .44, -18.0, u)))

# ----------------------------------------------------------------------------
# impact effect builders
# ----------------------------------------------------------------------------
flash_white = emission('Impact flash core', (0.55, 1.0, 0.78), 2.2)
pillar_core_mat = vcol_glow('Pillar core', (0.55, 1.0, 0.78), 3.5)
pillar_outer_mat = vcol_glow('Pillar outer', (0.16, 0.78, 0.48), 1.2)
ring_mat_base = vcol_flat_glow('Shock ring', (0.30, 0.95, 0.55), 2.2)
ring_soft_mat = vcol_flat_glow('Shock ring soft', (0.12, 0.62, 0.40), 1.0)
rock_mat = principled('Broken earth', (0.045, 0.040, 0.030), 0.0, 0.9)
spark_jade = emission('Jade spark', (0.45, 1.0, 0.68), 3.0)
spark_gold = emission('Gold spark', (1.0, 0.62, 0.22), 3.0)
crack_jade = emission('Jade ground crack', (0.05, 1.0, 0.40), 1.5)


def make_ring(name, radius_band, mat, seg=96, seed=0):
    rng = random.Random(seed)
    verts, faces, cols = [], [], []
    bands = [(.94, 0), (.975, .40), (1.0, .85), (1.025, .40), (1.06, 0)]
    for i in range(seg):
        a = i / seg * math.tau
        wob = 1.0 + rng.uniform(-.02, .02)
        for rr, aa in bands:
            verts.append((math.cos(a) * radius_band * rr * wob,
                          math.sin(a) * radius_band * rr * wob, 0))
            cols.append((1, 1, 1, aa))
    n = len(bands)
    for i in range(seg):
        ni = (i + 1) % seg
        for j in range(n - 1):
            faces.append((i * n + j, ni * n + j, ni * n + j + 1, i * n + j + 1))
    return mesh(name, verts, faces, mat, C_IMPACT, colors=cols)


def make_pillar(name, radius, height, mat):
    seg = 40
    verts, faces, cols = [], [], []
    for i in range(seg):
        a = i / seg * math.tau
        verts += [(math.cos(a) * radius, math.sin(a) * radius, 0),
                  (math.cos(a) * radius, math.sin(a) * radius, height)]
        cols += [(1, 1, 1, 1), (1, 1, 1, 0)]
    for i in range(seg):
        ni = (i + 1) % seg
        faces.append((i * 2, ni * 2, ni * 2 + 1, i * 2 + 1))
    return mesh(name, verts, faces, mat, C_IMPACT, colors=cols)


def impact_burst(index, t_impact, pos, power=1.0, final=False):
    rng = random.Random(3300 + index)
    x, y = pos
    p = power
    scale = 1.45 if final else 1.0
    z = ARENA_Z + .02

    # flash core and point light
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(x, y, z + .55))
    flash = move_to(bpy.context.object, C_IMPACT)
    flash.name = f'Impact flash {index}'
    flash.data.materials.append(flash_white)
    for f, s in [(t_impact - 1, .0), (t_impact, .22 * scale), (t_impact + 2, .40 * scale),
                 (t_impact + 4, .52 * scale), (t_impact + 6, 0.0)]:
        key_scale(flash, f, (s, s, s * 1.8))
    flash.hide_render = True
    flash.keyframe_insert('hide_render', frame=0)
    flash.hide_render = False
    flash.keyframe_insert('hide_render', frame=t_impact)
    flash.hide_render = True
    flash.keyframe_insert('hide_render', frame=t_impact + 7)

    # light pillar, grows up and fades
    core = make_pillar(f'Light pillar core {index}', .16 * scale, 8.5 * scale, pillar_core_mat)
    outer = make_pillar(f'Light pillar outer {index}', .52 * scale, 10.5 * scale, pillar_outer_mat)
    for ob in (core, outer):
        ob.location = (x, y, z)
        ob.rotation_euler = (0, 0, rng.uniform(0, math.tau))
        life(ob, t_impact / FPS, (t_impact + (24 if final else 10)) / FPS, peak=(1, 1, 1),
             attack=.015, release=.22)
        for f, s in [(t_impact - 1, (0, 0, 0)), (t_impact + 1, (.5 * scale, .5 * scale, .25)),
                     (t_impact + 5, (1.0 * scale, 1.0 * scale, 1)), (t_impact + 20, (1.35 * scale, 1.35 * scale, 1))]:
            key_scale(ob, f, s)

    # shockwave rings
    for k in range(3 if final else 3):
        ring_color = (0.15, 1.0, 0.50) if k == 0 else (0.10, 0.70, 0.40)
        ring_power = 1.8 if k == 0 else 0.9
        rmat, rfade = vcol_fade_glow(f'Shock ring {index}.{k}', ring_color, ring_power)
        ring = make_ring(f'Shock ring {index}.{k}', 1.0, rmat, seed=index * 10 + k)
        ring.location = (x, y, z + .01 + k * .004)
        r0 = (0.6 if k == 0 else 1.2) * scale
        r1 = ((5.6 + k * 1.2) * scale * p) if not final else ((7.2 + k * 1.2) * scale)
        start = t_impact + k * 2
        end = start + (22 if final else 14)
        for f, s in [(start - 1, (r0, r0, 1)), (end, (r1, r1, 1))]:
            key_scale(ring, f, s)
        for f, v in [(start - 1, 0), (start + 2, 1), (end - 9, 1), (end, 0)]:
            rfade.outputs[0].default_value = v
            rfade.outputs[0].keyframe_insert('default_value', frame=f)
        ring.hide_render = True
        ring.keyframe_insert('hide_render', frame=0)
        ring.hide_render = False
        ring.keyframe_insert('hide_render', frame=start)
        ring.hide_render = True
        ring.keyframe_insert('hide_render', frame=end)

    # scorch decal
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=(2.2 if final else 1.35) * scale,
                                     fill_type='NGON', location=(x, y, z - .005))
    scorch = move_to(bpy.context.object, C_IMPACT)
    scorch.name = f'Scorch {index}'
    scorch.data.materials.append(principled('Scorch earth', (0.010, 0.012, 0.010), 0, .95))
    scorch.hide_render = True
    scorch.keyframe_insert('hide_render', frame=0)
    scorch.hide_render = False
    scorch.keyframe_insert('hide_render', frame=t_impact)

    # cracks
    for k in range(10 if final else 7):
        ang = rng.uniform(0, math.tau)
        length = (2.2 + rng.random() * 4.5) * (1.35 if final else 1.0)
        pts = []
        for i in range(9):
            u = i / 8
            a = ang + rng.uniform(-.16, .16)
            r = u * length
            pts.append((x + math.cos(a) * r, y + math.sin(a) * r, z + .012))
        cr = curve(f'Crack {index}.{k}', pts, .028 if not final else .040, crack_jade, C_IMPACT,
                   taper=True)
        life(cr, t_impact / FPS, (t_impact + (70 if final else 34)) / FPS, peak=1.0,
             attack=.02, release=.3)

    # dust volumes around the impact
    count = 14 if final else 6
    for k in range(count):
        a = k / count * math.tau + rng.uniform(-.3, .3)
        dist = (.8 + rng.random() * 1.4) * scale
        if final and k % 3 == 0:
            dist *= .45
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0,
                                              location=(x + math.cos(a) * dist,
                                                        y + math.sin(a) * dist, z + .5))
        puff = move_to(bpy.context.object, C_DUST)
        puff.name = f'Dust {index}.{k}'
        puff.scale = (0.3, 0.3, 0.25)
        mat = bpy.data.materials.new(puff.name)
        mat.use_nodes = True
        nd = mat.node_tree.nodes
        nd.clear()
        ln = mat.node_tree.links
        out = nd.new('ShaderNodeOutputMaterial')
        vol = nd.new('ShaderNodeVolumePrincipled')
        vol.inputs['Color'].default_value = (.030, .034, .030, 1)
        vol.inputs['Emission Color'].default_value = (.012, .035, .024, 1)
        vol.inputs['Anisotropy'].default_value = .28
        co = nd.new('ShaderNodeTexCoord')
        noise = nd.new('ShaderNodeTexNoise')
        noise.noise_dimensions = '4D'
        noise.inputs['Scale'].default_value = 3.3
        noise.inputs['Detail'].default_value = 5
        noise.inputs['Roughness'].default_value = .68
        ln.new(co.outputs['Generated'], noise.inputs['Vector'])
        noise.inputs['W'].default_value = rng.random() * 5
        noise.inputs['W'].keyframe_insert('default_value', frame=t_impact)
        noise.inputs['W'].default_value += 2.2
        noise.inputs['W'].keyframe_insert('default_value', frame=t_impact + 60)
        sub = nd.new('ShaderNodeVectorMath')
        sub.operation = 'SUBTRACT'
        sub.inputs[1].default_value = (.5, .5, .5)
        ln.new(co.outputs['Generated'], sub.inputs[0])
        ln_len = nd.new('ShaderNodeVectorMath')
        ln_len.operation = 'LENGTH'
        ln.new(sub.outputs[0], ln_len.inputs[0])
        mr = nd.new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = .16
        mr.inputs['From Max'].default_value = .49
        mr.inputs['To Min'].default_value = 1
        mr.inputs['To Max'].default_value = 0
        ln.new(ln_len.outputs['Value'], mr.inputs['Value'])
        th = nd.new('ShaderNodeMath')
        th.operation = 'SUBTRACT'
        th.inputs[1].default_value = .40
        ln.new(noise.outputs['Fac'], th.inputs[0])
        mul = nd.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        mul.use_clamp = True
        ln.new(th.outputs[0], mul.inputs[0])
        ln.new(mr.outputs[0], mul.inputs[1])
        gain = nd.new('ShaderNodeMath')
        gain.operation = 'MULTIPLY'
        ln.new(mul.outputs[0], gain.inputs[0])
        for t, v in [(t_impact, 0), (t_impact + 2, 1.2 if not final else 2.0),
                     (t_impact + 10, .8), (t_impact + (60 if final else 38), 0)]:
            gain.inputs[1].default_value = v
            gain.inputs[1].keyframe_insert('default_value', frame=t)
        ln.new(gain.outputs[0], vol.inputs['Density'])
        e = nd.new('ShaderNodeMath')
        e.operation = 'MULTIPLY'
        e.inputs[1].default_value = .01
        ln.new(gain.outputs[0], e.inputs[0])
        ln.new(e.outputs[0], vol.inputs['Emission Strength'])
        ln.new(vol.outputs['Volume'], out.inputs['Volume'])
        puff.data.materials.append(mat)
        # expand outwards and upward
        lift = 1.4 if final else 1.0
        grow = 1.45 if final else 1.0
        for u, rr, zz, sc in [(0, dist, .4, .35), (.12, dist + .8 * scale, .8, .75),
                              (.45, dist + 1.9 * scale, 1.4, 1.35 * scale),
                              (1.0, dist + 3.3 * scale, 2.0, 2.0 * scale)]:
            f = int(t_impact + u * (46 if final else 28))
            key_loc(puff, f, (x + math.cos(a) * rr, y + math.sin(a) * rr, z + zz * lift))
            key_scale(puff, f, sc * grow)
        life(puff, t_impact / FPS, (t_impact + (60 if final else 42)) / FPS, attack=.02, release=.35)

    # debris rocks
    rock_variants = []
    for v in range(4):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
        r = bpy.context.object
        r.name = f'Rock variant {index}.{v}'
        for vert in r.data.vertices:
            vert.co *= 1 + rng.uniform(-.28, .28)
        r.data.materials.append(rock_mat)
        rock_variants.append(r.data.copy())
        bpy.data.objects.remove(r, do_unlink=True)
    for k in range(26 if final else 12):
        ob = bpy.data.objects.new(f'Rock {index}.{k}', rock_variants[k % 4])
        C_DUST.objects.link(ob)
        a = rng.uniform(0, math.tau)
        speed = rng.uniform(1.2, 4.2) * (1.4 if final else 1.0)
        up = rng.uniform(2.6, 6.1) * (1.25 if final else 1.0)
        size = rng.uniform(.06, .26) * (1.8 if final else 1.0)
        key_loc(ob, t_impact, (x, y, z + .1))
        key_scale(ob, t_impact, size)
        for step in range(1, 11):
            u = step / 10 * rng.uniform(1.2, 1.9)
            tt = t_impact + int(step * (3.2 if final else 2.2))
            px = x + math.cos(a) * speed * u
            py = y + math.sin(a) * speed * u
            pz = z + .1 + up * u - 4.6 * u * u
            if pz < z + .02:
                pz = z + .02
            key_loc(ob, tt, (px, py, pz))
            ob.rotation_euler = (rng.random() * 6, rng.random() * 6, rng.random() * 6)
            ob.keyframe_insert('rotation_euler', frame=tt)
            if step == 10:
                key_scale(ob, tt, 0)
            else:
                key_scale(ob, tt, size)

    # sparks
    spark_mesh = bpy.data.meshes.new(f'Spark {index}')
    sv = [(0, 0, .11), (.016, 0, 0), (0, 0, -.11), (-.016, 0, 0)]
    sf = [(0, 1, 2, 3)]
    spark_mesh.from_pydata(sv, [], sf)
    spark_mesh.materials.append(spark_jade)
    for k in range(30 if final else 16):
        ob = bpy.data.objects.new(f'Spark {index}.{k}', spark_mesh)
        C_DUST.objects.link(ob)
        a = rng.uniform(0, math.tau)
        speed = rng.uniform(2.0, 7.5) * (1.3 if final else 1)
        up = rng.uniform(2.4, 7.8)
        life_frames = int(rng.uniform(8, 20))
        key_scale(ob, t_impact, .9)
        for step in range(0, 6):
            u = step / 5 * life_frames / FPS
            px = x + math.cos(a) * speed * u
            py = y + math.sin(a) * speed * u
            pz = z + .35 + up * u - 5.4 * u * u
            key_loc(ob, t_impact + int(step / 5 * life_frames), (px, py, pz))
            ob.rotation_euler = (a * 1.3 + step, 0, 0)
            ob.keyframe_insert('rotation_euler', frame=t_impact + int(step / 5 * life_frames))
        life(ob, t_impact / FPS, (t_impact + life_frames) / FPS, attack=.01, release=.08)

    # contact point light
    light_data = bpy.data.lights.new(f'Impact light {index}', 'POINT')
    light_data.color = (0.45, 1.0, 0.70)
    light_data.shadow_soft_size = 1.2
    lo = bpy.data.objects.new(f'Impact light {index}', light_data)
    C_CAM.objects.link(lo)
    lo.location = (x, y, z + 3.2)
    energy_keys = [(t_impact - 1, 0), (t_impact, 250 * (2.0 if final else 1.0)),
                   (t_impact + 4, 150), (t_impact + 16, 60), (t_impact + 40, 0)]
    for f, e in energy_keys:
        light_data.energy = e
        light_data.keyframe_insert('energy', frame=f)


for k, (t, pos, power, lean, final) in enumerate(IMPACTS):
    impact_burst(k, t, pos, power, final=False)
impact_burst(9, FINAL, FINAL_POS, 2.0, final=True)

# ----------------------------------------------------------------------------
# sword-intent swarm (十二柄小剑)
# ----------------------------------------------------------------------------
small_built = []
for k in range(12):
    b = build_sword(f'Sword intent {k + 1:02d}', .34, C_SWARM, aura=False, detail=False)
    small_built.append(b)


def small_state(t, k):
    phase = k / 12 * math.tau
    tilt = (math.sin(phase) * .10, math.cos(phase) * .10, 0)
    if t < 0.35:
        return None
    if t < 1.65:
        u = (t - 0.35) / 1.30
        a = phase + u * .55
        r = 8.2 - u * .4
        z = .2 + smooth(u) * 3.4
        return Vector((math.cos(a) * r, math.sin(a) * r, z)), (0, 0, a + u * 1.2), .30
    if t < 4.0:
        u = (t - 1.65) / 2.35
        a = phase + .55 + u * 1.55
        r = 7.8 + math.sin(t * .7 + k) * .15
        z = 3.4 + math.sin(t * 1.1 + k * 1.7) * .26
        return Vector((math.cos(a) * r, math.sin(a) * r, z)), (tilt[0], tilt[1], a + 1.2 + u * .8), .30
    if t < FINAL / FPS:
        u = (t - 4.0) / (FINAL / FPS - 4.0)
        a = phase + 2.1 + u * u * 7.6
        r = lerp(7.8, 2.3, smooth(u))
        z = lerp(3.4, 11.8, smooth(u))
        return Vector((math.cos(a) * r, math.sin(a) * r, z)), (0, 0, a * 2.0), .30
    if t < 6.65:
        u = (t - FINAL / FPS) / (6.65 - FINAL / FPS)
        a = phase + 9.7 + u * 2.0
        r = 2.3 + u * 3.0
        z = 11.8 + u * 1.4
        return Vector((math.cos(a) * r, math.sin(a) * r, z)), (u * 1.6, u * .8, a), .30
    u = min(1.0, (t - 6.65) / 2.6)
    a = phase + 11.7 + u * 1.2
    r = 5.3 + u * 5.8
    z = max(.2, 13.2 - 8.2 * u * u)
    return Vector((math.cos(a) * r, math.sin(a) * r, z)), (u * 2.4, u * 1.2, a), .30 * (1 - u)


for k, b in enumerate(small_built):
    root = b['root']
    for f in range(1, END + 1, 2):
        t = (f - 1) / FPS
        st = small_state(t, k)
        if st is None:
            key_loc(root, f, (0, 0, -4))
            key_scale(root, f, 0)
            continue
        pos, rot, sc = st
        key_loc(root, f, pos)
        key_rot(root, f, rot)
        key_scale(root, f, sc)
    b['blade'].hide_render = False

# ----------------------------------------------------------------------------
# sky vortex ribbons and beam
# ----------------------------------------------------------------------------
vortex = []
for k in range(4):
    rng = random.Random(510 + k)
    phase = k / 4 * math.tau
    radius = 8.4 + k * .9
    pts = []
    for i in range(64):
        u = i / 63
        a = phase + u * math.tau * 1.5
        r = radius * (1 - .22 * u)
        pts.append((math.cos(a) * r, math.sin(a) * r, 15.0 + u * 6.0 + math.sin(a * 2) * .5))
    ob = curve(f'Sky vortex {k}', pts, .05 + .008 * k, jade_ribbon_soft, C_AIR, taper=True)
    for f in range(1, 105):
        key_scale(ob, f, 0)
    for f in range(105, 130):
        key_scale(ob, f, (f - 105) / 25)
    for f in range(130, 150):
        key_scale(ob, f, 1.0)
    for f in range(150, 185):
        key_scale(ob, f, max(0.0, 1 - (f - 150) / 35))
    for f in range(185, END + 1):
        key_scale(ob, f, 0)
    ob.rotation_euler = (0, 0, 0)
    for f in range(100, 190, 4):
        ob.rotation_euler = (0, 0, (f - 100) * .006 * (1 if k % 2 else -1))
        ob.keyframe_insert('rotation_euler', frame=f)
    vortex.append(ob)

def halo_card(name, half_width, height, mat, y):
    verts, cols = [], []
    for x in (-half_width, 0, half_width):
        for z in (0, height):
            verts.append((x, y, ARENA_Z + z))
            cols.append((1, 1, 1, 0 if x else 1))
    faces = [(0, 1, 4, 3), (3, 4, 5, 2)]
    return mesh(name, verts, faces, mat, C_AIR, colors=cols)


beam_core_mat = vcol_glow('Heaven beam core', (0.30, 1.0, 0.56), 0.8)
beam_outer_mat = vcol_glow('Heaven beam outer', (0.06, 0.55, 0.30), 0.22)
# The shaft lives behind the blade as soft cards, never a volume wrapping the sword.
beam_card = halo_card('Heaven beam card', 1.6, 30, beam_outer_mat, 1.9)
beam_core_card = halo_card('Heaven beam core card', .34, 30, beam_core_mat, 1.6)

# rotating light strands frame the beam outside the blade
for k in range(3):
    pts = []
    for i in range(90):
        u = i / 89
        a = k / 3 * math.tau + u * math.tau * 2.2
        pts.append((math.cos(a) * (2.3 + u * .5), math.sin(a) * (2.3 + u * .5), ARENA_Z + u * 26))
    ob = curve(f'Heaven beam strand {k}', pts, .028, jade_ribbon, C_AIR, taper=True)
    for f in range(1, 108):
        key_scale(ob, f, 0)
    for f in range(108, 130):
        key_scale(ob, f, (f - 108) / 22)
    for f in range(130, FINAL):
        key_scale(ob, f, 1)
    for f in range(FINAL, 175):
        key_scale(ob, f, max(0, 1 - (f - FINAL) / 26))
    for f in range(175, END + 1):
        key_scale(ob, f, 0)

halo_inner = halo_card('Heaven halo inner', 2.3, 30, vcol_glow('Heaven halo inner', (0.30, 1.0, 0.56), 0.55), 1.4)
halo_outer = halo_card('Heaven halo outer', 5.4, 32, vcol_glow('Heaven halo outer', (0.06, 0.55, 0.30), 0.18), 1.6)
for ob in (beam_card, beam_core_card, halo_inner, halo_outer):
    for f in range(1, 106):
        key_scale(ob, f, (0, 1, 1))
    for f in range(106, 140):
        key_scale(ob, f, (smooth((f - 106) / 34), 1, 1))
    for f in range(140, FINAL):
        key_scale(ob, f, (1, 1, 1))
    for f in range(FINAL, 178):
        key_scale(ob, f, (max(0.0, 1 - (f - FINAL) / 28), 1, 1))
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=0)
    ob.hide_render = False
    ob.keyframe_insert('hide_render', frame=106)
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=210)

# jade discharge crawling around the charging blade
jade_lightning = emission('Charge lightning', (0.30, 1.0, 0.58), 5.0)
for k in range(7):
    rng = random.Random(950 + k)
    pts = []
    ang = k / 7 * math.tau
    for i in range(11):
        u = i / 10
        a = ang + math.sin(u * 7 + k) * .35
        r = 1.1 + rng.uniform(-.25, .85)
        pts.append((math.cos(a) * r, math.sin(a) * r, 8.4 + u * 7.4 + rng.uniform(-.25, .25)))
    ob = curve(f'Charge arc {k}', pts, .035, jade_lightning, C_AIR, taper=True)
    for start in (118, 128, 138):
        life(ob, start / FPS, (start + 7) / FPS, peak=1.0, attack=.02, release=.1)
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=1)
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=118)
    ob.hide_render = False
    ob.keyframe_insert('hide_render', frame=118)
    ob.hide_render = True
    ob.keyframe_insert('hide_render', frame=146)

# ----------------------------------------------------------------------------
# floating jade motes
# ----------------------------------------------------------------------------
mote_mesh = bpy.data.meshes.new('Mote')
mote_mesh.from_pydata([(0, 0, .04), (.03, 0, 0), (0, 0, -.04), (-.03, 0, 0)], [], [(0, 1, 2, 3)])
mote_mesh.materials.append(emission('Mote jade', (0.55, 1.0, 0.78), 4.0))
rng = random.Random(812)
for k in range(110):
    ob = bpy.data.objects.new(f'Mote {k:03d}', mote_mesh)
    C_AIR.objects.link(ob)
    a = rng.uniform(0, math.tau)
    r = math.sqrt(rng.random()) * 8.6
    x, y = math.cos(a) * r, math.sin(a) * r
    start = rng.randint(3, 96)
    dur = rng.randint(80, 150)
    life(ob, start / FPS, (start + dur) / FPS, attack=.15, release=.3)
    z0 = rng.uniform(.2, 1.2)
    drift = rng.uniform(-.8, .8)
    for f, z in [(start, z0), (start + dur // 2, z0 + rng.uniform(2.5, 5.0)),
                 (start + dur, z0 + rng.uniform(5.0, 9.0))]:
        key_loc(ob, f, (x + math.sin(f * .03) * .5, y + drift * .3, z))
    ob.rotation_euler = (0, 0, a)
    ob.keyframe_insert('rotation_euler', frame=start)

# charge motes converging during the final wind-up
for k in range(50):
    ob = bpy.data.objects.new(f'Charge mote {k:02d}', mote_mesh)
    C_AIR.objects.link(ob)
    a = rng.uniform(0, math.tau)
    r = rng.uniform(5.0, 9.0)
    start = rng.randint(98, 136)
    life(ob, start / FPS, (start + rng.randint(24, 44)) / FPS, attack=.08, release=.12)
    x, y = math.cos(a) * r, math.sin(a) * r
    end = Vector((math.cos(a) * .35, math.sin(a) * .35, rng.uniform(9, 16)))
    key_loc(ob, start, (x, y, rng.uniform(.4, 2.4)))
    key_loc(ob, start + 18, (lerp(x, end.x, .7), lerp(y, end.y, .7), 6.0))
    key_loc(ob, start + 32, end)

# release motes drifting up as the swords sink away
for k in range(60):
    ob = bpy.data.objects.new(f'Release mote {k:02d}', mote_mesh)
    C_AIR.objects.link(ob)
    a = rng.uniform(0, math.tau)
    r = math.sqrt(rng.random()) * 7.6
    start = rng.randint(190, 226)
    life(ob, start / FPS, (start + rng.randint(18, 34)) / FPS, attack=.1, release=.3)
    x, y = math.cos(a) * r, math.sin(a) * r
    key_loc(ob, start, (x, y, rng.uniform(.3, 2.2)))
    key_loc(ob, start + 20, (x + rng.uniform(-.6, .6), y + rng.uniform(-.6, .6), rng.uniform(3.5, 8.0)))
    ob.rotation_euler = (0, 0, a)
    ob.keyframe_insert('rotation_euler', frame=start)

# ----------------------------------------------------------------------------
# camera path and shake
# ----------------------------------------------------------------------------
cam_data = bpy.data.cameras.new('Shot camera')
cam_data.lens = 36
cam_data.sensor_width = 36
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.6
cam = bpy.data.objects.new('Shot camera', cam_data)
C_CAM.objects.link(cam)
scene.camera = cam
aim = bpy.data.objects.new('Aim target', None)
C_CAM.objects.link(aim)
cam_data.dof.focus_object = aim

CAM_KEYS = [
    (0.0, (0.0, -24.0, 6.0), (0.0, 0.0, 3.8), 35),
    (1.2, (2.4, -22.5, 6.2), (0.0, 0.0, 4.0), 35),
    (2.3, (5.2, -22.0, 6.0), (0.0, 0.0, 4.3), 34),
    (3.2, (8.8, -21.8, 5.9), (0.0, 0.0, 4.4), 34),
    (4.0, (10.0, -21.4, 5.7), (0.0, 0.0, 4.6), 35),
    (5.0, (9.0, -20.8, 5.1), (0.0, 0.0, 5.6), 36),
    (5.8, (7.0, -22.0, 5.0), (0.0, 0.0, 7.6), 37),
    (6.1, (7.0, -22.5, 5.2), (0.0, 0.0, 7.0), 36),
    (6.22, (8.5, -25.5, 6.0), (0.0, 0.0, 4.8), 37),
    (6.5, (10.0, -27.0, 7.2), (0.0, 0.0, 5.6), 35),
    (7.4, (11.0, -29.0, 7.8), (0.0, 0.0, 5.6), 34.5),
    (8.6, (12.5, -31.0, 8.2), (0.0, 0.0, 5.8), 34),
    (10.0, (13.5, -33.0, 8.6), (0.0, 0.0, 6.0), 33.5),
]


def cam_state(t):
    if t <= CAM_KEYS[0][0]:
        return CAM_KEYS[0]
    for i in range(len(CAM_KEYS) - 1):
        t0, p0, a0, l0 = CAM_KEYS[i]
        t1, p1, a1, l1 = CAM_KEYS[i + 1]
        if t0 <= t <= t1:
            u = smooth((t - t0) / (t1 - t0))
            return (t, tuple(vlerp(p0, p1, u)), tuple(vlerp(a0, a1, u)), lerp(l0, l1, u))
    return CAM_KEYS[-1]


def shake(t):
    amp = 0.0
    for k, (timp, pos, power, lean, final) in enumerate(IMPACTS):
        if t >= timp / FPS:
            dt = t - timp / FPS
            amp += 0.055 * math.exp(-dt * 3.4)
    if t >= FINAL / FPS:
        dt = t - FINAL / FPS
        amp += 0.28 * math.exp(-dt * 2.1)
    amp += 0.010
    n = Vector((math.sin(t * 37.1 + 1.3) + .4 * math.sin(t * 71.7),
                math.cos(t * 29.7 + 2.1) + .4 * math.cos(t * 61.3),
                math.sin(t * 23.3 + .7) * .8))
    return n * amp


for f in range(1, END + 1):
    t = (f - 1) / FPS
    _, p, a, lens = cam_state(t)
    sh = shake(t)
    cam.location = (p[0] + sh.x, p[1] + sh.y, p[2] + sh.z)
    cam.rotation_euler = look_quat(cam.location, a).to_euler()
    aim.location = a
    cam_data.lens = lens
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_euler', frame=f)
    aim.keyframe_insert('location', frame=f)
    cam_data.keyframe_insert('lens', frame=f)

# screen-space impact marks for the post lens flare
from bpy_extras.object_utils import world_to_camera_view
scene.frame_set(1)
marks = []
for k, (t, pos, power, lean, final) in enumerate(IMPACTS):
    fr_i = t
    scene.frame_set(fr_i)
    bpy.context.view_layer.update()
    v = world_to_camera_view(scene, cam, Vector((pos[0], pos[1], ARENA_Z + .8)))
    marks.append({'frame': fr_i, 'time': (fr_i - 1) / FPS, 'x': round(v.x, 5), 'y': round(v.y, 5),
                  'power': power, 'final': False})
scene.frame_set(FINAL)
bpy.context.view_layer.update()
v = world_to_camera_view(scene, cam, Vector((FINAL_POS[0], FINAL_POS[1], ARENA_Z + 1.4)))
marks.append({'frame': FINAL, 'time': (FINAL - 1) / FPS, 'x': round(v.x, 5), 'y': round(v.y, 5),
              'power': 2.0, 'final': True})
(OUT / 'impact-marks.json').write_text(json.dumps(marks, indent=2));
scene.frame_set(1)

# ----------------------------------------------------------------------------
# atmosphere volumes
# ----------------------------------------------------------------------------
def fog_volume(name, size, loc, density, color, emission, seed, z_scale=1.0, glow=.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = move_to(bpy.context.object, C_ENV)
    ob.name = name
    ob.scale = (size[0], size[1], size[2] * z_scale)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nd = mat.node_tree.nodes
    nd.clear()
    ln = mat.node_tree.links
    out = nd.new('ShaderNodeOutputMaterial')
    vol = nd.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (*color, 1)
    vol.inputs['Emission Color'].default_value = (*emission, 1)
    vol.inputs['Emission Strength'].default_value = glow
    vol.inputs['Anisotropy'].default_value = .32
    co = nd.new('ShaderNodeTexCoord')
    noise = nd.new('ShaderNodeTexNoise')
    noise.noise_dimensions = '4D'
    noise.inputs['Scale'].default_value = 2.6
    noise.inputs['Detail'].default_value = 4
    noise.inputs['Roughness'].default_value = .6
    ln.new(co.outputs['Generated'], noise.inputs['Vector'])
    noise.inputs['W'].default_value = seed
    noise.inputs['W'].keyframe_insert('default_value', frame=1)
    noise.inputs['W'].default_value = seed + 2.4
    noise.inputs['W'].keyframe_insert('default_value', frame=END)
    mr = nd.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = .34
    mr.inputs['From Max'].default_value = .72
    mr.inputs['To Min'].default_value = .25
    mr.inputs['To Max'].default_value = 1.15
    ln.new(noise.outputs['Fac'], mr.inputs['Value'])
    gain = nd.new('ShaderNodeMath')
    gain.operation = 'MULTIPLY'
    gain.inputs[1].default_value = density
    ln.new(mr.outputs[0], gain.inputs[0])
    ln.new(gain.outputs[0], vol.inputs['Density'])
    ln.new(vol.outputs['Volume'], out.inputs['Volume'])
    ob.data.materials.append(mat)
    return ob


fog_volume('Night haze', (90, 90, 18), (0, 10, 8), .0009, (.028, .044, .046), (.012, .028, .024), 1.7, glow=.02)
fog_volume('Ground mist', (42, 42, 2.2), (0, 0, .95), .006, (.036, .050, .044), (.012, .026, .020), 4.3, glow=.012)
fog_volume('Sky storm', (60, 60, 20), (0, 0, 20), .0007, (.020, .034, .038), (.015, .038, .030), 7.1, glow=.02)

# ----------------------------------------------------------------------------
# lights
# ----------------------------------------------------------------------------
def area(name, loc, power, color, size, target=(0, 0, 3)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = 'DISK'
    data.size = size
    ob = bpy.data.objects.new(name, data)
    C_CAM.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob


area('Moon rim', (-14, 22, 18), 850, (0.46, 0.62, 0.75), 9, (0, 0, 4))
area('Jade back light', (2, 18, 9), 1500, (0.26, 1.0, 0.56), 6, (0, 0, 4))
area('Warm low fill', (10, -8, 2.5), 420, (1.0, 0.52, 0.22), 4, (0, 0, 2))
area('Top soft key', (-3, -6, 16), 520, (0.66, 0.82, 0.88), 6, (0, 0, 2))
area('Front fill', (-8, -11, 7.5), 850, (0.72, 0.92, 0.86), 6, (0, 0, 3))
area('Jade side rim', (12, -4, 5), 650, (0.30, 1.0, 0.65), 3, (0, 0, 4))
area('Blade sheen', (-6, -10, 11), 1500, (0.78, 1.0, 0.88), 1.4, (0, 0, 5))

# charging spot above the centre
spot_data = bpy.data.lights.new('Heaven spot', 'SPOT')
spot_data.color = (0.42, 1.0, 0.70)
spot_data.energy = 0
spot_data.spot_size = math.radians(38)
spot_data.spot_blend = .5
spot_data.shadow_soft_size = 3.0
spot = bpy.data.objects.new('Heaven spot', spot_data)
C_CAM.objects.link(spot)
spot.location = (0, 0, 26)
spot.rotation_euler = (0, 0, 0)
for f, e in [(1, 0), (100, 0), (120, 450), (145, 1200), (149, 1800),
             (160, 900), (200, 150), (230, 0)]:
    spot_data.energy = e
    spot_data.keyframe_insert('energy', frame=f)

# jade heart-glow picking out the fifth sword while it hangs above the seal
heart_data = bpy.data.lights.new('Sword heart glow', 'POINT')
heart_data.color = (0.30, 1.0, 0.60)
heart_data.shadow_soft_size = 1.6
heart = bpy.data.objects.new('Sword heart glow', heart_data)
C_CAM.objects.link(heart)
heart.location = (0, -1.6, 11.5)
for f, e in [(1, 0), (108, 0), (126, 220), (145, 420), (149, 900),
             (158, 420), (178, 90), (196, 0)]:
    heart_data.energy = e
    heart_data.keyframe_insert('energy', frame=f)

# ----------------------------------------------------------------------------
# markers, interpolation, save
# ----------------------------------------------------------------------------
for frame, name in [
    (1, 'CALM'), (27, 'SEAL IGNITES'), (39, 'SWORD 1 FALL'), (56, 'IMPACT 1'),
    (68, 'IMPACT 2'), (80, 'IMPACT 3'), (92, 'IMPACT 4'), (104, 'BEAM'),
    (110, 'FIFTH SWORD'), (135, 'CHARGE'), (144, 'PLUNGE'), (149, 'FINAL IMPACT'),
    (175, 'AFTERMATH'), (205, 'DISSOLVE'), (240, 'FADE'),
]:
    scene.timeline_markers.new(name, frame=frame)

for action in bpy.data.actions:
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = 'LINEAR'
    except AttributeError:
        for fc in action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'

scene['Study'] = 'Five Peaks Heavenfall / independent Blender visual study, not game integration'
scene['FPS'] = FPS
scene['Duration seconds'] = END / FPS
scene['Timeline'] = 'seal -> 4 giant swords -> charge -> fifth sword -> impact -> fade'

if not args.nosave:
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'five-peaks-heavenfall.blend'))

# ----------------------------------------------------------------------------
# render
# ----------------------------------------------------------------------------
FRAMES.mkdir(exist_ok=True)
if args.still:
    scene.render.filepath = str(OUT / 'stills' / 'still_')
    for token in args.still.split(','):
        scene.frame_set(int(token))
        scene.render.filepath = str(OUT / 'stills' / f'still_{int(token):04d}.png')
        bpy.ops.render.render(write_still=True)
elif args.all:
    scene.render.filepath = str(FRAMES / 'frame_')
    bpy.ops.render.render(animation=True)
