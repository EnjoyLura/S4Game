"""Add card text to the pinned OFL subsets without dropping any existing character."""
import hashlib,json,sys
from pathlib import Path
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
sys.path.insert(0,str(ROOT/'temp/py-fonts'))
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
text=''.join((ROOT/p).read_text('utf-8-sig') for p in ['assets/scripts/config/Cards.ts','assets/scripts/ui/Panels.ts','assets/scripts/battle/Monster.ts'])
wanted={ord(c) for c in text if 0x4e00<=ord(c)<=0x9fff}
rows=[]
for name,folder,file,weight in [('UIBody','notosanssc','NotoSansSC[wght].ttf',500),('UIHeading','notoserifsc','NotoSerifSC[wght].ttf',750)]:
 target=ROOT/'assets/resources/fonts'/(name+'.ttf');old=TTFont(target);previous=set(old.getBestCmap());old.close()
 missing=wanted-previous;old_hash=hashlib.sha256(target.read_bytes()).hexdigest()
 if missing:
  source=ROOT/'temp/font-sources'/folder/file;font=TTFont(source)
  assert (previous|wanted)<=set(font.getBestCmap())
  options=subset.Options();options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
  sub=subset.Subsetter(options=options);sub.populate(unicodes=previous|wanted);sub.subset(font)
  font=instantiateVariableFont(font,{'wght':weight},inplace=True)
  for record in font['name'].names:
   if record.nameID in (1,4,6,16):record.string=('KW'+name).encode(record.getEncoding())
   elif record.nameID in (2,17):record.string='Regular'.encode(record.getEncoding())
   elif record.nameID==3:record.string=('KW-7085eb89a950-'+name).encode(record.getEncoding())
  font.save(target);font.close()
 packed=TTFont(target);current=set(packed.getBestCmap());packed.close()
 assert previous<=current and wanted<=current
 rows.append({'file':target.name,'added':''.join(map(chr,sorted(current-previous))),'priorGlyphs':len(previous),'glyphs':len(current),
  'oldCharactersPreserved':True,'beforeSha256':old_hash,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size})
report={'status':'PASS','cachedPinnedOflSourcesOnly':True,'fonts':rows}
manifest_path=ROOT/'assets/resources/fonts/manifest.json'
manifest=json.loads(manifest_path.read_text('utf8'))
for row in rows:
 for item in manifest['fonts']:
  if item['file']==row['file']:
   for key in ['sha256','bytes','glyphs']:item[key]=row[key]
manifest['glyphsRequested']+=max(len(row['added']) for row in rows)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf8')
(OUT/'font-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps(report,ensure_ascii=False))
