from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
s=(ROOT/'docs/thunder-lance-v137/prepare-art.cjs').read_text(encoding='utf-8')
for a,b in [('thunder_lance_v137','magic_bow_v138'),('thunder-lance-v137','magic-bow-v138'),("id:'lance'","id:'arcane'"),
 ('exec-ffe6dc15-15c3-4cbd-9661-a768126f147d.png','exec-1408333f-233b-4530-b363-3aec25d82238.png'),
 ('exec-6709200a-cfcd-4b44-9260-c71f3ea23765.png','exec-df44ec1f-952d-4b0d-89a7-94adda26799d.png'),
 ('new_heroes_v137/','new_heroes_v138/'),('// v137 thunder lance atlas regions.','// v138 magic bow atlas regions.')]:s=s.replace(a,b)
(P/'prepare-art.cjs').write_text(s,encoding='utf-8')
