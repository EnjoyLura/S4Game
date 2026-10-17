"""Clone the last production release and verify unchanged files, offline only."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import shutil
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for key in ['href', 'src']:
            if key in values:
                self.refs.append(values[key])


def main():
    prior_record = json.loads((ROOT / 'docs/audio-overhaul-v21/deployment-stage.json').read_text(encoding='utf-8-sig'))
    prior = Path(prior_record['stage']).resolve()
    if not prior.is_dir() or not (prior / 'index.html').is_file():
        raise ValueError('Missing preserved production release')
    record_path = HERE / 'deployment-stage.json'
    if record_path.exists():
        stage = Path(json.loads(record_path.read_text(encoding='utf-8'))['stage']).resolve()
        if not stage.is_relative_to((ROOT / 'build').resolve()) or not stage.is_dir():
            raise ValueError('Existing stage is not the recorded build directory')
    else:
        stage = ROOT / ('build/publish-audio-comparison-batches-v22-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
        shutil.copytree(prior, stage)
    dest = stage / 'previews/audio-comparison-batches-v22'
    shutil.copytree(HERE / 'preview', dest, dirs_exist_ok=True)
    refs = []
    for html_path in dest.rglob('*.html'):
        parser = Links()
        parser.feed(html_path.read_text(encoding='utf-8'))
        refs.extend((html_path.parent, ref) for ref in parser.refs)
    for data_path in dest.rglob('data.json'):
        data = json.loads(data_path.read_text(encoding='utf-8'))
        if 'items' not in data:
            continue
        refs.append((data_path.parent, 'data.json'))
        for row in data['items']:
            for side in ['old', 'new']:
                if side in row:
                    audio = row[side].get('audio', row[side])
                    if 'file' not in audio:
                        raise ValueError(f'Missing audio file for {row.get("id")} {side}')
                    refs.append((data_path.parent, audio['file']))
            for option in row.get('options', []):
                refs.append((data_path.parent, option['audio']['file']))
            for example in row.get('examples', []):
                refs.append((data_path.parent, example['audio']['file']))
    for parent, ref in refs:
        parsed = urlsplit(ref)
        if parsed.scheme or ref.startswith('#'):
            continue
        path = (parent / unquote(parsed.path)).resolve()
        if path.is_dir():
            path = path / 'index.html'
        if not path.is_relative_to(stage.resolve()) or not path.is_file():
            raise ValueError(f'Broken local preview reference: {ref}')
    # Reading hashes never runs the packaged game or preview.
    prior_files = sorted(p for p in prior.rglob('*') if p.is_file())
    changed = [str(p.relative_to(prior)) for p in prior_files if not (stage / p.relative_to(prior)).is_file()
               or digest(p) != digest(stage / p.relative_to(prior))]
    if changed:
        raise ValueError(f'Unexpected production changes: {changed[:12]}')
    source_hashes = json.loads((HERE / 'source-hashes.json').read_text(encoding='utf-8'))
    for filename in ['growth-source-hashes.json', 'cartoon-source-hashes.json']:
        extra_hashes = json.loads((HERE / filename).read_text(encoding='utf-8'))
        for rel, expected in extra_hashes.items():
            workspace_rel = Path(rel)
            if workspace_rel.parts[0].lower() != 'assets':
                workspace_rel = HERE.relative_to(ROOT) / workspace_rel
            source_hashes[str(workspace_rel)] = expected
    if any(digest(ROOT / rel) != expected for rel, expected in source_hashes.items()):
        raise ValueError('Source audio changed during preparation')
    report = dict(priorFilesCompared=len(prior_files), priorFilesChanged=changed,
                  gameEntrySHA256=digest(stage / 'index.html'),
                  localPreviewReferencesChecked=len(refs),
                  newPreviewFiles=len([p for p in dest.rglob('*') if p.is_file()]),
                  sourceAudioUnchanged=True, offlineOnly=True,
                  ranGame=False, ranBrowser=False, playedAudio=False)
    (HERE / 'stage-inspection.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    record = dict(stage=str(stage), priorPublishedStage=str(prior), project='kingdom-watch', branch='main',
                  game=prior_record['game'],
                  preview='https://kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/?v=batch-01-r1',
                  growthPreview='https://kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/growth-r1/?v=growth-r1',
                  cartoonPreview='https://kingdom-watch.pages.dev/previews/audio-comparison-batches-v22/cartoon-r1/?v=cartoon-r1',
                  scope='Preview only: cartoon-r1 has 6 free casual/cartoon growth candidates and 3 repeat examples; earlier previews preserved',
                  gameReplaced=False, manualAcceptance='pending user listening and selection')
    record_path.write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
