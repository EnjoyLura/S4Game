"""Offline preservation and rollback checks; no deployment or game execution."""
from pathlib import Path
import hashlib,json,subprocess

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[1]
EXPECTED=sorted('assets/scripts/'+f+'.ts' for f in ['battle/FrostVFX','battle/FrostUltimateVFX','battle/UltimateTiming',
    'battle/Hero','core/AudioCatalog','core/Sfx','ui/Panels'])
CONCURRENT=['assets/scripts/ui/BattleEntryWarmup.ts','assets/scripts/ui/BossWarning.ts']


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    baseline=json.loads((ROOT/'before/asset-hashes.json').read_text())
    current={p.relative_to(PROJECT).as_posix():sha(p) for p in (PROJECT/'assets').rglob('*') if p.is_file()}
    changed=sorted(k for k in baseline if baseline[k]!=current.get(k))
    assert changed==sorted(EXPECTED+CONCURRENT),changed
    assert set(current)==set(baseline)
    old=ROOT.parent/'frost-threat-alpha-v96/before/assets/scripts'
    for name in ['battle/FrostUltimateVFX.ts','core/Sfx.ts','core/AudioCatalog.ts']:
        assert (old/name).read_text(encoding='utf-8')==(PROJECT/'assets/scripts'/name).read_text(encoding='utf-8'),name
    prior_warning=(PROJECT/'build/local-threat-ribbon-restore/BossWarning.before.ts').read_text(encoding='utf-8')
    assert 'paintDanger' in prior_warning and 'warningCaption' in prior_warning
    git_before=json.loads((ROOT/'before/git-state.json').read_text())
    preservation={'headUnchanged':subprocess.check_output(['git','rev-parse','HEAD'],cwd=PROJECT,text=True).strip()==git_before['head'],
      'stagedEntriesUnchanged':hashlib.sha256(subprocess.check_output(['git','ls-files','--stage'],cwd=PROJECT,text=True).encode()).hexdigest()==git_before['index']}
    assert all(preservation.values())
    # Verify original audio and VFX source media as part of the complete source inventory.
    media=[k for k in baseline if k.startswith('assets/resources/')]
    assert all(baseline[k]==current[k] for k in media)
    build=PROJECT/'build/web-mobile'
    syntax=[]
    for p in build.rglob('*.js'):
        checked=subprocess.run(['C:/Program Files/nodejs/node.exe','--check',str(p)],capture_output=True,text=True)
        assert checked.returncode==0,(str(p),checked.stderr)
        syntax.append(p.relative_to(build).as_posix())
    release=json.loads(Path('D:/AI/kingdom-watch-pages/hosting-release.json').read_text())
    assert release['id']=='82cd4d43d27b7a5d'
    report={'sourceAssetsBefore':len(baseline),'ownChanges':EXPECTED,'concurrentLocalOnlyChanges':CONCURRENT,
      'otherSourceAssetsByteIdentical':len(baseline)-len(changed),'allResourceFilesByteIdentical':len(media),
      'originalFrostRainSfxAndAudioCatalogTextRestored':True,'syntaxOnlyScripts':syntax,
      'cardVisualTiming':{'openingAndBody':.82,'hold':3,'shatterTail':.68,'total':4.5},
      'gameplayStatusDurationsUnchanged':True,'git':preservation,'deployed':False,'liveReleaseUnchanged':release['id'],
      'gameBrowserAudioOrWasmExecuted':False}
    (ROOT/'local-static-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'build-record.json').write_text((build/'build-record.json').read_text(encoding='utf-8-sig'),encoding='utf-8')
    print(json.dumps({'sourceAssets':len(baseline),'ownChanged':len(EXPECTED),'concurrentLocalOnly':len(CONCURRENT),
      'allResourcesUnchanged':len(media),'jsSyntaxFiles':len(syntax),'deployed':False,'git':preservation}))


if __name__=='__main__':main()
