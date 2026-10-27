from pathlib import Path
OUT=Path(__file__).resolve().parent;PREV=OUT.parent/'magic-bow-v138'
prefix=(PREV/'verify.cjs').read_text('utf-8').split('const config=isolated')[0].replace('magic-bow-v138','scythe-v139')
(OUT/'verify.cjs').write_text(prefix+(OUT/'verify-tail.cjs').read_text('utf-8'),encoding='utf-8')
s=(PREV/'render_review.py').read_text('utf-8').replace('magic-bow-v138','scythe-v139').replace('magic-bow-flow','scythe-flow').replace('magic-bow-fs','scythe-fs').replace('BowFlow','ScytheFlow')
s=s.replace('[.8,1.9,2.2] if kind==\'ultimate\' else [.3,.8,1.1]', '[.8,1.2,1.65] if kind==\'ultimate\' else [.3,.8,1.6]')
(OUT/'render_review.py').write_text(s,encoding='utf-8')
(OUT/'extend_fonts.py').write_text((PREV/'extend_fonts.py').read_text('utf-8'),encoding='utf-8')
print('Isolated cosmetic review tools prepared.')
