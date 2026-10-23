"""Plan/verify a reversible local archive of audio absent from the full catalog.

No sound playback, signal processing, engine or game execution.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / 'assets'
REPORT = PROJECT / 'docs/resource-other-v89'
ARCHIVE = PROJECT.parent / '.local-art-archive/audio-v89'


def sha(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def records():
    return {p.relative_to(ASSETS).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p)}
            for p in ASSETS.rglob('*') if p.is_file()}


def write(name, value):
    REPORT.mkdir(parents=True, exist_ok=True)
    (REPORT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')


def plan():
    subprocess.run(['C:/Program Files/nodejs/node.exe', str(PROJECT / 'tools/audit-audio-catalog.cjs'),
                    '--output', str(REPORT / 'audio-references.json')], check=True)
    reference = json.loads((REPORT / 'audio-references.json').read_text('utf-8'))
    required = set(reference['retainedAudioPaths'])
    audio = sorted(p for p in (ASSETS / 'resources/audio').rglob('*') if p.suffix in ('.wav', '.mp3'))
    uuids = {}
    for p in audio:
        meta = json.loads(p.with_suffix(p.suffix + '.meta').read_text('utf-8-sig'))
        uuids[meta['uuid']] = p
    serialized = []
    text_paths = [p for p in ASSETS.rglob('*') if p.is_file() and p.suffix in ('.json', '.scene', '.prefab', '.fire', '.mtl', '.anim')]
    # Preserve direct serialized clip references even if not in the catalog.
    for p in text_paths:
        text = p.read_text('utf-8-sig')
        for uuid, audio_path in uuids.items():
            if uuid in text:
                key = audio_path.relative_to(ASSETS / 'resources').with_suffix('').as_posix()
                required.add(key)
                serialized.append({'file': p.relative_to(PROJECT).as_posix(), 'audio': key, 'uuid': uuid})
    before = records()
    files = []
    retired_audio = []
    for p in audio:
        key = p.relative_to(ASSETS / 'resources').with_suffix('').as_posix()
        if key in required:
            continue
        retired_audio.append(p.relative_to(PROJECT).as_posix())
        for path in (p, p.with_suffix(p.suffix + '.meta')):
            name = path.relative_to(ASSETS).as_posix()
            if (ARCHIVE / name).exists():
                raise RuntimeError('Archive destination exists: ' + name)
            files.append({'asset': name, **before[name], 'reason': 'Absent from all declared cues/music and serialized audio UUID references'})
    result = {'schema': 1, 'archive': str(ARCHIVE.resolve()), 'resourcesRoot': str((ASSETS / 'resources').resolve()),
              'catalogSha256': reference['catalogSha256'], 'allDeclaredCuesRetained': True,
              'declaredAudioFilesRetained': len(required), 'audioFilesBefore': len(audio),
              'retiredAudioFiles': len(retired_audio), 'retiredFilesIncludingMeta': len(files),
              'retiredSourceBytes': sum(row['bytes'] for row in files),
              'serializedAudioReferencesRetained': serialized, 'textFilesChecked': len(text_paths),
              'files': files, 'gameOrAudioStarted': False}
    write('source-before.json', before)
    write('retirement-plan.json', result)
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}, ensure_ascii=False))


def verify():
    before = json.loads((REPORT / 'source-before.json').read_text('utf-8'))
    plan = json.loads((REPORT / 'retirement-plan.json').read_text('utf-8'))
    removed = {row['asset']: row for row in plan['files']}
    expected = {name: row for name, row in before.items() if name not in removed}
    if records() != expected:
        raise RuntimeError('Surviving assets differ from the baseline')
    for name, row in removed.items():
        p = ARCHIVE / name
        if not p.is_file() or sha(p) != row['sha256'] or p.stat().st_size != row['bytes']:
            raise RuntimeError('Archive bytes changed: ' + name)
    retired_uuids = {json.loads((ARCHIVE / name).read_text('utf-8-sig'))['uuid'] for name in removed if name.endswith('.meta')}
    text_files = 0
    for path in ASSETS.rglob('*'):
        if not path.is_file() or path.suffix not in ('.ts', '.json', '.scene', '.prefab', '.fire', '.mtl', '.anim'):
            continue
        text_files += 1
        text = path.read_text('utf-8-sig')
        if any(uuid in text for uuid in retired_uuids):
            raise RuntimeError('Archived audio UUID is still referenced: ' + str(path))
    result = {'remainingAssetsUnchanged': len(expected), 'archivedFilesIntact': len(removed),
              'archivedBytes': plan['retiredSourceBytes'], 'allSurvivingAudioImagesFontsAndScriptsUnchanged': True,
              'remainingTextFilesWithNoArchivedUUIDReferences': text_files,
              'gameOrAudioStarted': False}
    write('source-verification.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('plan', 'verify'))
    args = parser.parse_args()
    plan() if args.mode == 'plan' else verify()
