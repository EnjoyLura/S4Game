"""Bake continuous, forward-only source-video gait loops, with a fixed canvas per monster."""
from pathlib import Path
import hashlib
import json
import math
import uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent.parent
ASSETS = PROJECT / 'assets/resources/ux'
ATLAS = 'chapter1_mob_walk_v84'
CELL = 320
GAP = 4
COLS = 10
FPS = 24
# Half-open source-frame intervals: the next source frame is the phase reference,
# never appended as a duplicate endpoint. No reversal, blending, or synthetic frames.
LOOPS = {
    'orc_axeman': (21, 44, 30, '兽族斧兵', (300, 392, 490), (330, 450)),
    'orc_siege_cart': (17, 47, 17.5, '兽族攻城车', (790, 975, 1165), (920, 1030)),
    'goblin_slinger': (10, 33, 22.5, '兽族投石兵', (285, 380, 475), (330, 445)),
    'goblin_king': (8, 31, 17.5, '兽族将军（战猪行走）', (865, 978, 1100), (930, 1030)),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', size)


def contact(im, xr, start_y):
    arr = np.asarray(im.getchannel('A')) > 128
    x1, x2 = xr
    ys, xs = np.where(arr[start_y:, x1:x2])
    if not len(ys):
        raise ValueError('Missing foot contact')
    bottom = int(ys.max()) + start_y
    edge_xs = xs[ys >= ys.max() - 3] + x1
    return float(np.median(edge_xs)), bottom + 1


def make_meta(width, height):
    path = ASSETS / (ATLAS + '.png.meta')
    original = json.loads((ASSETS / 'goblin_king_walk_v1.png.meta').read_text())
    uid = json.loads(path.read_text())['uuid'] if path.exists() else str(uuid.uuid4())
    original = json.loads(json.dumps(original).replace(original['uuid'], uid).replace('goblin_king_walk_v1', ATLAS))
    data = original['subMetas']['f9941']['userData']
    data.update(width=width, height=height, rawWidth=width, rawHeight=height)
    data['vertices'].update(rawPosition=[-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
                            uv=[0,height,width,height,0,0,width,0],
                            minPos=[-width/2,-height/2,0], maxPos=[width/2,height/2,0])
    path.write_text(json.dumps(original, indent=2) + '\n', encoding='utf-8')
    path = ASSETS / (ATLAS + '.frames.json.meta')
    meta = json.loads((ASSETS / 'goblin_king_walk_v1.frames.json.meta').read_text())
    meta['uuid'] = json.loads(path.read_text())['uuid'] if path.exists() else str(uuid.uuid4())
    path.write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')


def save_four_gif(previews, durations):
    small = [im.resize((512,550),Image.Resampling.LANCZOS) for im in previews]
    # One palette prevents color flicker; the lightweight GIF is only a preview.
    palette_sheet = Image.new('RGB',(8*128,4*138))
    for i in range(32):
        sample = small[i*len(small)//32].resize((128,138),Image.Resampling.LANCZOS)
        palette_sheet.paste(sample,((i%8)*128,(i//8)*138))
    palette = palette_sheet.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
    quantized = [im.quantize(palette=palette,dither=Image.Dither.NONE) for im in small]
    quantized[0].save(ROOT/'four-monsters-preview.gif',save_all=True,append_images=quantized[1:],
                      duration=durations,loop=0,optimize=True,disposal=1)


def main():
    analysis = json.loads((ROOT / 'loop-candidates.json').read_text())
    count = sum(end-start for start,end,*_ in LOOPS.values())
    width, height = COLS*(CELL+GAP), math.ceil(count/COLS)*(CELL+GAP)
    atlas = Image.new('RGBA', (width, height))
    manifest = {'frames': {}, 'cycles': {}, 'walkSpeeds': {}, 'ground': {}, 'topRatios': {}}
    report = {'source': json.loads((ROOT/'source-info.json').read_text()), 'fps': FPS,
              'canvas': [CELL, CELL], 'atlas': [width, height], 'loops': {},
              'method': 'forward consecutive frames; only cart camera zoom stabilized before a fixed union crop; no blending or reversal'}
    all_frames = {}
    slot = 0
    for name, (start,end,speed,label,foot_ranges,head_range) in LOOPS.items():
        info = analysis[name]
        images = [Image.open(ROOT/'cutouts'/name/f'{i:03d}.png').convert('RGBA') for i in range(start,end)]
        boxes = [im.getchannel('A').point(lambda v: 255 if v>0 else 0).getbbox() for im in images]
        # One bounding union across the selected cycle. Every source pixel uses the same transform.
        box = (min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
        rw, rh = box[2]-box[0], box[3]-box[1]
        scale = min((CELL-24)/rw, (CELL-24)/rh, 1.25)
        target = (round(rw*scale), round(rh*scale))
        offset = ((CELL-target[0])//2,CELL-12-target[1])
        folder = ROOT/'frames'/name
        folder.mkdir(parents=True, exist_ok=True)
        frames, feet, top_ratios = [], [], []
        for index,im in enumerate(images):
            cel = Image.new('RGBA',(CELL,CELL))
            cel.paste(im.crop(box).convert('RGBa').resize(target,Image.Resampling.LANCZOS).convert('RGBA'),offset)
            cel.save(folder/f'{index:03d}.png', optimize=True)
            frames.append(cel)
            x = slot%COLS*(CELL+GAP); y = slot//COLS*(CELL+GAP)
            atlas.paste(cel,(x,y))
            rect = [x,y,CELL,CELL]
            manifest['frames'][name+f'_w{index}'] = rect
            if index==0: manifest['frames'][name] = rect
            slot += 1
            roi_x = info['roi'][0]
            a,m,b = [n-roi_x for n in foot_ranges]
            y0 = int(im.height*.67)
            points = [contact(im,(a,m),y0),contact(im,(m,b),y0)]
            row = []
            sx,sy = target[0]/rw,target[1]/rh
            for px,py in points:
                row.extend([round((offset[0]+(px-box[0])*sx-CELL/2)/CELL,6),
                            round((CELL-offset[1]-(py-box[1])*sy)/CELL,6)])
            feet.append(row)
            alpha = np.asarray(im.getchannel('A'))>128
            ys,_ = np.where(alpha[:,head_range[0]-roi_x:head_range[1]-roi_x])
            top_ratios.append((CELL-offset[1]-(int(ys.min())-box[1])*sy)/CELL)
        all_frames[name] = frames
        manifest['cycles'][name] = (end-start)/FPS
        manifest['walkSpeeds'][name] = speed
        manifest['ground'][name] = {'offset': min(min(f[1],f[3]) for f in feet), 'feet':feet}
        manifest['topRatios'][name] = round(max(top_ratios),6)
        candidate = next(c for c in info['candidates'] if c['start']==start and c['end']==end)
        report['loops'][name] = dict(label=label,sourceFrames=list(range(start,end)),
              seconds=(end-start)/FPS, referenceNextFrame=end, metrics=candidate,
              fixedSourceUnion=list(box),fixedTargetSize=list(target),fixedOffset=list(offset),
              feetBaseline=manifest['ground'][name]['offset'], topRatio=manifest['topRatios'][name])
        bgframes = []
        for im in frames:
            bg = Image.new('RGB', im.size, '#e5dccb'); bg.paste(im,mask=im.getchannel('A')); bgframes.append(bg)
        # GIF's 10ms clock approximates the 24fps source; the game uses exact frame timing.
        durations = [round((i+1)*100/FPS)*10-round(i*100/FPS)*10 for i in range(len(frames))]
        bgframes[0].save(ROOT/(name+'.gif'),save_all=True,append_images=bgframes[1:],
                         duration=durations,loop=0,optimize=False,disposal=2)
    atlas_path = ASSETS/(ATLAS+'.png')
    atlas.save(atlas_path,optimize=True)
    (ASSETS/(ATLAS+'.frames.json')).write_text(json.dumps(manifest,separators=(',',':'))+'\n',encoding='utf-8')
    make_meta(width,height)
    # The preview covers the exact LCM, with each independent gait at source speed.
    # Stream a compact MP4 instead of retaining hundreds of RGB frames for a huge GIF.
    import imageio.v2 as iio
    period=math.lcm(*(len(frames) for frames in all_frames.values()))
    def four(tick):
        preview=Image.new('RGB',(512,560),'#e5dccb');draw=ImageDraw.Draw(preview)
        for n,(name,frames) in enumerate(all_frames.items()):
            x,y=n%2*256,n//2*280
            draw.text((x+12,y+10),LOOPS[name][3],font=font(15),fill='#273d35')
            cel=frames[tick%len(frames)].resize((225,225),Image.Resampling.LANCZOS)
            preview.paste(cel,(x+15,y+40),cel)
        return preview
    four(0).save(ROOT/'four-monsters-preview.png')
    writer=iio.get_writer(ROOT/'four-monsters-preview.mp4',fps=24,codec='libx264',
        macro_block_size=1,ffmpeg_params=['-crf','19','-pix_fmt','yuv420p','-movflags','+faststart'])
    for tick in range(period):writer.append_data(np.asarray(four(tick)))
    writer.close()
    # Display the actual wrap and the original next frame together for visual inspection.
    seam=Image.new('RGB',(5*190,4*225),'#b8c9cb'); draw=ImageDraw.Draw(seam)
    for row,(name,frames) in enumerate(all_frames.items()):
        start,end,*_=LOOPS[name]
        samples=[frames[-2],frames[-1],frames[0],frames[1]]
        b=report['loops'][name]
        nxt=Image.new('RGBA',(CELL,CELL))
        nxt.paste(Image.open(ROOT/'cutouts'/name/f'{end:03d}.png').crop(b['fixedSourceUnion']).resize(b['fixedTargetSize'],Image.Resampling.LANCZOS),b['fixedOffset'])
        samples.append(nxt)
        for col,im in enumerate(samples):
            small=im.resize((185,185),Image.Resampling.LANCZOS)
            seam.paste(small,(col*190,row*225),small)
            draw.text((col*190+5,row*225+190),['last -1','last','FIRST','first +1','source next'][col],fill='#142d2d',font=font(15))
    seam.save(ROOT/'loop-seams.jpg',quality=96)
    report['cartCorrection']=json.loads((ROOT/'cart-stabilization.json').read_text())
    report['atlasSha256']=sha(atlas_path)
    report['frameCount']=count
    report['runtimeAssets']=[str(p.relative_to(PROJECT)).replace('\\','/') for p in sorted(ASSETS.glob(ATLAS+'*'))]
    (ROOT/'bake-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'frames':count,'atlas':[width,height],'pngBytes':atlas_path.stat().st_size,
                      'loops':{k:len(v) for k,v in all_frames.items()}},indent=2))


if __name__=='__main__':main()
