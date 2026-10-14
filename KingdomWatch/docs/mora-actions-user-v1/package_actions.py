"""Package both complete ice-mage clips with fixed geometry, source timing and clean alpha."""
from pathlib import Path
import hashlib
import json
import sys
import uuid
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
from prepare_sources import keyer, bounds

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
sys.path.insert(0, str(GAME/'docs/hero-stance-rebuild-v1'))
from package_frames import boot_pivot
sys.path.insert(0, str(GAME/'docs/hero-idle-rebuild-v1'))
from build_idle import save_gif
from package_idle import draw_frame
sys.path.insert(0, str(GAME.parent/'美术/tools'))
from hero_frame_bounds import require_source_margin
from hero_idle_loop import idle_loop_timeline

CELL, GROUND, COLS = (512,512), (256,496), 8
PAINTED_HEIGHT, DISPLAY_HEIGHT, RELEASE = 468, 146, 22
FONT = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)

def write(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

def package(kind, take):
    folder, dest = OUT/take, GAME/f'assets/resources/ux/mora_{kind}_user_v1'
    reader = imageio_ffmpeg.read_frames(str(folder/'source.mp4'),pix_fmt='rgb24')
    info = next(reader)
    original = [Image.frombytes('RGB',info['size'],data) for data in reader]
    rgba_dir, cell_dir = folder/'rgba-frames', folder/'frames'
    rgba_dir.mkdir(exist_ok=True)
    cell_dir.mkdir(exist_ok=True)
    keyed, fields = [], []
    for i, frame in enumerate(original):
        rgba, field = keyer.key_green(frame)
        rgba.save(rgba_dir/f'frame-{i:03d}.png')
        keyed.append(rgba)
        fields.append(field)
    framing = require_source_margin(keyed,list(range(len(keyed))))
    boxes = [bounds(frame) for frame in keyed]
    foot = boot_pivot(keyed[0],boxes[0])
    scale = PAINTED_HEIGHT/(foot[1]-boxes[0][1])
    crop = [max(0,min(b[0] for b in boxes)-4),max(0,min(b[1] for b in boxes)-4),
            min(info['size'][0],max(b[2] for b in boxes)+4),min(info['size'][1],max(b[3] for b in boxes)+4)]
    left, top, right, bottom = crop
    dw, dh = round((right-left)*scale),round((bottom-top)*scale)
    tx, ty = round(GROUND[0]-(foot[0]-left)*scale),round(GROUND[1]-(foot[1]-top)*scale)
    if tx<0 or ty<0 or tx+dw>CELL[0] or ty+dh>CELL[1]:
        raise RuntimeError(f'Complete {kind} source exceeds the shared cell: {(tx,ty,dw,dh)}; never crop the character')
    atlas = Image.new('RGBA',(COLS*CELL[0],((len(keyed)+COLS-1)//COLS)*CELL[1]))
    if max(atlas.size)>4096:
        raise RuntimeError('This source requires paged textures, not a texture over 4096px')
    cells, rects = [], {}
    for i, rgba in enumerate(keyed):
        cell = Image.new('RGBA',CELL)
        cell.alpha_composite(rgba.crop(crop).resize((dw,dh),Image.Resampling.LANCZOS),(tx,ty))
        cell.save(cell_dir/f'{kind}-{i:03d}.png')
        x,y = i%COLS*CELL[0],i//COLS*CELL[1]
        atlas.paste(cell,(x,y))
        cells.append(cell)
        rects[f'{kind}{i}'] = [x,y,*CELL]
    seconds = len(cells)/info['fps']
    order, durations = list(range(len(cells))),[1/info['fps']]*len(cells)
    animation = {'frames': [f'{kind}{i}' for i in order],'seconds':seconds,'frameDurations':durations,'loop':kind=='idle'}
    contract = None
    if kind=='idle':
        order,durations,contract = idle_loop_timeline(len(cells),seconds)
        animation.update(frameDurations=durations)
    else:
        animation.update(releaseIndex=RELEASE,readyIndex=len(cells)-1,recoverySeconds=(len(cells)-RELEASE)/info['fps'])
    manifest = {'hero':'mora','frames':rects,'animation':animation,
        'groundAnchor':list(GROUND),'cellSize':list(CELL),'readyHeightPx':PAINTED_HEIGHT,'displayHeight':DISPLAY_HEIGHT,
        'sourceOrder':order,'source':{'file':'source.mp4','take':take,
            'sha256':hashlib.sha256((folder/'source.mp4').read_bytes()).hexdigest(),
            'videoSize':list(info['size']),'fps':info['fps'],'frameCount':len(cells),'indices':order,
            'jointCrop':crop,'fixedScale':scale,'fixedFootSource':foot,'greenFieldPerFrame':fields},
        'sourceFraming':framing,'userProvidedVideo':True,'fullSourceRequired':True,'allSourceFramesRetained':True,
        'reversePlayback':False,'gameIntegrated':True,'previewOnly':False,'gameVisualAcceptedByUser':False,
        'pairedResource':f'mora_{"attack" if kind=="idle" else "idle"}_user_v1',
        'processing':{'matte':'Green coverage, screen decontamination and edge spill removal; blue/white materials retained',
            'spatial':'One shared crop, scale and boot pivot per clip; matching canonical height and ground across clips',
            'temporal':'All source frames in chronological order; no omission, reversal, synthetic hold or opacity fade'},
        'blend':'straight RGBA; single full-opacity sprite'}
    if contract:
        manifest['loopContract'] = contract
    else:
        manifest['releaseAnnotation'] = 'Reference source frame 22: staff-forward release; actual game spell callback controls timing'
    dest.mkdir(parents=True,exist_ok=True)
    for directory in [folder,dest]:
        atlas.save(directory/f'{kind}.png',optimize=True)
        write(directory/f'{kind}.frames.json',manifest)
    for path,importer,version in [(dest,'directory','1.2.0'),(dest/f'{kind}.frames.json','json','2.0.1')]:
        meta = Path(str(path)+'.meta')
        if not meta.exists():
            write(meta,{'ver':version,'importer':importer,'imported':True,'uuid':str(uuid.uuid4()),
                'files':['.json'] if importer=='json' else [],'subMetas':{},'userData':{}})
    contact = Image.new('RGB',(7*128,36+((len(cells)+6)//7)*148),'#e8ddc4')
    draw = ImageDraw.Draw(contact)
    draw.text((12,8),'冰法师 · '+('完整待机' if kind=='idle' else '完整施法'),font=FONT,fill='#293b3a')
    for i,cell in enumerate(cells):
        x,y = i%7*128,36+i//7*148
        thumb = cell.resize((128,128),Image.Resampling.LANCZOS)
        contact.paste(thumb,(x,y),thumb)
        draw.text((x+6,y+128),f'{i:02d}',font=FONT,fill='#47565a')
    contact.save(folder/'contact-sheet.jpg',quality=94)
    origin = json.loads((folder/'source-origin.json').read_text(encoding='utf-8'))
    origin.update(kind=kind,resource=dest.name,gameIntegrated=True)
    write(folder/'source-origin.json',origin)
    report = {'kind':kind,'take':take,'resource':dest.name,'frames':len(cells),'fps':info['fps'],'seconds':seconds,
        'atlas':list(atlas.size),'paintedHeight':PAINTED_HEIGHT,'displayHeight':DISPLAY_HEIGHT,
        'groundAnchor':list(GROUND),'fullSourceRetained':True,'reversePlayback':False,
        'gameVisualAcceptedByUser':False,'paidTaskSubmitted':False}
    print(json.dumps(report,ensure_ascii=True),flush=True)
    return cells,manifest,report

def main():
    idle,im,ir = package('idle','take-b')
    attack,am,ar = package('attack','take-a')
    def gif(filename, phases, title):
        frames,durations = [],[]
        for cell,manifest,duration in phases:
            canvas = Image.new('RGBA',(840,510),'#293c3b')
            ImageDraw.Draw(canvas).text((20,10),title,font=FONT,fill='#eef1e4')
            draw_frame(canvas,cell,manifest,210,486,380)
            draw_frame(canvas,cell,manifest,630,486,380,True)
            frames.append(canvas.convert('RGB'))
            durations.append(duration)
        save_gif(frames,OUT/filename,sum(durations),durations)
    ip = list(zip(idle,[im]*len(idle),im['animation']['frameDurations']))
    ap = list(zip(attack,[am]*len(attack),am['animation']['frameDurations']))
    gif('idle-mirror.gif',ip,'冰法师 · 完整正向待机 / 镜像')
    gif('idle-attack-mirror.gif',ip+ap,'冰法师 · 待机 → 完整攻击 / 镜像')
    write(OUT/'packaging.json',{'hero':'mora','idle':ir,'attack':ar,'gameIntegrated':True,
        'previewOnly':False,'paidTaskSubmitted':False,'userVisualAccepted':False,
        'review':'User manual effect review; no tests, gameplay, browser or online QA'})

if __name__ == '__main__':
    main()
