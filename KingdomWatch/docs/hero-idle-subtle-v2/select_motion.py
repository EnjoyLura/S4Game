"""Select an adjacent quiet source interval; never deform or synthesize body pixels."""
from pathlib import Path
import hashlib
import json
import sys
import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parent
GAME = ROOT.parents[1]
sys.stdout.reconfigure(encoding='utf-8')
SPECS = {
 'sniper': {'directory':'sniper-stance-idle-v3', 'resource':'sniper_stance_idle_v3',
  'points': {'hood_top':[448,158], 'hood_left':[365,252], 'shoulder_left':[290,360],
   'shoulder_right':[578,367], 'belt':[331,553], 'wrist':[249,347],
   'boot_left':[218,1017], 'boot_right':[595,1130], 'weapon':[245,214]}},
 'volt': {'directory':'volt-stance-idle-v2', 'resource':'volt_stance_idle_v2',
  'points': {'hood_top':[426,163], 'neck':[493,314], 'shoulder_left':[308,380],
   'shoulder_right':[576,378], 'belt':[448,590], 'wrist_left':[149,494],
   'wrist_right':[660,485], 'boot_left':[265,1157], 'boot_right':[569,1220], 'staff':[114,209]}}
}


def movement(first, current, point):
    x,y=point
    radius,search=10,14
    reference=first[y-radius:y+radius+1,x-radius:x+radius+1].astype(np.float32)
    area=current[y-radius-search:y+radius+search+1,x-radius-search:x+radius+search+1].astype(np.float32)
    windows=np.lib.stride_tricks.sliding_window_view(area,reference.shape[:2],axis=(0,1))
    windows=np.moveaxis(windows,2,-1)
    errors=np.mean((windows-reference)**2,axis=(2,3,4))
    iy,ix=np.unravel_index(errors.argmin(),errors.shape)
    dx,dy=float(ix-search),float(iy-search)
    def subpixel(before,center,after):
        denominator=2*(before-2*center+after)
        return float(np.clip((before-after)/denominator,-.5,.5)) if denominator>1e-6 else 0
    if 0<ix<errors.shape[1]-1:
        dx+=subpixel(errors[iy,ix-1],errors[iy,ix],errors[iy,ix+1])
    if 0<iy<errors.shape[0]-1:
        dy+=subpixel(errors[iy-1,ix],errors[iy,ix],errors[iy+1,ix])
    return [dx,dy,float(np.sqrt(errors[iy,ix]))]


def main():
    for hero,spec in SPECS.items():
        folder=GAME/'docs'/spec['directory']
        manifest=json.loads((folder/'idle.frames.json').read_text(encoding='utf-8'))
        reader=imageio_ffmpeg.read_frames(str(folder/'source.mp4'),pix_fmt='rgb24')
        info=next(reader)
        images=[np.frombuffer(data,np.uint8).reshape(info['size'][1],info['size'][0],3) for data in reader]
        game_scale=manifest['displayHeight']/manifest['readyHeightPx']*manifest['source']['fixedScale']
        rows=[]
        for index,frame in enumerate(images):
            markers={name:movement(images[0],frame,point) for name,point in spec['points'].items()}
            maximum=max(np.hypot(values[0],values[1])*game_scale for values in markers.values())
            rows.append({'sourceIndex':index,'maximumMarkerDisplacementInGameUnits':float(maximum),
                         'markers':markers})
        limit=.55
        end=0
        for row in rows[1:]:
            if row['maximumMarkerDisplacementInGameUnits']>limit:
                break
            end=row['sourceIndex']
        record={'hero':hero,'source':'../'+spec['directory']+'/source.mp4',
            'sourceSha256':hashlib.sha256((folder/'source.mp4').read_bytes()).hexdigest(),
            'sourceTask':json.loads((folder/'video-task.json').read_text(encoding='utf-8'))['taskId'],
            'sourceFrameCount':len(images),'sourceFps':info['fps'],
            'sourceToGameScale':game_scale,'bodyMarkerBudget':limit,
            'start':0,'end':end,'points':spec['points'],'frames':rows,
            'method':'Production source-range selection using reference-patch displacement; only retained complete original frames are packed, no pixel deformation',
            'review':'User manual review; this source selection is not game/browser/effect acceptance'}
        (ROOT/(hero+'-motion-selection.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'hero':hero,'selected':[0,end],'frameCount':end+1,
            'maxSelectedBodyMotion':max(row['maximumMarkerDisplacementInGameUnits'] for row in rows[:end+1]),
            'bodyMotionFullClip':max(row['maximumMarkerDisplacementInGameUnits'] for row in rows)},ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
