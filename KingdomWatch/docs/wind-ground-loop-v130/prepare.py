"""Fixed-foot tornado axis correction + moving head/tail loop overlap.
Only offline raster processing. No engine, game, browser or audio execution.
"""
import hashlib,importlib.util,json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import imageio.v2 as iio
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/kw-wind-video-deps'))
import cv2
spec=importlib.util.spec_from_file_location('old_recipe',ROOT/'docs/wind-tornado-video-v129/prepare_video.py')
old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
COLS=8;OVERLAP=12;SPEED=2

def premult(image):
    a=np.asarray(image).astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:4];return a

def straight(p):
    a=p.copy();a[:,:,:3]/=np.maximum(a[:,:,3:4],1/255);a=np.clip(a,0,1)
    # Retain a fixed transparent gutter around each whole cel.
    a[:3,:,3]=a[-3:,:,3]=a[:,:3,3]=a[:,-3:,3]=0
    data=(a*255).round().astype(np.uint8);known=data[:,:,3]>0
    for _ in range(4):
        total=np.zeros(data.shape[:2]+(3,),np.uint16);count=np.zeros(data.shape[:2],np.uint16)
        for axis,step in [(0,-1),(0,1),(1,-1),(1,1)]:
            support=np.roll(known,step,axis);total+=np.roll(data[:,:,:3],step,axis).astype(np.uint16)*support[:,:,None];count+=support
        fill=~known&(count>0);data[fill,:3]=(total[fill]/count[fill,None]).round().astype(np.uint8);known|=fill
    return Image.fromarray(data)

def wind_axis(image):
    a=np.asarray(image).astype(np.float32);alpha=a[:,:,3]/255
    # A broad upper band measures the cone, not a single moving leaf/white tip.
    mass=alpha[45:125].sum(axis=0);return float(np.dot(mass,np.arange(image.width))/max(1,mass.sum()))

def stabilize(tiles,anchor):
    before=np.array([wind_axis(f) for f in tiles]);kernel=np.array([1,2,3,2,1],np.float32)/9
    centers=np.convolve(np.pad(before,(2,2),mode='edge'),kernel,mode='valid')
    out=[];ground_y=tiles[0].height*(1-anchor[1]);top_y=85;pad=16
    for image,center in zip(tiles,centers):
        w,h=image.size;p=premult(image);p=np.pad(p,((0,0),(pad,pad),(0,0)))
        yy,xx=np.indices((h,w+pad*2),np.float32)
        delta=float(center-w*anchor[0]);weight=np.clip((ground_y-yy)/(ground_y-top_y),0,1.35)
        # Shear the upper airflow around a fixed base, never rotate the dust footprint.
        warped=cv2.remap(p,xx+delta*weight,yy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        out.append(straight(warped))
    after=[wind_axis(f)-pad for f in out]
    return out,{'beforeUpperCenters':before.tolist(),'filteredUpperCenters':centers.tolist(),'afterUpperCenters':after,
        'fixedGroundRow':ground_y,'fixedGroundX':tiles[0].width*anchor[0]+pad,
        'beforeCenterRange':float(np.ptp(before)),'afterCenterRange':float(np.ptp(after)),
        'method':'height-weighted horizontal shear pinned to original ground row; no billboard rotation','sidePaddingPixels':pad}

def loop(tiles):
    output=list(tiles[OVERLAP:-OVERLAP]);pairs=[]
    for k in range(OVERLAP):
        a=premult(tiles[len(tiles)-OVERLAP+k]);b=premult(tiles[k])
        ga=cv2.cvtColor((a[:,:,:3]*255).astype(np.uint8),cv2.COLOR_RGB2GRAY)
        gb=cv2.cvtColor((b[:,:,:3]*255).astype(np.uint8),cv2.COLOR_RGB2GRAY)
        flow=lambda x,y:cv2.calcOpticalFlowFarneback(x,y,None,.5,4,25,6,7,1.5,0)
        ab=flow(ga,gb);ba=flow(gb,ga);yy,xx=np.indices(ga.shape,np.float32)
        # Pixel-centered weights keep every source cel's contribution nonzero,
        # while the first/last overlap is still almost entirely its natural end.
        t=(k+.5)/OVERLAP;t=t*t*(3-2*t)
        aa=cv2.remap(a,xx-t*ab[:,:,0],yy-t*ab[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        bb=cv2.remap(b,xx-(1-t)*ba[:,:,0],yy-(1-t)*ba[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        output.append(straight(aa*(1-t)+bb*t))
        pairs.append({'output':len(output)-1,'tailSource':len(tiles)-OVERLAP+k,'headSource':k,'headWeight':t})
    # All source images contribute: the two moving ends share a 12-frame overlap.
    return output,pairs

def preview(tiles,kind,manifest):
    font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
    bg=Image.open(ROOT/'assets/resources/scenes/scene_1_2.jpg').convert('RGBA')
    bg=bg.crop((int(bg.width*.22),int(bg.height*.23),int(bg.width*.78),int(bg.height*.73))).resize((460,520),Image.Resampling.LANCZOS)
    mobs=json.loads((ROOT/'assets/resources/ux/mobs_forest_v66.frames.json').read_text('utf8'))['frames']
    mob_sheet=Image.open(ROOT/'assets/resources/ux/mobs_forest_v66.png').convert('RGBA')
    x,y,w,h=mobs['forest_spider'];mob=mob_sheet.crop((x,y,x+w,y+h)).resize((74,round(74*h/w)),Image.Resampling.LANCZOS)
    scenes=[]
    for n,tile in enumerate(tiles):
        out=Image.new('RGB',(920,520));sw=manifest['cellSize'][0]
        width=360 if kind=='tornado' else 384
        height=round(width*manifest['cellSize'][1]/sw*manifest['displayHeightScale'])
        image=tile.resize((width,height),Image.Resampling.LANCZOS)
        anchor=manifest['groundAnchor'];xy=(round(230-width*anchor[0]),round(375-height*(1-anchor[1]))) if kind=='tornado' else (round(230-width*anchor[0]),round(290-height*(1-anchor[1])))
        for panel in range(2):
            canvas=bg.copy() if panel else Image.new('RGBA',(460,520),'#19282d')
            canvas.alpha_composite(image,xy)
            if kind=='eye':canvas.alpha_composite(mob,(195,240)) # Show intended ground-before-monster order.
            d=ImageDraw.Draw(canvas);d.rectangle((0,0,460,42),fill='#19282d');d.rectangle((0,465,460,520),fill='#19282d')
            d.text((14,12),('龙卷轴线稳定' if kind=='tornado' else '风眼贴地透视')+' · 2倍速',font=font,fill='#d5f3e5')
            d.text((14,474),f'{n+1:02d}/48 · 移动首尾重叠循环 · 60fps',font=font,fill='#d5f3e5')
            d.text((14,495),'离屏素材合成，未启动游戏',font=font,fill='#9cafac');out.paste(canvas.convert('RGB'),(460*panel,0))
        scenes.append(out)
    durations=[round((i+1)*1000/60)-round(i*1000/60) for i in range(len(tiles))]
    scenes[0].save(OUT/(kind+'-preview.webp'),save_all=True,append_images=scenes[1:],duration=durations,loop=0,quality=88,method=4)
    scenes[4].save(OUT/(kind+'-still.jpg'),quality=94)
    # Show the actual overlap and the wrap boundary without relying on a scalar error alone.
    sheet=Image.new('RGB',(240*6,220*2),'#19282d')
    for k,n in enumerate([34,35,36,38,40,42,44,45,46,47,0,1]):
        im=tiles[n].copy();im.thumbnail((220,190),Image.Resampling.LANCZOS)
        if kind=='eye':im=im.resize((im.width,round(im.height*.58)),Image.Resampling.LANCZOS)
        canvas=Image.new('RGBA',(240,220),'#19282d');canvas.alpha_composite(im,((240-im.width)//2,(190-im.height)//2))
        ImageDraw.Draw(canvas).text((10,197),str(n),font=font,fill='white');sheet.paste(canvas.convert('RGB'),(k%6*240,k//6*220))
    sheet.save(OUT/(kind+'-loop-contact.jpg'),quality=94)

def run(kind):
    prior=json.loads((ROOT/('docs/wind-tornado-video-v129/art-manifest-'+kind+'.json')).read_text('utf8'))
    source=Path(prior['sourceLocalArchive']);assert hashlib.sha256(source.read_bytes()).hexdigest()==prior['sourceSha256']
    cfg=old.CONFIGS[kind];reader=iio.get_reader(str(source));tiles=[old.key(frame,cfg) for frame in reader];reader.close();assert len(tiles)==60
    # Reuse the accepted key without keying a key or changing colors again.
    old_manifest=json.loads((ROOT/prior['assets'][1]['path']).read_text('utf8'))
    anchor=list(old_manifest['groundAnchor']);axis=None
    if kind=='tornado':
        tiles,axis=stabilize(tiles,anchor);anchor[0]=.5
    tiles,pairs=loop(tiles);count=len(tiles);assert count==48
    cell=tiles[0].size;atlas=Image.new('RGBA',(cell[0]*COLS,cell[1]*6))
    for i,tile in enumerate(tiles):atlas.paste(tile,(i%COLS*cell[0],i//COLS*cell[1]))
    asset=ROOT/prior['assets'][0]['path'];atlas.save(asset,optimize=True)
    manifest={'schema':1,'framePrefix':kind+'_','frameCount':count,'fps':30,'playbackSpeed':SPEED,
        'cellSize':cell,'groundAnchor':anchor,'visualWidthPerRadius':3.3 if kind=='tornado' else 2.7,
        'displayHeightScale':1 if kind=='tornado' else .58,'displayOffsetY':0 if kind=='tornado' else -18,
        'frames':{kind+'_'+str(i):[i%COLS*cell[0],i//COLS*cell[1],*cell] for i in range(count)}}
    manifest_path=ROOT/prior['assets'][1]['path'];manifest_path.write_text(json.dumps(manifest,indent=2)+'\n','utf8')
    meta=asset.with_name(asset.name+'.meta');m=json.loads(meta.read_text('utf8'));sf=m['subMetas']['f9941']['userData'];w,h=atlas.size
    sf.update(width=w,height=h,rawWidth=w,rawHeight=h);sf['vertices']={'rawPosition':[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],
        'indexes':[0,1,2,2,1,3],'uv':[0,h,w,h,0,0,w,0],'nuv':[0,0,1,0,0,1,1,1],'minPos':[-w/2,-h/2,0],'maxPos':[w/2,h/2,0]}
    meta.write_text(json.dumps(m,indent=2)+'\n','utf8')
    pm=[premult(t) for t in tiles];steps=[float(np.abs(pm[(i+1)%count]-pm[i]).mean()) for i in range(count)]
    for tile in tiles:
        a=np.array(tile)[:,:,3];assert not a[:3,:].any() and not a[-3:,:].any() and not a[:,:3].any() and not a[:,-3:].any()
    preview(tiles,kind,manifest)
    report={'source':str(source),'sourceSha256':prior['sourceSha256'],'sourceFrames':60,'frameCount':count,'allSourceFramesContribute':True,
        'directSourceIndices':list(range(12,48)),'overlapPairs':pairs,'reverseFreezeOrStillEndpointBridge':False,'axisStabilization':axis,
        'projection':{k:manifest[k] for k in ['cellSize','groundAnchor','visualWidthPerRadius','displayHeightScale','displayOffsetY']},
        'playbackSpeed':2,'playbackFPS':60,'loopSeconds':.8,'atlasPixels':atlas.size,'atlasRGBABytes':atlas.width*atlas.height*4,
        'adjacentPremultipliedMAE':steps,'wrapMAE':steps[-1],'medianStepMAE':float(np.median(steps)),
        'assets':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
            'uuid':json.loads(p.with_name(p.name+'.meta').read_text('utf8'))['uuid']} for p in [asset,manifest_path]],
        'limitations':['Optical-flow overlap is a synthesized loop, not a native closed source video. Fine leaves can soften in overlap.',
            'The cone axis is stabilized; natural rotating wind lobes retain their asymmetric outline.'],
        'gameEngineBrowserCombatAudioOrWasmStarted':False}
    (OUT/('art-manifest-'+kind+'.json')).write_text(json.dumps(report,indent=2)+'\n','utf8')
    print(json.dumps({'kind':kind,'frames':count,'fps':60,'wrapMAE':steps[-1],'medianStepMAE':float(np.median(steps)),
        'axisRangeBefore':axis and axis['beforeCenterRange'],'axisRangeAfter':axis and axis['afterCenterRange']}))

if __name__=='__main__':
    run(sys.argv[1])
