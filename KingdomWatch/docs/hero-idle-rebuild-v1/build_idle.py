"""Package whole-character H3 videos with one crop, scale and foot pivot per hero."""
from pathlib import Path
import argparse, hashlib, json, math, sys, uuid
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
sys.path.insert(0, str(GAME.parent / '美术/tools'))
from mob_video2frames import key_frame, KEY_COLOR
from hero_idle_loop import idle_loop_timeline
sys.stdout.reconfigure(encoding='utf-8')
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
LABELS = {'archer': '弓箭手', 'sniper': '重弩手'}
DESTINATIONS = {'archer': 'archer_idle_rebuild_v2', 'sniper': 'sniper_idle_rebuild_v1'}
CW, CH, COLS, COUNT = 256, 384, 8, 24

def save_gif(frames, path, seconds, frame_durations=None):
    palette_source = Image.new('RGB', (frames[0].width * 3, frames[0].height))
    for i, n in enumerate([0, len(frames)//2, len(frames)-1]):
        palette_source.paste(frames[n], (i*frames[0].width, 0))
    palette = palette_source.quantize(colors=256)
    converted = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    timing = frame_durations if frame_durations is not None else [seconds/len(frames)]*len(frames)
    edges = np.concatenate([[0.0],np.cumsum(timing)])*1000
    durations = [max(10,round(edges[i+1]/10)*10-round(edges[i]/10)*10) for i in range(len(frames))]
    converted[0].save(path, save_all=True, append_images=converted[1:], loop=0,
                      duration=durations, disposal=2, optimize=False)

def bounds(frame):
    y, x = np.where(frame.max(2) > 28)
    if not len(x):
        raise RuntimeError('Video frame contains no visible character')
    return (int(x.min()), int(y.min()), int(x.max()+1), int(y.max()+1))

def smooth_loop(count, seconds=4.0):
    """Legacy idle entry now follows the permanent forward-only source-cycle rule."""
    order, durations, _ = idle_loop_timeline(count, seconds)
    return order,durations

def save_idle_preview(folder, hero, cells, manifest):
    previews=[]
    cw,ch=manifest['cellSize']
    for name in manifest['animation']['frames']:
        n=int(name.removeprefix('idle'))
        bg=Image.new('RGBA',(640,500),'#293c3b')
        d=ImageDraw.Draw(bg)
        d.text((20,12),LABELS[hero]+' · 原向 / 镜像',font=FONT,fill='#eef1e4')
        for sign,x in [(1,160),(-1,480)]:
            s=350/manifest['readyHeightPx']
            cell=cells[n].resize((round(cw*s),round(ch*s)),Image.Resampling.LANCZOS)
            if sign<0:
                cell=cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            anchor_x=(cw-manifest['groundAnchor'][0] if sign<0 else manifest['groundAnchor'][0])*s
            bg.alpha_composite(cell,(round(x-anchor_x),round(476-manifest['groundAnchor'][1]*s)))
        previews.append(bg.convert('RGB'))
    save_gif(previews,folder/'idle-mirror.gif',manifest['animation']['seconds'],manifest['animation'].get('frameDurations'))

def aperture_translation(frame, reference, spec):
    """Follow the weapon for matte seeds only; character pixels keep their original positions."""
    left, top, right, bottom = spec['trackingBox']
    maximum = spec['maxTranslation']
    template = reference[top:bottom:4, left:right:4].astype(np.float32)
    support = template.max(2) > 40
    ref_pixels = template[support]

    def error(dx, dy):
        sample = frame[top+dy:bottom+dy:4, left+dx:right+dx:4]
        return float(np.abs(sample[support].astype(np.float32)-ref_pixels).mean())

    _, dx, dy = min((error(x,y),x,y) for y in range(-maximum,maximum+1,4)
                    for x in range(-maximum,maximum+1,4))
    _, dx, dy = min((error(x,y),x,y) for y in range(max(-maximum,dy-3),min(maximum,dy+3)+1)
                    for x in range(max(-maximum,dx-3),min(maximum,dx+3)+1))
    return dx, dy

def key_apertures(frame, rgba, reference, spec):
    """Seed the actual negative spaces as well as the external background, regardless of closure."""
    dx, dy = aperture_translation(frame, reference, spec)
    radius = spec['seedSearchRadius']
    marked = Image.fromarray(frame)
    height, width = frame.shape[:2]
    seeds = []
    for sx, sy in spec['apertureSeeds']:
        x, y = sx+dx, sy+dy
        left, top = max(0,x-radius), max(0,y-radius)
        right, bottom = min(width,x+radius+1), min(height,y+radius+1)
        window = frame[top:bottom,left:right]
        wy, wx = np.where(window.sum(2, dtype=np.uint16) <= spec['keyTolerance'])
        if not len(wx):
            raise RuntimeError('A crossbow aperture seed no longer lands on black background')
        closest = np.argmin((wx+left-x)**2+(wy+top-y)**2)
        seed = (int(wx[closest]+left),int(wy[closest]+top))
        seeds.append(seed)
        ImageDraw.floodfill(marked,seed,KEY_COLOR,thresh=spec['keyTolerance'])
    pixels = np.asarray(marked)
    removed = np.all(pixels==KEY_COLOR,axis=2)
    aperture_alpha = Image.fromarray(np.where(removed,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))
    # Keep all existing body/cape pixels; only remove additional background components.
    rgba.putalpha(Image.fromarray(np.minimum(np.asarray(rgba.getchannel('A')),np.asarray(aperture_alpha))))
    return rgba, {'translation':[dx,dy],'seeds':seeds}

def build(hero, take=None, count=COUNT):
    folder = ROOT/hero/take if take else ROOT/hero
    source = folder/'source.mp4'
    whole_video = take == 'idle-v4'
    cw, ch = (384, 576) if whole_video else (CW, CH)
    reader = imageio_ffmpeg.read_frames(str(source))
    info = next(reader)
    frames = []
    for data in reader:
        im = Image.frombytes('RGB', info['size'], data)
        if not whole_video:
            im = im.resize((512, round(im.height*512/im.width)), Image.Resampling.LANCZOS)
        a = np.asarray(im).copy()
        edge = np.concatenate([a[:6].reshape(-1,3), a[-6:].reshape(-1,3)])
        pedestal = np.median(edge, axis=0)
        frames.append(np.clip(a.astype(float)-pedestal, 0,255).astype(np.uint8))
    if len(frames) < 2:
        raise RuntimeError('Source video is too short')
    fps = float(info['fps'])
    if whole_video:
        # Preserve the complete new take, in order; no endpoint cuts or reversed motion.
        indices = list(range(len(frames)))
        continuous = True
    else:
        tiny = [np.asarray(Image.fromarray(f).resize((80,140),Image.Resampling.BILINEAR)).astype(float) for f in frames]
        mask = tiny[0].max(2)>25
        minimum = max(8, len(frames)//2)
        costs = [(float(np.abs(tiny[n]-tiny[0])[mask].mean()), n) for n in range(minimum,len(frames))]
        error, end = min(costs) if costs else (99, len(frames)-1)
        adjacent = float(np.median([np.abs(tiny[n+1]-tiny[n])[mask].mean() for n in range(len(frames)-1)]))
        continuous = error <= max(3.0, adjacent*2.0)
        last = end-1 if continuous else len(frames)-1
        indices = np.linspace(0, last, min(count,last+1)).round().astype(int).tolist()
        indices = list(dict.fromkeys(indices))
    selected = [frames[i] for i in indices]
    aperture_spec_path = folder/'matte-fix/apertures.json'
    aperture_spec = json.loads(aperture_spec_path.read_text(encoding='utf-8')) if whole_video and aperture_spec_path.exists() else None
    if aperture_spec and list(info['size']) != aperture_spec['sourceSize']:
        raise RuntimeError('Aperture matte is configured for a different source video size')
    aperture_records = []
    cols = max(8, (len(selected)+6)//7) if whole_video else COLS
    if whole_video and cols*cw > 4096:
        raise RuntimeError('Whole source exceeds the 4096px preview atlas limit')
    first = bounds(frames[0])
    boxes = [bounds(f) for f in selected]
    baseline = first[3]
    mask_first = frames[0].max(2)>28
    yy, xx = np.indices(mask_first.shape)
    ys, xs = np.where(mask_first & (yy>=baseline-round((baseline-first[1])*.16)))
    foot_x = (float(xs.min())+float(xs.max()))/2
    left = max(0,min(b[0] for b in boxes)-4)
    top = max(0,min(b[1] for b in boxes)-4)
    right = min(frames[0].shape[1],max(b[2] for b in boxes)+4)
    bottom = min(frames[0].shape[0],max(b[3] for b in boxes)+4)
    extent = max(foot_x-left,right-foot_x)
    margin_x, margin_y = (32, 40) if whole_video else (20, 24)
    scale = min((cw-margin_x)/(2*extent),(ch-margin_y)/(bottom-top))
    dw, dh = round((right-left)*scale), round((bottom-top)*scale)
    ground_y = ch-(16 if whole_video else 10)
    tx = round(cw/2-(foot_x-left)*scale)
    ty = round(ground_y-(baseline-top)*scale)
    atlas = Image.new('RGBA',(cw*cols,ch*((len(selected)+cols-1)//cols)))
    cells, rects = [], {}
    frame_dir = folder/'frames'
    frame_dir.mkdir(exist_ok=True)
    for n,f in enumerate(selected):
        im = key_frame(f,18)
        if aperture_spec:
            im, record = key_apertures(f,im,frames[aperture_spec['referenceFrame']],aperture_spec)
            aperture_records.append({'sourceFrame':indices[n],**record})
        if not whole_video:
            rgb = np.asarray(im.convert('RGB'))
            alpha = np.asarray(im.getchannel('A')).copy()
            alpha[rgb.max(2)<=5] = 0
            im.putalpha(Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(.25)))
        im = im.crop((left,top,right,bottom)).resize((dw,dh),Image.Resampling.LANCZOS)
        cell = Image.new('RGBA',(cw,ch))
        cell.alpha_composite(im,(tx,ty))
        cell.save(frame_dir/f'idle-{n:02d}.png')
        cells.append(cell)
        if whole_video and (n+1)%8 == 0:
            print(f'packaged {n+1}/{len(selected)} whole-character frames',flush=True)
        x,y=(n%cols)*cw,(n//cols)*ch
        atlas.paste(cell,(x,y))
        rects[f'idle{n}']=[x,y,cw,ch]
    if whole_video:
        seconds = 4.0
        order,frame_durations = smooth_loop(len(cells),seconds)
    else:
        order = list(range(len(cells))) if continuous else list(range(len(cells)))+list(range(len(cells)-2,0,-1))
        seconds = (2.0 if continuous else 4.0) if take else 3.2
    manifest = {
        'frames':rects,'animation':{'frames':[f'idle{i}' for i in order],'seconds':seconds,'loop':True},
        'hero':hero,'groundAnchor':[cw/2,ground_y],
        'readyHeightPx':round((baseline-first[1])*scale,4),'displayHeight':170 if hero=='sniper' else 146,
        'cellSize':[cw,ch],
        'loopMethod':'adjacent forward/backward frames with cosine-eased turnarounds' if whole_video else ('continuous endpoint matched' if continuous else 'continuous forward/backward, slow breathing playback'),
        'source':{'file':'source.mp4','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                  'videoSize':info['size'],'fps':fps,'frameCount':len(frames),'indices':indices,
                  'jointCrop':[left,top,right,bottom],'fixedScale':scale,'fixedFootSource':[foot_x,baseline]},
        'blend':'straight RGBA; SRC_ALPHA / ONE_MINUS_SRC_ALPHA',
        'scope':'in-game full-character sniper art; user manual effect review' if hero == 'sniper' and whole_video else 'material preview, awaiting user manual review'
    }
    if whole_video:
        manifest['animation']['frameDurations'] = frame_durations
        manifest['processing'] = {
            'matte': 'native-resolution edge-connected black removal; internal dark clothing preserved',
            'spatial': 'one shared crop, scale and foot pivot; one final resize per full character frame',
            'temporal': 'every source frame forward/backward; cosine-eased frame durations; no hard last-to-first reset, skipping, crossfade or static-body composite',
            'sourceSeconds': len(frames)/fps,
            'playbackFps': len(order)/seconds,
            'playbackSeconds': seconds
        }
        manifest['processing']['loopRevision'] = 'v4-loop1'
        if aperture_spec:
            manifest['processing']['matteRevision'] = aperture_spec['revision']
            manifest['processing']['apertures'] = 'Independent tracked seeds for enclosed crossbow negative spaces; same black key tolerance as external background'
            (folder/'matte-fix/processing.json').write_text(json.dumps({'spec':aperture_spec,'frames':aperture_records},ensure_ascii=False,indent=2),encoding='utf-8')
    else:
        manifest['seamSelection'] = {'endpointMeanError':round(error,4),'medianAdjacentError':round(adjacent,4)}
    resource_name = f"sniper_idle_rebuild_{take.rsplit('-',1)[-1]}" if take else DESTINATIONS[hero]
    dest = folder/'unapplied-resource' if hero=='archer' else GAME/'assets/resources/ux'/resource_name
    dest.mkdir(parents=True,exist_ok=True)
    atlas.save(dest/'idle.png',optimize=True)
    (dest/'idle.frames.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (folder/'idle.frames.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    atlas.save(folder/'idle.png',optimize=True)
    for path, importer,ver in [(dest,'directory','1.2.0'),(dest/'idle.frames.json','json','2.0.1')]:
        meta=Path(str(path)+'.meta')
        if not meta.exists():
            meta.write_text(json.dumps({'ver':ver,'importer':importer,'imported':True,
                'uuid':str(uuid.uuid4()),'files':['.json'] if importer=='json' else [],
                'subMetas':{},'userData':{}},indent=2),encoding='utf-8')
    thumb_w,thumb_h=192,288
    sheet=Image.new('RGB',(thumb_w*6,(thumb_h+25)*((len(cells)+5)//6)+36),'#e8ddc4')
    draw=ImageDraw.Draw(sheet)
    draw.text((12,8),LABELS[hero]+' · 完整待机序列帧',font=FONT,fill='#293d3e')
    for n,cell in enumerate(cells):
        x,y=(n%6)*thumb_w,36+(n//6)*(thumb_h+25)
        im=cell.resize((thumb_w,thumb_h),Image.Resampling.LANCZOS)
        sheet.paste(im,(x,y),im)
        draw.text((x+10,y+thumb_h+1),f'{n:02d} / 源帧 {indices[n]}',font=FONT,fill='#47565a')
    sheet.save(folder/'contact-sheet.jpg',quality=93)
    save_idle_preview(folder,hero,cells,manifest)
    report={'hero':hero,'uniqueFrames':len(cells),'timelineFrames':len(order),'seconds':seconds,
            'atlas':atlas.size,'bytes':(dest/'idle.png').stat().st_size,
            'resource':str(dest.relative_to(GAME)).replace('\\','/'),'sourceVideo':info,
            'loopMethod':manifest['loopMethod']}
    (folder/'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))

def reloop_existing(hero,take):
    """Retiming only: reuse the already keyed atlas without redoing the video or matte."""
    folder=ROOT/hero/take
    manifest=json.loads((folder/'idle.frames.json').read_text(encoding='utf-8'))
    report=json.loads((folder/'packaging.json').read_text(encoding='utf-8'))
    atlas=Image.open(folder/'idle.png').convert('RGBA')
    cells=[]
    for i in range(len(manifest['frames'])):
        x,y,w,h=manifest['frames'][f'idle{i}']
        cells.append(atlas.crop((x,y,x+w,y+h)))
    order,durations=smooth_loop(len(cells),4.0)
    manifest['animation']={'frames':[f'idle{i}' for i in order],'seconds':4.0,'loop':True,'frameDurations':durations}
    manifest['loopMethod']='adjacent forward/backward frames with cosine-eased turnarounds'
    manifest['processing'].update({
        'loopRevision':'v4-loop1',
        'temporal':'every source frame forward/backward; cosine-eased frame durations; no hard last-to-first reset, skipping, crossfade or static-body composite',
        'playbackSeconds':4.0,'playbackFps':len(order)/4.0
    })
    encoded=json.dumps(manifest,ensure_ascii=False,indent=2)
    (folder/'idle.frames.json').write_text(encoded,encoding='utf-8')
    (GAME/report['resource']/'idle.frames.json').write_text(encoded,encoding='utf-8')
    save_idle_preview(folder,hero,cells,manifest)
    report.update({'seconds':4.0,'timelineFrames':len(order),'loopMethod':manifest['loopMethod']})
    (folder/'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))

if __name__ == '__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--hero',choices=['archer','sniper'],required=True)
    ap.add_argument('--take',choices=['idle-v2','idle-v3','idle-v4'])
    ap.add_argument('--cells',type=int,default=COUNT)
    ap.add_argument('--loop-only',action='store_true',help='Retiming existing v4 keyed frames; no generation or matte changes')
    args=ap.parse_args()
    if args.loop_only:
        if args.take != 'idle-v4':
            ap.error('--loop-only requires --take idle-v4')
        reloop_existing(args.hero,args.take)
    else:
        build(args.hero,args.take,args.cells)
