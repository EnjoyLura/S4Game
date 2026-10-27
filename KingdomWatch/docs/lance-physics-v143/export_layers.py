"""Re-render the editable study as four independent, fixed-camera game passes.
Blender 5.2 --background ../lance-blender-study-v2/golden-thunder-lance.blend
  --python export_layers.py -- [--quick]
No game or battle is launched. pack_layers.py bakes straight-alpha glow/atlases.
"""
import argparse
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Quaternion
from bpy_extras.object_utils import world_to_camera_view

OUT = Path(__file__).resolve().parent
sys.path.insert(0,str(OUT))
from revise_scene import revise
revise()
parser = argparse.ArgumentParser()
parser.add_argument('--quick', action='store_true')
parser.add_argument('--metadata-only', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
scene = bpy.context.scene
camera = scene.camera
root = bpy.data.objects['LANCE | tip anchor / all body motion']
collections = {c.name[:2]: c for c in scene.collection.children}
camera_pose = camera.matrix_world.copy()
scene.render.film_transparent = True
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 35
scene.eevee.taa_render_samples = 48
camera.data.ortho_scale=25
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'electric-lance-v143.blend'),compress=True)

def project(point):
    v = world_to_camera_view(scene, camera, Vector(point))
    return [v.x, v.y]

passes = {
    'body': dict(cell=[192,512], count=48, fps=24, start=.5, cols=8, enabled=['01','02'], loop=True),
    'impact': dict(cell=[512,512], count=24, fps=30, start=1.5, cols=6, enabled=['03','06'], loop=False),
}
for name, spec in passes.items():
    directory = OUT / 'layers' / name
    directory.mkdir(parents=True, exist_ok=True)
    for key, collection in collections.items():
        collection.hide_render = key not in ['00', *spec['enabled']]
    camera.matrix_world = camera_pose.copy()
    camera.data.ortho_scale = 15.8
    if name=='impact':camera.data.ortho_scale=25
    if name == 'body':
        root.animation_data_clear()
        root.location = (0,0,0)
        root.rotation_quaternion = Quaternion((1,0,0,0))
        camera.location = (0,-15,3.4)
        camera.rotation_euler = (Vector((0,0,3.4))-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.ortho_scale = 8
    elif name in ('ground','wave'):
        camera.location = (7.9,-14.7,10.4)
        camera.rotation_euler = (-camera.location).to_track_quat('-Z','Y').to_euler()
    w,h = spec['cell']
    scene.render.resolution_x, scene.render.resolution_y = w*2,h*2
    # Blender fits the orthographic scale to its sensor. Measure the actual projection.
    bpy.context.view_layer.update()
    if name == 'body':
        lo, hi = project((0,0,-.6)), project((0,0,7.4))
        camera.data.ortho_scale *= (hi[1]-lo[1])
        bpy.context.view_layer.update()
    anchor = project((0,0,-.123 if name=='body' else 0))
    meta = dict(schema=1, kind=name, frameCount=spec['count'], fps=spec['fps'],
                cellSize=spec['cell'], columns=spec['cols'], loop=spec['loop'], anchor=anchor)
    if name == 'body':
        meta['bodyLengthPixels'] = (project((0,0,6.4575))[1]-anchor[1])*h
        meta['worldUnitsPerPixel'] = 6.5805/meta['bodyLengthPixels']
    else:
        meta['visualWidthPerRadius'] = 1 / ((project((7,0,0))[0]-anchor[0])**2 +
            (project((0,7,0))[0]-anchor[0])**2)**.5
    (directory/'pass.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8')
    indices = [] if args.metadata_only else ([0,3,7,13,20] if args.quick else range(spec['count']))
    for i in indices:
        if i >= spec['count']: continue
        t = spec['start'] + i/spec['fps']
        f = 1+t*24
        scene.frame_set(math.floor(f),subframe=f%1)
        if name == 'body':
            root.location = (0,0,0)
            root.rotation_quaternion = Quaternion((1,0,0,0))
            for obj in collections['02'].objects:
                if obj.parent != root: obj.hide_render = True
            # Holdout is not needed in the canonical, freely rotating body pass.
            bpy.data.objects['Ground holdout / clips buried tip'].hide_render = True
        else:
            bpy.data.objects['Ground holdout / clips buried tip'].hide_render = False
        if name == 'wave':
            for obj in collections['05'].objects:
                obj.hide_render = not (obj.name.startswith('Surge 1 ') or
                    obj.name.startswith('Detached front 0.') or obj.name.startswith('Wandering outward front 0.'))
        scene.render.filepath = str(directory/f'{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    print('EXPORTED',name,json.dumps(meta),flush=True)
