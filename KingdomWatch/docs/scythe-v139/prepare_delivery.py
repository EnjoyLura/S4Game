from pathlib import Path
import json,subprocess
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1];PREV=OUT.parent/'magic-bow-v138'
s=(PREV/'prepare-art.cjs').read_text('utf-8').replace('magic_bow_v138','scythe_v139').replace('magic-bow-v138','scythe-v139').replace('new_heroes_v138','new_heroes_v139').replace('arcane','scythe')
s=s.replace('exec-1408333f-233b-4530-b363-3aec25d82238','exec-104d3833-b39b-42e1-9dff-58224031fdaa').replace('exec-df44ec1f-952d-4b0d-89a7-94adda26799d','exec-42f0b765-a0fc-41d3-a430-c22582764542').replace('// v138 magic bow atlas regions.','// v139 scythe atlas regions.')
if not (OUT/'prepare-art.cjs').exists(): (OUT/'prepare-art.cjs').write_text(s,encoding='utf-8')
s=(PREV/'audit_package.py').read_text('utf-8').replace('github-pages-magic-bow-v138','github-pages-scythe-v139').replace('github-pages-thunder-lance-v137','github-pages-magic-bow-v138').replace('len(native)==518','len(native)==520').replace('magic-bow-flow','scythe-flow').replace("'magic-bow'","'scythe'").replace("'float cloud='","'float shaft='").replace('warmMagicBowFlight','warmScytheFlight').replace('MagicBowHero','ScytheHero').replace('arcane','scythe').replace('new_heroes_v138','new_heroes_v139')
(OUT/'audit_package.py').write_text(s,encoding='utf-8')
(OUT/'verify_http.py').write_text((PREV/'verify_http.py').read_text('utf-8'),encoding='utf-8')
diff=subprocess.check_output(['git','diff','--','assets/scripts'],cwd=ROOT).decode('utf-8')
text=''.join(line[1:] for line in diff.splitlines() if line.startswith('+') and not line.startswith('+++'))
text+=''.join(p.read_text('utf-8') for p in (ROOT/'assets/scripts').rglob('Scythe*.ts'))
(OUT/'font-text.json').write_text(json.dumps({'text':text},ensure_ascii=False)+'\n',encoding='utf-8')
print('Art packing, glyph coverage, package and HTTP audit tools prepared.')
