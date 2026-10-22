"""Offline asset verification only. Does not launch an engine or a browser."""
from pathlib import Path
import hashlib,json,math
import numpy as np
from PIL import Image,ImageSequence

HERE=Path(__file__).resolve().parent


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_animation(path,count,cycle):
    with Image.open(path) as im:
        assert im.n_frames==count,(path,im.n_frames)
        durations=[frame.info.get('duration',0) for frame in ImageSequence.Iterator(im)]
        assert abs(sum(durations)-cycle)<.01,(path,durations)
        assert im.info.get('loop')==0,path
    return {'frames':count,'cycle_ms':sum(durations)}


def main():
    rigs=json.loads((HERE/'rigs.json').read_text('utf-8'))
    sources=json.loads((HERE/'sources.json').read_text('utf-8'))
    result={'scope':'Offline image, atlas, geometry and source-preservation checks; no game/browser/audio execution.',
            'visual_approval':'Pending user review; geometric continuity does not prove natural motion.',
            'monsters':{},'preserved_original_files':{},'input_copies':{}}
    for row in sources['inputs']:
        path=HERE/'inputs'/f'{row["id"]}.png'
        assert digest(path)==row['sha256']==row['copied_sha256']
        result['input_copies'][row['id']]=row['sha256']
    for path,expected in sources['protected_legacy_files'].items():
        source=Path(path)
        if not source.is_file():
            result['preserved_original_files'][path]='Not available on this machine; archived hash retained.'
            continue
        assert digest(source)==expected,path
        result['preserved_original_files'][path]=expected
    for key,cfg in rigs.items():
        folder=HERE/key;paths=sorted((folder/'frames').glob('*.png'))
        assert len(paths)==32,(key,len(paths))
        frames=[Image.open(p).convert('RGBA') for p in paths]
        assert all(im.size==(512,512) for im in frames)
        pixels=[np.asarray(im) for im in frames]
        assert len({hashlib.sha256(p.tobytes()).hexdigest() for p in pixels})==32,key
        padding=min(min(im.getbbox()[:2]+tuple(512-v for v in im.getbbox()[2:])) for im in frames)
        assert padding>=16,(key,padding)
        assert all(int(p[:,:,3].max())==255 and int(p[:,:,3].min())==0 for p in pixels)
        for size in (512,256):
            meta=json.loads((folder/f'atlas-{size}.json').read_text('utf-8'))
            assert meta['frame_count']==32 and meta['cycle_ms']==cfg['cycle_ms']
            assert meta['duplicate_endpoint'] is False
            pivot=meta['pivot_top_left_normalized']
            assert all(math.isfinite(v) and 0<=v<=1 for v in pivot)
            with Image.open(folder/meta['atlas']) as atlas:
                assert atlas.size==(size*8,size*4)
                for i,frame in enumerate(frames):
                    rect=meta['frames'][f'{key}_{i:03d}']
                    x,y,w,h=rect
                    actual=np.asarray(atlas.crop((x,y,x+w,y+h)))
                    expected=np.asarray(frame.resize((size,size),Image.Resampling.LANCZOS))
                    assert np.array_equal(actual,expected),(key,size,i)
        with Image.open(HERE/'legacy'/f'{key}.png') as legacy:
            assert legacy.size==(4096,2048),'Comparison uses the same 512px cells.'
        v=json.loads((folder/'validation.json').read_text('utf-8'))
        assert v['phases']>=129 and v['minimum_signed_cross_product']>0
        assert v['periodic_position_max_error']<1e-6
        assert v['periodic_velocity_max_error']<1e-4
        assert v['camera']['common_with_legacy'] is True
        if cfg['type']=='flight':
            assert v['root_collar_relative_motion_max']<1e-7
            assert len(v['wing_body_connected_frames'])==32 and all(v['wing_body_connected_frames'])
        animations={name:inspect_animation(folder/name,32,cfg['cycle_ms']) for name in ('preview.gif','preview.apng','old-new.gif')}
        changes=[float(np.mean(np.abs(pixels[(i+1)%32].astype(float)-pixels[i].astype(float)))) for i in range(32)]
        result['monsters'][key]={
            'frames':32,'dimensions':[512,512],'minimum_transparent_margin_px':padding,
            'animations':animations,'atlases_match_every_frame':True,
            'dense_geometry_phases':v['phases'],'minimum_signed_cross_product':v['minimum_signed_cross_product'],
            'periodic_position_max_error':v['periodic_position_max_error'],
            'periodic_velocity_max_error':v['periodic_velocity_max_error'],
            'root_collar_relative_motion_max':v.get('root_collar_relative_motion_max'),
            'wing_connected_all_32_frames':all(v['wing_body_connected_frames']) if cfg['type']=='flight' else None,
            'mean_adjacent_pixel_difference':sum(changes)/32,
            'wrap_pixel_difference':changes[-1],
            'game_integrated':False,
        }
    result['galleries']={
        'quadruped-new.gif':inspect_animation(HERE/'quadruped-new.gif',32,1280),
        'flight-new.gif':inspect_animation(HERE/'flight-new.gif',48,1920),
        'biped-new.gif':inspect_animation(HERE/'biped-new.gif',32,1280),
    }
    result['passed']=True
    (HERE/'validation-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    inventory={p.relative_to(HERE).as_posix():{'bytes':p.stat().st_size,'sha256':digest(p)} for p in sorted(HERE.rglob('*'))
               if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.zip'
               and p.name not in ('asset-sha256.json','draft.jpg','draft-check.json')}
    (HERE/'asset-sha256.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':True,'monsters':len(rigs),'transparent_frames':160,'atlas_sizes':[512,256],
                      'wing_connectivity':'64/64 frames','minimum_margin_px':min(r['minimum_transparent_margin_px'] for r in result['monsters'].values()),
                      'inventoried_files':len(inventory)},ensure_ascii=False))


if __name__=='__main__':main()
