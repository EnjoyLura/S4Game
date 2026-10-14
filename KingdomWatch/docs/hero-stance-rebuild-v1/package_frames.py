"""Produce full-character frames; source-range annotation is production, not game QA."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import uuid
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
sys.path.insert(0, str(GAME / 'docs/volt-idle-v1'))
from package_idle import key_red, bounds, draw_frame
sys.path.insert(0, str(GAME / 'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from hero_idle_loop import idle_loop_timeline
from hero_frame_bounds import require_source_margin
sys.stdout.reconfigure(encoding='utf-8')
CELL, GROUND, COLS = (512, 512), (256, 496), 8
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
SPECS = {'sniper': ('sniper-stance-idle-v3', 'sniper_stance_idle_v3', 153, '重弩手'),
         'volt': ('volt-stance-idle-v2', 'volt_stance_idle_v2', 146, '雷法师')}


def choose_idle_loop(images, indices, backgrounds):
    """A loose pixel-difference threshold cannot authorize a visible end-to-start cut."""
    record = {'method':'continuous','range':[indices[0],indices[-1]],
              'reversePlayback': False,
              'nativeSourceCycleRequired': True,
              'reason':'User rejected reversed cloth; preserve the complete natural source cycle in chronological order',
              'scope':'Structural production constraint; not visual acceptance'}
    return images,indices,backgrounds,'continuous',record


def boot_pivot(image, box):
    # The staggered front boot is higher than the rear boot. Include both boots.
    alpha = np.asarray(image.getchannel('A'))
    start = box[3] - round((box[3] - box[1]) * .20)
    _, xs = np.where(alpha[start:box[3]] > 90)
    return [(float(xs.min()) + float(xs.max())) / 2, box[3]]


def decode(folder):
    reader = imageio_ffmpeg.read_frames(str(folder / 'source.mp4'), pix_fmt='rgb24')
    info = next(reader)
    return info, [Image.frombytes('RGB', info['size'], data) for data in reader]


def annotate(folder, info, images):
    target = folder / 'source-frames'
    target.mkdir(exist_ok=True)
    first, _ = key_red(images[0])
    box = bounds(first)
    top_half = (max(0, box[0]-10), max(0, box[1]-10),
                min(info['size'][0], box[2]+10), box[1]+round((box[3]-box[1])*.5))
    sheets = []
    for region, name, width, height in [(tuple(box), 'source-contact.jpg', 144, 254),
                                      (top_half, 'weapon-contact.jpg', 240, 206)]:
        sheet = Image.new('RGB', (7*width, ((len(images)+6)//7)*height), '#e8ddc4')
        draw = ImageDraw.Draw(sheet)
        for i, image in enumerate(images):
            crop = image.crop(region)
            crop.thumbnail((width-6, height-28), Image.Resampling.LANCZOS)
            x, y = i % 7 * width, i // 7 * height
            sheet.paste(crop, (x+(width-crop.width)//2, y))
            draw.text((x+6, y+height-26), f'{i:02d} {i/info["fps"]:.2f}s', font=FONT, fill='#293c3b')
        sheet.save(folder / name, quality=94)
        sheets.append(name)
    for i, image in enumerate(images):
        image.save(target / f'source-{i:02d}.jpg', quality=96)
    (folder / 'source-info.json').write_text(json.dumps({**info, 'frameCount': len(images),
        'seconds': len(images)/info['fps'], 'annotationSheets': sheets}, indent=2), encoding='utf-8')
    print(json.dumps({'sourceFrames': len(images), 'fps': info['fps'], 'sheets': sheets}))


def preview(folder, hero, kind, cells, manifest, idle=None):
    if idle:
        idle_directory = manifest['idleReference'].removeprefix('ux/').removesuffix('/idle.frames')
        idle_atlas = Image.open(GAME / f'assets/resources/ux/{idle_directory}/idle.png').convert('RGBA')
        x, y, w, h = idle['frames'][idle['animation']['frames'][0]]
        idle_cell = idle_atlas.crop((x, y, x+w, y+h))
        timeline = [(idle_cell, idle, .6)] + [(cells[int(name.removeprefix(kind))], manifest, duration)
            for name, duration in zip(manifest['animation']['frames'], manifest['animation']['frameDurations'])]
        timeline.append((idle_cell, idle, .6))
    else:
        timeline = [(cells[int(name.removeprefix(kind))], manifest, duration)
            for name, duration in zip(manifest['animation']['frames'], manifest['animation']['frameDurations'])]
    sequence, durations = [], []
    for cell, meta, duration in timeline:
        canvas = Image.new('RGBA', (840, 510), '#293c3b')
        draw = ImageDraw.Draw(canvas)
        draw.text((20, 10), SPECS[hero][3] + (' · 轻微待机 / 镜像' if kind == 'idle' else ' · 攻击与待机 / 镜像'),
                  font=FONT, fill='#eef1e4')
        draw_frame(canvas, cell, meta, 210, 486, 380)
        draw_frame(canvas, cell, meta, 630, 486, 380, True)
        sequence.append(canvas.convert('RGB'))
        durations.append(duration)
    save_gif(sequence, folder / f'{kind}-mirror.gif', sum(durations), durations)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--hero', choices=list(SPECS), required=True)
    ap.add_argument('--kind', choices=['idle', 'attack'], default='idle')
    ap.add_argument('--extract-only', action='store_true')
    ap.add_argument('--start', type=int, default=0)
    ap.add_argument('--end', type=int)
    ap.add_argument('--omit', type=int, nargs='*', default=[])
    ap.add_argument('--release', type=int)
    ap.add_argument('--attack-seconds', type=float, help='Uniformly retime the complete forward attack source')
    ap.add_argument('--return-to-start', action='store_true', help='Recover through the same complete frames to the unchanged first pose')
    ap.add_argument('--folder', help='Versioned production folder under docs')
    ap.add_argument('--resource', help='Versioned resource directory under assets/resources/ux')
    ap.add_argument('--idle-reference', help='Keep the painted height of this existing idle resource')
    ap.add_argument('--rgba-frames', help='Use already prepared full-size RGBA frames, preserving the original source timeline')
    ap.add_argument('--loop-seconds', type=float, default=4)
    ap.add_argument('--loop-style', choices=['continuous'], default='continuous')
    ap.add_argument('--static-accepted', action='store_true')
    ap.add_argument('--full-source-required', action='store_true', help='Reject any shortened idle source; defective source videos must be regenerated')
    args = ap.parse_args()
    hero, kind = args.hero, args.kind
    doc_name, resource, display_height, label = SPECS[hero]
    if kind == 'attack':
        doc_name, resource = f'{hero}-stance-attack-v1', f'{hero}_stance_attack_v1'
    doc_name = args.folder or doc_name
    resource = args.resource or resource
    folder = GAME / 'docs' / doc_name
    destination = GAME / 'assets/resources/ux' / resource
    rejection_path = folder / 'source-rejection.json'
    if rejection_path.exists() and json.loads(rejection_path.read_text(encoding='utf-8')).get('usableForPackaging') is False:
        raise RuntimeError('This source was rejected during production; regenerate the complete video before packaging')
    info, originals = decode(folder)
    if args.extract_only:
        annotate(folder, info, originals)
        return
    end = len(originals)-1 if args.end is None else args.end
    indices = [i for i in range(args.start, end+1) if i not in args.omit]
    if (kind == 'idle' or args.full_source_required) and indices != list(range(len(originals))):
        raise RuntimeError('Full animation requires all video frames; regenerate defective source instead of trimming')
    if args.full_source_required and args.return_to_start:
        raise RuntimeError('Full natural source must progress forward without reversed recovery')
    if len(indices) < 2 or not 0 <= args.start <= end < len(originals):
        raise RuntimeError('Choose an adjacent source range with at least two frames')
    if kind == 'attack' and args.release not in indices:
        raise RuntimeError('Annotate a retained source release frame')
    prepared = None
    if args.rgba_frames:
        prepared_paths = sorted((folder / args.rgba_frames).glob('frame-*.png'))
        if len(prepared_paths) != len(originals):
            raise RuntimeError('Prepared frames must retain every original source frame')
        prepared = [Image.open(path).convert('RGBA') for path in prepared_paths]
        if any(frame.size != tuple(info['size']) for frame in prepared):
            raise RuntimeError('Prepared frames must preserve the full original canvas and scale')
    frames, backgrounds = [], []
    for i in indices:
        keyed, bg = key_red(originals[i])
        frames.append(prepared[i] if prepared else keyed)
        backgrounds.append(bg)
    source_framing = require_source_margin(frames, indices)
    first = prepared[0] if prepared else key_red(originals[0])[0]
    first_box = bounds(first)
    source_foot = boot_pivot(first, first_box)
    loop_mode,loop_selection = args.loop_style,None
    if kind == 'idle':
        frames,indices,backgrounds,loop_mode,loop_selection = choose_idle_loop(frames,indices,backgrounds)
    boxes = [bounds(frame) for frame in frames]
    left = max(0, min(b[0] for b in boxes)-4)
    top = max(0, min(b[1] for b in boxes)-4)
    right = min(info['size'][0], max(b[2] for b in boxes)+4)
    bottom = min(info['size'][1], max(b[3] for b in boxes)+4)
    idle = None
    reference = None
    if kind == 'attack' or args.idle_reference:
        reference_resource = args.idle_reference or SPECS[hero][1]
        reference = json.loads((GAME / f'assets/resources/ux/{reference_resource}/idle.frames.json').read_text(encoding='utf-8'))
        scale = reference['readyHeightPx'] / (source_foot[1]-first_box[1])
        painted_height = reference['readyHeightPx']
        if kind == 'attack':
            idle = reference
    else:
        extent = max(source_foot[0]-left, right-source_foot[0])
        scale = min((CELL[0]-32)/(2*extent), (CELL[1]-40)/(bottom-top))
        painted_height = round((source_foot[1]-first_box[1])*scale, 4)
    dw, dh = round((right-left)*scale), round((bottom-top)*scale)
    tx = round(GROUND[0]-(source_foot[0]-left)*scale)
    ty = round(GROUND[1]-(source_foot[1]-top)*scale)
    if tx < 0 or ty < 0 or tx+dw > CELL[0] or ty+dh > CELL[1]:
        raise RuntimeError('The complete shared-scale crop exceeds the cell; preserve source and increase canvas')
    page_capacity = COLS * (4096 // CELL[1])
    atlases = [Image.new('RGBA', (CELL[0]*COLS, CELL[1]*((min(page_capacity,len(frames)-start)+COLS-1)//COLS)))
               for start in range(0,len(frames),page_capacity)]
    if kind == 'idle' and len(atlases) > 1:
        raise RuntimeError('Idle atlas format remains unchanged; selected frames exceed the single-page limit')
    atlas = atlases[0]
    (folder / 'frames').mkdir(exist_ok=True)
    cells, rects, frame_pages = [], {}, {}
    for i, frame in enumerate(frames):
        cell = Image.new('RGBA', CELL)
        cell.alpha_composite(frame.crop((left, top, right, bottom)).resize((dw, dh), Image.Resampling.LANCZOS), (tx, ty))
        cell.save(folder / 'frames' / f'{kind}-{i:02d}.png')
        cells.append(cell)
        page, local = divmod(i, page_capacity)
        x, y = local % COLS * CELL[0], local // COLS * CELL[1]
        atlases[page].paste(cell, (x, y))
        rects[f'{kind}{i}'] = [x, y, *CELL]
        frame_pages[f'{kind}{i}'] = page
    if kind == 'idle':
        order, durations, loop_contract = idle_loop_timeline(len(cells), args.loop_seconds)
        animation = {'frames': [f'idle{i}' for i in order], 'seconds': args.loop_seconds,
                     'frameDurations': durations, 'loop': True, 'loopClosure': loop_contract}
    else:
        order = list(range(len(cells)))
        if args.return_to_start:
            order += list(range(len(cells)-2,-1,-1))
        if args.attack_seconds is not None and args.attack_seconds <= 0:
            raise RuntimeError('Attack duration must be positive')
        durations = [args.attack_seconds / len(order) if args.attack_seconds else 1/info['fps']]*len(order)
        release = indices.index(args.release)
        animation = {'frames': [f'attack{i}' for i in order], 'seconds': sum(durations), 'frameDurations': durations,
                     'loop': False, 'releaseIndex': release, 'readyIndex': len(order)-1,
                     'recoverySeconds': sum(durations[release:])}
    manifest = {'hero': hero, 'frames': rects, 'animation': animation, 'sourceOrder': order,
        'groundAnchor': list(GROUND), 'cellSize': list(CELL), 'readyHeightPx': painted_height,
        'displayHeight': display_height,
        'source': {'file': 'source.mp4', 'sha256': hashlib.sha256((folder/'source.mp4').read_bytes()).hexdigest(),
            'videoSize': list(info['size']), 'fps': info['fps'], 'frameCount': len(originals),
            'seconds': len(originals)/info['fps'], 'indices': indices, 'omittedEffectsFrames': args.omit,
            'jointCrop': [left, top, right, bottom], 'fixedScale': scale,
            'fixedFootSource': source_foot, 'redFieldPerFrame': backgrounds},
        'processing': {'matte': 'Global red key with decontaminated edges and enclosed weapon gaps',
            'spatial': 'One fixed crop, uniform scale and pivot spanning both staggered boots; complete character; no part deformation or frame-by-frame scaling',
            'temporal': 'Complete natural source cycle in chronological order, uniform timing, no reverse playback or endpoint hold' if kind == 'idle' else ('Historical retraced recovery' if args.return_to_start else 'Complete forward preparation, annotated release and natural recovery; uniform timing, no reverse, omissions or opacity fades')},
        'blend': 'straight RGBA; single sprite, no opacity fade',
        'review': 'Production source annotation; effects reviewed manually by user; no browser/game/tests/online QA'}
    if prepared:
        manifest['preparedFrames'] = {'directory': args.rgba_frames, 'count': len(prepared),
                                     'originalCanvasPreserved': True, 'sourceTimelinePreserved': True}
    manifest['staticMasterAcceptedByUser'] = args.static_accepted
    texture_files = [f'{kind}.png' if page == 0 else f'{kind}-{page}.png' for page in range(len(atlases))]
    if len(atlases) > 1:
        manifest['textures'] = texture_files
        manifest['framePages'] = frame_pages
    manifest['fullSourceRequired'] = kind == 'idle' or args.full_source_required
    manifest['sourceFraming'] = source_framing
    manifest['animationAcceptedByUser'] = False
    if loop_selection:
        manifest['loopSelection'] = loop_selection
        (folder/'loop-selection.json').write_text(json.dumps(loop_selection,indent=2),encoding='utf-8')
    if args.idle_reference:
        manifest['idleReference'] = 'ux/'+args.idle_reference+'/idle.frames'
        manifest['calibration'] = 'One uniform source scale preserves the existing painted height and display size; shared foot pivot; no per-frame body normalization'
    if idle:
        manifest['idleReference'] = 'ux/'+reference_resource+'/idle.frames'
        manifest['source']['releaseFrame'] = args.release
        manifest['calibration'] = 'One uniform whole-frame scale matches the new idle painted head-to-ground height, with the same ground pivot and display height'
    destination.mkdir(parents=True, exist_ok=True)
    for page, texture_file in zip(atlases, texture_files):
        page.save(destination / texture_file, optimize=True)
        page.save(folder / texture_file, optimize=True)
    encoded = json.dumps(manifest, ensure_ascii=False, indent=2)
    for directory in [destination, folder]:
        (directory/f'{kind}.frames.json').write_text(encoded, encoding='utf-8')
    for path, importer, version in [(destination, 'directory', '1.2.0'), (destination/f'{kind}.frames.json', 'json', '2.0.1')]:
        meta = Path(str(path)+'.meta')
        if not meta.exists():
            meta.write_text(json.dumps({'ver':version, 'importer':importer, 'imported':True,
                'uuid':str(uuid.uuid4()), 'files':['.json'] if importer=='json' else [],
                'subMetas':{}, 'userData':{}}, indent=2), encoding='utf-8')
    ready = Image.open(folder/'ready-red.png')
    ready_alpha, ready_background = key_red(ready)
    ready_alpha.save(folder/'ready-transparent.png', optimize=True)
    (folder/'art.json').write_text(json.dumps({'image':'ready-red.png', 'imageTool':'built-in imagegen',
        'size':list(ready.size), 'mode':ready.mode, 'backgroundRGB':ready_background,
        'groundAnchor':boot_pivot(ready_alpha,bounds(ready_alpha)), 'displayHeight':display_height,
        'userAccepted':args.static_accepted}, indent=2), encoding='utf-8')
    sheet = Image.new('RGB', (7*128, 36+((len(cells)+6)//7)*148), '#e8ddc4')
    draw = ImageDraw.Draw(sheet)
    draw.text((12,8), label+(' · 轻微待机' if kind=='idle' else ' · 新站姿攻击'), font=FONT, fill='#293c3b')
    for i, cell in enumerate(cells):
        x, y = i%7*128, 36+i//7*148
        thumb = cell.resize((128,128), Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x,y),thumb)
        draw.text((x+6,y+128), f'{i:02d} / {indices[i]:02d}', font=FONT, fill='#47565a')
    sheet.save(folder/'contact-sheet.jpg', quality=94)
    preview(folder, hero, kind, cells, manifest, idle)
    report = {'hero':hero, 'kind':kind, 'uniqueFrames':len(cells), 'timelineFrames':len(order),
        'sourceFrames':len(originals), 'sourceIndices':indices, 'seconds':animation['seconds'],
        'atlas':list(atlas.size), 'atlasPages':[{'file':name,'size':list(page.size)} for name,page in zip(texture_files,atlases)],
        'atlasBytes':sum((destination/name).stat().st_size for name in texture_files),
        'resource':resource, 'paintedHeight':painted_height, 'displayHeight':display_height,
        'gameIntegrated':False, 'userAccepted':False, 'staticMasterAcceptedByUser':args.static_accepted,
        'fullSourceRequired':kind == 'idle' or args.full_source_required, 'allSourceFramesRetained':indices == list(range(len(originals))),
        'loopStyle':loop_mode, 'sourceVideoNewlyGenerated':bool(args.folder), 'review':manifest['review']}
    (folder/'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)


if __name__ == '__main__':
    main()
