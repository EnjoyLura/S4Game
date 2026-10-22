"""Archive the same five existing RGBA stills and author new rotation-field rigs."""
from pathlib import Path
import hashlib,json,math,shutil,subprocess
from PIL import Image

HERE=Path(__file__).resolve().parent
PROJECT=HERE.parents[1]
OLD=HERE.parent/'code-monster-templates-v3'
WALK=HERE.parent/'code-monster-walk-v2'


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def op(kind,pivot,falloff,curve,polygon,**extra):
    return {'type':kind,'pivot':pivot,'falloff':falloff,'curve':curve,'polygon':polygon,**extra}


def main():
    (HERE/'inputs').mkdir(exist_ok=True);(HERE/'legacy').mkdir(exist_ok=True)
    original=json.loads((OLD/'rigs.json').read_text('utf-8'))
    rows=json.loads((OLD/'sources.json').read_text('utf-8'))
    oldmeta={row['id']:row for row in rows}
    configs={};sources=[]
    pi=math.pi
    worker={
      'label':'哥布林苦工','type':'biped','cycle_ms':1280,'count':32,
      'source_size':[1254,1254],'pivot':[625,1104],
      'global':{'pivot':[625,735],'roll':-.65,'sway':6.5,'bob':4.5},
      'operations':[],
      'legacy_work_affine':{'scale':1.,'offset':[0.,0.]},
      'legacy_work_size':[1254,1254],
      'legacy_bounds':json.loads((WALK/'goblin-code-walk.frames.json').read_text('utf-8'))['source_render_bounds'],
    }
    arms=[
      ('l',[458,521],[409,648],.1,4.8,[[425,477],[499,484],[521,545],[503,607],[466,671],[470,712],[433,749],[432,827],[427,875],[403,905],[417,995],[335,1108],[248,1132],[174,1062],[130,939],[132,724],[272,718],[314,642],[370,598],[405,563]]),
      ('r',[821,522],[884,691],pi+.1,6.2,[[794,481],[853,482],[877,542],[914,594],[952,636],[990,703],[1008,783],[1022,868],[1007,913],[974,954],[925,972],[875,949],[846,906],[854,848],[853,782],[822,733],[803,674],[783,603],[781,540]])]
    for side,root,elbow,phase,amplitude,poly in arms:
        worker['operations'].extend([
          op('rotation',root,[34,158],{'amplitude':amplitude,'phase':phase},poly,id='shoulder_'+side,feather=9),
          op('rotation',elbow,[30,140],{'amplitude':2.3,'phase':phase-.45},poly,id='elbow_'+side,feather=9),
        ])
    for side,phase,hip,knee,poly in [
      ('l',0,[540,825],[523,970],[[468,847],[600,847],[619,927],[611,990],[606,1152],[356,1152],[378,1021],[445,965],[454,898]]),
      ('r',pi,[747,825],[789,970],[[704,847],[834,846],[857,941],[876,1001],[965,1031],[976,1152],[695,1152],[696,978]])]:
        sign=-1 if side=='l' else 1
        worker['operations'].extend([
          op('rotation',hip,[38,165],{'amplitude':sign*2.4,'phase':phase},poly,id='hip_'+side,feather=12),
          op('rotation',knee,[25,105],{'amplitude':sign*4.8,'phase':phase,'kind':'lift'},poly,id='knee_'+side,feather=12),
          op('translation',hip,[65,210],{'amplitude':17,'phase':phase+pi/2,'lift_amplitude':-40,'lift_phase':-pi/2},poly,id='step_'+side,axis=[0,1],feather=12),
        ])
    configs['worker']=worker
    for key in ('snow_wolf','rift_hound'):
        old=original[key];meta=json.loads((OLD/key/'frames.json').read_text('utf-8'))
        cfg={'label':old['label'],'type':'quadruped','cycle_ms':1280,'count':32,'source_size':[1024,1024],
             'pivot':[520,900],'global':{'pivot':old['body_pivot'],'roll':.35,'sway':3.,'bob':3.5},
             'operations':[],'protect':old['head'],'legacy_work_affine':{'scale':1.,'offset':[0.,0.]},'legacy_work_size':[1024,1024],'legacy_bounds':meta['render_bounds']}
        cfg['operations'].append(op('rotation',old['tail_pivot'],[30,125],{'amplitude':old['tail_amplitude'],'phase':-.5},old['tail'],id='tail',feather=12))
        for i,leg in enumerate(old['legs']):
            phase=leg['phase']*math.tau;side=-1 if leg['id'].endswith('left') else 1
            poly=leg['mask'];root=leg['root'];knee=leg['knee'];hind=i>=2
            cfg['operations'].extend([
              op('rotation',root,[33,140],{'amplitude':side*(2.7 if hind else 3.4),'phase':phase},poly,id=leg['id']+'_root',feather=12),
              op('rotation',knee,[25,105],{'amplitude':side*4.5,'phase':phase,'kind':'lift'},poly,id=leg['id']+'_knee',feather=12),
              op('translation',root,[50,160],{'amplitude':old['stride']*.8,'phase':phase+pi/2,'lift_amplitude':-old['lift']*(.76 if hind else 1.),'lift_phase':-pi/2},poly,id=leg['id']+'_step',axis=[0,1],feather=12),
            ])
        configs[key]=cfg
    row=oldmeta['eagle'];sc=row['scale'];offset=[row['work_position'][i]-row['source_crop'][i]*sc for i in range(2)]
    eagle={'label':'老鹰','type':'flight','cycle_ms':960,'count':32,'source_size':[1536,1024],'pivot':[768,520],
      'flight':{'center_x':768,'roots':[[704,460],[832,460]],'root_falloff':[35,200],'tip_falloff':[260,470],
                'bias':.18,'amplitude':.68,'harmonic':.08,'tip_amplitude':.10,'tip_delay':.50,'bob':8,
                'central_falloff':[80,150],'tail_y':[555,730],'feet_y':[620,735],'tail_y_amplitude':4,'feet_x_amplitude':2},
      'layer_masks':{'body_width':90,'body_width_extra':25,'body_width_y':[550,610],'body_feather':7,'wing_x':[65,85],'wing_y':[563,590]},
      'legacy_work_affine':{'scale':sc,'offset':offset},'legacy_work_size':[1024,1024],
      'legacy_bounds':json.loads((OLD/'eagle/frames.json').read_text('utf-8'))['render_bounds']}
    configs['eagle']=eagle
    bat={'label':'蝙蝠','type':'flight','cycle_ms':640,'count':32,'source_size':[1024,1024],'pivot':[512,550],
      'flight':{'center_x':512,'roots':[[452,484],[573,484]],'root_falloff':[42,177],'tip_falloff':[210,385],
                'bias':.08,'amplitude':.65,'harmonic':.065,'tip_amplitude':.105,'tip_delay':.55,'bob':9,
                'central_falloff':[74,135],'tail_y':[580,670],'feet_y':[615,690],'tail_y_amplitude':3.4,'feet_x_amplitude':1.8},
      'layer_masks':{'body_width':88,'body_width_extra':10,'body_width_y':[555,610],'body_feather':8,'wing_x':[52,76],'wing_y':[600,630],
                     'head_protect':original['bat']['head'],'lower_body_y':[580,625]},
      'legacy_work_affine':{'scale':1.,'offset':[0.,0.]},'legacy_work_size':[1024,1024],
      'legacy_bounds':json.loads((OLD/'bat/frames.json').read_text('utf-8'))['render_bounds']}
    configs['bat']=bat
    protected={}
    for key,cfg in configs.items():
        src=WALK/'source-cutout.png' if key=='worker' else OLD/'sources'/('eagle-cutout.png' if key=='eagle' else key+'.png')
        target=HERE/'inputs'/f'{key}.png';shutil.copyfile(src,target)
        assert list(Image.open(src).size)==cfg['source_size']
        cfg['input']=f'inputs/{key}.png'
        old_atlas=WALK/'goblin-code-walk-atlas.png' if key=='worker' else OLD/key/'atlas.png'
        # Use equal 512px cells for both versions, avoiding a sharpness bias.
        with Image.open(old_atlas) as atlas:atlas.resize((512*8,512*4),Image.Resampling.LANCZOS).save(HERE/'legacy'/f'{key}.png')
        sources.append({'id':key,'canonical_input':str(src),'sha256':sha(src),'copied_sha256':sha(target),'source_size':cfg['source_size'],'legacy_atlas':str(old_atlas)})
        for path in (src,old_atlas,(WALK/'animate.py' if key=='worker' else OLD/'animate.py')):protected[str(path)]=sha(path)
    (HERE/'rigs.json').write_text(json.dumps(configs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (HERE/'sources.json').write_text(json.dumps({'inputs':sources,'protected_legacy_files':protected,'method_reference':'D:/AI/S5Game/docs/artifacts/eagle-flight-v1/bake_eagle_flight.py','method_reference_sha256':sha(Path('D:/AI/S5Game/docs/artifacts/eagle-flight-v1/bake_eagle_flight.py'))},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Archived the same five cutouts and original references; created new rigs.')


if __name__=='__main__':main()
