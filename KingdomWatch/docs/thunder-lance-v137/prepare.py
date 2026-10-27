from pathlib import Path
root=Path(__file__).resolve().parents[2]
s=(root/'docs/space-sword-v127/prepare-art.cjs').read_text(encoding='utf-8')
s=s.replace('space_sword_v127','thunder_lance_v137').replace('space-sword-v127','thunder-lance-v137')
a=s.index("const base=");b=s.index('const template=',a)
s=s[:a]+"""const base='C:/Users/user/.codex/generated_images/01a178e6-4e37-7020-8745-0a52d3c09f24/';
const selection=[{id:'lance',figure:base+'exec-ffe6dc15-15c3-4cbd-9661-a768126f147d.png',icons:base+'exec-6709200a-cfcd-4b44-9260-c71f3ea23765.png'}];
"""+s[b:]
s=s.replace("new_heroes_v127/", "new_heroes_v137/")
s=s.replace('(index%4)*256+4','(index%2)*256+4').replace('Math.floor(index/4)*256+4','Math.floor(index/2)*256+4')
s=s.replace("save('abilities',iconParts,1024,512)","save('abilities',iconParts,512,512)")
s=s.replace('// v127 space/sword atlas regions.','// v137 thunder lance atlas regions.')
(Path(__file__).parent/'prepare-art.cjs').write_text(s,encoding='utf-8')
