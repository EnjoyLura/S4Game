from pathlib import Path
import json,uuid
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1];PREV=OUT.parent/'scythe-v139'
meta=ROOT/'assets/scripts/ui/BattleTipLayout.ts.meta'
if not meta.exists():meta.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n',encoding='utf8')
(OUT/'audit_types.cjs').write_text((PREV/'audit_types.cjs').read_text('utf-8-sig').replace('034cdc8d','9c25c3c4'),encoding='utf8')
s=(PREV/'verify.cjs').read_text('utf8').split('const config=isolated')[0].replace('scythe-v139','lance-tips-v140')
(OUT/'verify.cjs').write_text(s+(OUT/'verify-tail.cjs').read_text('utf8'),encoding='utf8')
s=(OUT.parent/'thunder-lance-v137'/'render_review.py').read_text('utf8').replace('thunder-lance-v137','lance-tips-v140')
s=s.replace("['normal','recall-rain','ultimate']","['normal','rain','ultimate']").replace("[.08,.3,1.15] if kind=='ultimate' else [.1,.8,1.8]","[.4,.85,1.45] if kind=='ultimate' else [.2,.65,1.2]")
(OUT/'render_review.py').write_text(s,encoding='utf8')
(OUT/'verify_http.py').write_text((PREV/'verify_http.py').read_text('utf8'),encoding='utf8')
print('Review and audit tooling prepared.')
