"""Prepare bounded static audits from the established release workflow."""
from pathlib import Path
import ast,json

ROOT=Path(__file__).resolve().parent
PREVIOUS=ROOT.parent/'mora-lobby-idle-v97'
FILES=['battle/FrostVFX','battle/FrostUltimateVFX','battle/UltimateTiming','battle/Hero',
       'core/AudioCatalog','core/Sfx','ui/Panels']


def main():
    s=(PREVIOUS/'audit_types.cjs').read_text(encoding='utf-8')
    start=s.index("const project=");end=s.index("const cp=",start)
    s=s[:start]+"const project=path.resolve(__dirname,'../..');\nconst originals=new Map("+json.dumps(['assets/scripts/'+f+'.ts' for f in FILES])+".map(name=>[path.resolve(project,name).toLowerCase(),fs.readFileSync(path.join(__dirname,'before',name),'utf8')]));\n"+s[end:]
    start=s.index(' host.getSourceFile=');end=s.index(' return ts.getPreEmitDiagnostics',start)
    s=s[:start]+" host.getSourceFile=(file,version,onError,fresh)=>{const original=before&&originals.get(path.resolve(file).toLowerCase());return typeof original==='string'?ts.createSourceFile(file,original,version,true):read(file,version,onError,fresh);};\n"+s[end:]
    (ROOT/'audit_types.cjs').write_text(s,encoding='utf-8')
    s=(PREVIOUS/'audit_export.py').read_text(encoding='utf-8')
    s=s.replace('79f84e4902c276fe','82cd4d43d27b7a5d').replace('v96 baseline','v97 baseline').replace('github-pages-mora-idle-v97','github-pages-frost-continuous-v98')
    s=s.replace("if changed!=['assets/scripts/ui/HeroLobbyIdle.ts']:","if changed!="+repr(sorted('assets/scripts/'+f+'.ts' for f in FILES))+":")
    start=s.index('    expected=sorted(');end=s.index('    added=',start)
    s=s[:start]+'    expected=[]\n'+s[end:]
    (ROOT/'audit_export.py').write_text(s,encoding='utf-8')
    s=(PREVIOUS/'verify_hosting.py').read_text(encoding='utf-8-sig')
    s=s.replace('github-pages-mora-idle-v97','github-pages-frost-continuous-v98')
    # Native media are unchanged. Check the new application bundle and resource configuration.
    start=s.index("    inventory=");end=s.index('    def check(',start)
    s=s[:start]+"    inventory=json.loads((PACKAGE/release['inventory']).read_text())['files']\n    targets=[name for name in inventory if name.endswith('.js') and name.startswith('assets/main/') or name.endswith('.json') and name.startswith('assets/resources/config.')]\n"+s[end:]
    (ROOT/'verify_hosting.py').write_text(s,encoding='utf-8')
    for p in ROOT.glob('*.py'):ast.parse(p.read_text(encoding='utf-8-sig'))
    print('Static audit sources prepared; no game executed.')


if __name__=='__main__':main()
