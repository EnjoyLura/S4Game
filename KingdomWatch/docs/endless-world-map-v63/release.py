"""Inspect source/package identities and stage the production build; never execute game code."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
before = json.loads(read(HERE / 'before.json'))
current = {p.relative_to(ROOT).as_posix(): sha(p)
           for name in ['assets/scripts', 'assets/resources', 'build-templates', 'tools']
           for p in (ROOT / name).rglob('*') if p.is_file()}
assert set(before) <= set(current), 'Original files were removed'
changed = sorted(n for n, h in before.items() if current[n] != h)
added = sorted(set(current) - set(before))
assert len(changed) == 10 and len(added) == 8, (changed, added)
assert current['assets/scripts/battle/Hero.ts'] == before['assets/scripts/battle/Hero.ts']
def diagnostics(value):
    return sorted(re.sub(r'\(\d+,\d+\)', '(LINE,COL)', line)
                  for line in value.splitlines() if re.match(r'^assets/.*error TS', line))
assert diagnostics(read(HERE/'types-before.log')) == diagnostics(read(HERE/'types-after.log'))
assert len(diagnostics(read(HERE/'types-after.log'))) == 10
image = ROOT/'assets/resources/scenes/bg_endless_world_v63.png'
assert sha(image) == sha(ROOT/'docs/endless-world-map-concept-v61/world-map-placeholder-v61.png')
meta = json.loads(read(Path(str(image)+'.meta')))
assert meta['subMetas']['f9941']['userData']['width'] == 1024
assert meta['subMetas']['f9941']['userData']['height'] == 1536
web = ROOT/'build/web-mobile'
release = json.loads(read(web/'web-release.json'))
prior_doc = ROOT/'docs/endless-challenge-v59'
prior = Path(json.loads(read(prior_doc/'deployment-stage.json'))['stage'])
assert release['production'] and release['md5Cache']
assert release['engineRevision'] == json.loads(read(prior_doc/'web-release.json'))['engineRevision']
assert '__KW_GET_DPR_CAP ? window.__KW_GET_DPR_CAP()' in read(next((web/'cocos-js').glob('_virtual_cc-*.js')))
bundle = next((web/'assets/main').glob('index.*.js'))
code = read(bundle)
markers = ['endlessWorldMapPage', 'endlessMapViewport', 'endlessChapterDirectory',
           'endlessPrepare', 'endlessFormation', 'endlessStartBattle', 'endlessEquipmentWell',
           'endlessLootCatalog', 'bg_endless_world_v63', 'endlessPage', 'endlessReturn',
           'volt_strikes', 'volt_stun', 'goblin_king_walk_v1']
for marker in markers:
    assert marker in code, marker
assert 'baseEndlessDialog' not in code
assert '.prototype.ultShowDuration' not in code
media = {p.relative_to(prior).as_posix(): sha(p) for p in (prior/'assets/resources/native').rglob('*') if p.is_file()}
for name, value in media.items():
    assert sha(web/name) == value, name
new_media = [p for p in (web/'assets/resources/native').rglob('*') if p.is_file() and p.relative_to(web).as_posix() not in media]
assert len(new_media) == 1 and sha(new_media[0]) == sha(image), new_media
stage = ROOT/'build'/('publish-endless-world-map-v63-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copytree(web, stage, ignore=shutil.ignore_patterns('previews'))
shutil.copytree(prior/'previews', stage/'previews')
previews = [p for p in (prior/'previews').rglob('*') if p.is_file()]
for p in previews:
    assert sha(p) == sha(stage/'previews'/p.relative_to(prior/'previews'))
version = re.search(r'\?v=(\d+)', release['entry'])[1]
record = dict(originalFilesChecked=len(before), changedExistingFiles=changed, addedGameFiles=added,
              preExistingTypeErrors=10, typeDiagnosticsUnchanged=True,
              allOriginalNativeResourcesPreserved=len(media), newNativeMedia=[p.relative_to(web).as_posix() for p in new_media],
              priorPreviewFilesPreserved=len(previews), stage=str(stage), published=False,
              project='kingdom-watch', branch='main', entryVersion=version,
              game='https://kingdom-watch.pages.dev/?v=endless-world-map-v63-'+version,
              manualAcceptance='Static source/types/media/compiled bundle/build/read-only HTTP only. No game/browser/tests/simulation/audio executed. User manual acceptance.')
(HERE/'deployment-stage.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
for name in ['build-record.json', 'web-release.json']:
    shutil.copy2(web/name, HERE/name)
shutil.copy2(prior_doc/'publish.ps1', HERE/'publish.ps1')
print('Staged:', stage)
print('Preserved native resources:', len(media), '; prior previews:', len(previews))
print(record['game'])
