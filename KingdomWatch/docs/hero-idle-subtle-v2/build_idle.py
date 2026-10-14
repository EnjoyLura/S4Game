"""Repack only quiet adjacent full frames; keep all original body pixels and geometry."""
from pathlib import Path
import copy
import json
import sys
import uuid
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
GAME=ROOT.parents[1]
sys.path.insert(0,str(GAME/'docs/hero-idle-rebuild-v1'))
from build_idle import smooth_loop,save_gif
sys.path.insert(0,str(GAME/'docs/volt-idle-v1'))
from package_idle import draw_frame
sys.stdout.reconfigure(encoding='utf-8')
FONT=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',16)
LOOP_SECONDS=4/1.3
SPECS={'sniper':('sniper-stance-idle-v3','sniper_idle_subtle_v2','重弩手'),
       'volt':('volt-stance-idle-v2','volt_idle_subtle_v2','雷法师')}


def main():
    for hero,(original,resource,label) in SPECS.items():
        selection=json.loads((ROOT/(hero+'-motion-selection.json')).read_text(encoding='utf-8'))
        indices=list(range(selection['start'],selection['end']+1))
        if len(indices)<2:
            raise RuntimeError('Preserve the source: quiet interval is too short for a living idle')
        source=GAME/'docs'/original
        old=json.loads((source/'idle.frames.json').read_text(encoding='utf-8'))
        folder=ROOT/hero
        folder.mkdir(exist_ok=True)
        (folder/'frames').mkdir(exist_ok=True)
        destination=GAME/'assets/resources/ux'/resource
        destination.mkdir(parents=True,exist_ok=True)
        width,height=old['cellSize']
        atlas=Image.new('RGBA',(width*8,height*((len(indices)+7)//8)))
        cells,rects=[],{}
        for i,index in enumerate(indices):
            cell=Image.open(source/'frames'/f'idle-{index:02d}.png').convert('RGBA')
            cell.save(folder/'frames'/f'idle-{i:02d}.png',optimize=True)
            cells.append(cell)
            x,y=i%8*width,i//8*height
            atlas.paste(cell,(x,y))
            rects[f'idle{i}']=[x,y,width,height]
        order,durations=smooth_loop(len(cells),LOOP_SECONDS)
        manifest=copy.deepcopy(old)
        manifest['frames']=rects
        manifest['animation']={'frames':[f'idle{i}' for i in order], 'seconds':LOOP_SECONDS,
                               'frameDurations':durations,'loop':True}
        manifest['sourceOrder']=order
        manifest['source']['file']='../../'+original+'/source.mp4'
        manifest['source']['indices']=indices
        manifest['source']['redFieldPerFrame']=[old['source']['redFieldPerFrame'][i] for i in indices]
        manifest['source']['selectionRecord']='../'+hero+'-motion-selection.json'
        manifest['source']['selectedSeconds']=len(indices)/selection['sourceFps']
        manifest['processing']['temporal']=f'Quiet adjacent prefix only; the broad shoulder/waist/arm motion is excluded; adjacent frames forward/backward over {LOOP_SECONDS:.6f} seconds; 1.3x previous idle speed'
        manifest['processing']['spatial']='Original complete RGBA frame pixels, crop, scale, painted height and foot pivot copied exactly; no body deformation, part splitting, rescaling or opacity blend'
        manifest['staticMasterAcceptedByUser']=True
        manifest['animationAcceptedByUser']=False
        manifest['review']='Source selection and asset production only; effect acceptance by user, no tests/browser/game/online QA'
        atlas.save(destination/'idle.png',optimize=True)
        atlas.save(folder/'idle.png',optimize=True)
        encoded=json.dumps(manifest,ensure_ascii=False,indent=2)
        for target in [destination,folder]:
            (target/'idle.frames.json').write_text(encoded,encoding='utf-8')
        for path,importer,version in [(destination,'directory','1.2.0'),(destination/'idle.frames.json','json','2.0.1')]:
            meta=Path(str(path)+'.meta')
            if not meta.exists():
                meta.write_text(json.dumps({'ver':version,'importer':importer,'imported':True,
                    'uuid':str(uuid.uuid4()),'files':['.json'] if importer=='json' else [],
                    'subMetas':{},'userData':{}},indent=2),encoding='utf-8')
        previews=[]
        for i in order:
            canvas=Image.new('RGBA',(840,510),'#293c3b')
            draw=ImageDraw.Draw(canvas)
            draw.text((20,10),label+' · 轻微待机 / 镜像',font=FONT,fill='#eef1e4')
            draw_frame(canvas,cells[i],manifest,210,486,380)
            draw_frame(canvas,cells[i],manifest,630,486,380,True)
            previews.append(canvas.convert('RGB'))
        save_gif(previews,folder/'idle-mirror.gif',LOOP_SECONDS,durations)
        report={'hero':hero,'resource':resource,'original':original,'sourceIndices':indices,
            'sourceTask':selection['sourceTask'],'uniqueFrames':len(cells),'timelineFrames':len(order),
            'loopSeconds':LOOP_SECONDS,'speedComparedToInitialSubtleV2':1.3,'displayHeight':manifest['displayHeight'],
            'readyHeightPx':manifest['readyHeightPx'],'groundAnchor':manifest['groundAnchor'],
            'atlas':list(atlas.size),'atlasBytes':(destination/'idle.png').stat().st_size,
            'newVideoSubmitted':False,'staticMasterAcceptedByUser':True,'animationAcceptedByUser':False,
            'gameIntegrated':False,'review':manifest['review']}
        (folder/'packaging.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
