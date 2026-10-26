"""Inspect exported shader bytes and blending metadata, without starting a renderer/game."""
import json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1];PACKAGE=ROOT/'build/github-pages-space-sword-rework-v128'
effect=next((PACKAGE/'assets/resources/import').rglob('*2dc448a9*.json'))
data=json.loads(effect.read_text('utf8'));shaders=data[5][0][2];techniques=data[5][0][3]
assert shaders and len(techniques)==1
for shader in shaders:
    assert not shader['samplerTextures'] and not shader['textures'] and not shader['samplers']
    for gl in ['glsl3','glsl1']:
        frag=shader[gl]['frag'];assert 'space-sword' in shader['name'] and 'vec4 frag' in frag
        assert 'edge*color.a,0.0)' in frag
blend=techniques[0]['passes'][0]['blendState']['targets'][0]
assert blend['blend'] and blend['blendSrc']==1 and blend['blendDst']==1
assert blend['blendSrcAlpha']==0 and blend['blendDstAlpha']==1
report={'path':effect.relative_to(PACKAGE).as_posix(),'sha256':hashlib.sha256(effect.read_bytes()).hexdigest(),
        'shaderPrograms':len(shaders),'noTextureDependencies':True,'blend':blend,'actualGameStarted':False}
(OUT/'compiled-effect-verification.json').write_text(json.dumps(report,indent=2)+'\n','utf8');print(json.dumps(report))
