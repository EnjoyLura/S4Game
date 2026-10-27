from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
s=(ROOT/'docs/thunder-lance-v137/render_review.py').read_text(encoding='utf-8')
for a,b in [('thunder-lance-v137','magic-bow-v138'),('thunder-lance-flow','magic-bow-flow'),('thunder-lance-fs','magic-bow-fs'),('LanceFlow','BowFlow'),
 ("['normal','recall-rain','ultimate']","['normal','skill','ultimate']"),("([.08,.3,1.15] if kind=='ultimate' else [.1,.8,1.8])","([.8,1.9,2.2] if kind=='ultimate' else [.3,.8,1.1])")]:s=s.replace(a,b)
(P/'render_review.py').write_text(s,encoding='utf-8')
s=(ROOT/'docs/thunder-lance-v137/audit_package.py').read_text(encoding='utf-8')
for a,b in [('github-pages-thunder-lance-v137','github-pages-magic-bow-v138'),('github-pages-sword-wind-ground-v136','github-pages-thunder-lance-v137'),
 ('thunder-lance-flow','magic-bow-flow'),("'thunder-lance'","'magic-bow'"),('len(native)==516','len(native)==518'),
 ("'mode>3.5' in frag and 'float cloud=' in frag","'mode<2.5' in frag and 'float cloud=' in frag"),('warmLanceFlight','warmMagicBowFlight'),('ThunderLanceHero','MagicBowHero'),
 ('ui_avatar_lance','ui_avatar_arcane'),('new_heroes_v137/lance_battle','new_heroes_v138/arcane_battle'),('wpn_starter_lance','wpn_starter_arcane'),('lance_unlock_skill','arcane_unlock_skill')]:s=s.replace(a,b)
(P/'audit_package.py').write_text(s,encoding='utf-8')
