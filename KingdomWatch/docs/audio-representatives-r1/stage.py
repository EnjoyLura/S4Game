"""Publish the new contextual previews with every prior published file preserved."""
from pathlib import Path
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ['src', 'href', 'poster'] and value:
                self.refs.append(value)


def main():
    old_record = json.loads((ROOT/'docs/audio-comparison-batches-v22/deployment-stage.json').read_text())
    prior = Path(old_record['stage']).resolve()
    if not (prior/'index.html').is_file():
        raise ValueError('Missing previous publication stage')
    record_path = HERE/'deployment-stage.json'
    record = json.loads(record_path.read_text()) if record_path.exists() else {}
    stage = Path(record.get('stage', str(ROOT/'build'/('publish-audio-representatives-r1-'+datetime.now().strftime('%Y%m%d-%H%M%S'))))).resolve()
    if not stage.is_relative_to((ROOT/'build').resolve()):
        raise ValueError('Stage must remain inside build')
    if not stage.exists():
        shutil.copytree(prior, stage)
    dest = stage/'previews/audio-representatives-r1'
    shutil.copytree(HERE/'preview', dest, dirs_exist_ok=True)
    refs = []
    for p in dest.glob('*.html'):
        parser = Links()
        parser.feed(p.read_text(encoding='utf-8'))
        refs.extend(parser.refs)
    manifest = json.loads((dest/'data.json').read_text(encoding='utf-8'))
    refs.append('data.json')
    durations = []
    for item in manifest['items']:
        refs.append(item['poster'])
        for side, clip in item['clips'].items():
            refs.append(clip['file'])
            if digest(dest/clip['file']) != clip['sha256']:
                raise ValueError('Video changed after rendering')
        durations.append(item['clips']['new']['seconds'])
    refs.extend(manifest['montage'][side] for side in ['old','new'])
    if sum(durations) != manifest['montage']['seconds']:
        raise ValueError('Montage duration mismatch')
    for ref in refs:
        url = urlsplit(ref)
        if url.scheme or ref.startswith('#'):
            continue
        p = (dest/unquote(url.path)).resolve()
        if not p.is_relative_to(dest.resolve()) or not p.is_file():
            raise ValueError('Broken local preview reference: '+ref)
    prior_files = [p for p in prior.rglob('*') if p.is_file()]
    changed = [str(p.relative_to(prior)) for p in prior_files
               if not (stage/p.relative_to(prior)).is_file() or digest(p) != digest(stage/p.relative_to(prior))]
    if changed:
        raise ValueError(f'Prior published files changed: {changed[:10]}')
    source_hashes = json.loads((HERE/'source-hashes.json').read_text(encoding='utf-8'))
    for rel, expected in source_hashes.items():
        if digest(ROOT/rel) != expected:
            raise ValueError('Original source changed: '+rel)
    forbidden = [str(p.relative_to(dest)) for p in dest.rglob('*') if p.suffix.lower() in ['.wav','.zip','.aiff','.flac']]
    if forbidden:
        raise ValueError('Public standalone audio not allowed: '+str(forbidden))
    report = dict(priorPublishedFilesCompared=len(prior_files), priorPublishedFilesChanged=changed,
                  gameEntrySHA256=digest(stage/'index.html'), representativeScenes=len(manifest['items']),
                  localReferencesChecked=len(refs), montageSeconds=sum(durations),
                  audioSourceFilesUnchanged=True, noStandaloneSonnissAudioPublished=True,
                  ranGame=False, ranBrowser=False, playedAudio=False, subjectiveQuality='pending user')
    (HERE/'stage-inspection.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    record.update(stage=str(stage), priorPublishedStage=str(prior), project='kingdom-watch', branch='main',
                  preview='https://kingdom-watch.pages.dev/previews/audio-representatives-r1/?v=representatives-r1',
                  scope='Seven synchronized sound direction sketches, 29-second montage, v21 comparisons; no game replacement',
                  gameReplaced=False, acceptance='pending user listening and explicit selection')
    record_path.write_text(json.dumps(record,indent=2),encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
