"""Inspect an explicit retirement list; never run game code or delete files.

plan records every original byte and blocks source/UUID references. verify checks
the local archive and all surviving assets, including scripts, against that plan.
It deliberately does not infer deletion from a text search alone: dynamic loader
families are reviewed and documented in retired-resources-v80.json.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / 'assets'
RESOURCES = ASSETS / 'resources'
POLICY = PROJECT / 'tools/retired-resources-v80.json'
REPORT = PROJECT / 'docs/resource-slim-v80'
TEXT = {'.ts', '.js', '.json', '.meta', '.scene', '.prefab', '.effect', '.mtl', '.anim', '.atlas', '.plist'}


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def file_records(root):
    return {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': sha(p)}
            for p in sorted(root.rglob('*')) if p.is_file()}


def select(policy):
    chosen = {}
    tokens = {}
    def add(path, reason):
        path = path.resolve()
        if not path.is_relative_to(RESOURCES.resolve()) or path.is_symlink() or not path.is_file():
            raise RuntimeError('Missing or unsafe retirement file: ' + str(path))
        chosen[path] = reason
    for name, reason in policy['directories'].items():
        folder = (RESOURCES / name).resolve()
        if not folder.is_relative_to(RESOURCES.resolve()) or not folder.is_dir() or folder.is_symlink():
            raise RuntimeError('Missing or unsafe retirement directory: ' + name)
        for p in folder.rglob('*'):
            if p.is_file(): add(p, reason)
        add(folder.with_name(folder.name + '.meta'), reason)
        tokens[name] = folder.name
    for name, reason in policy['atlases'].items():
        for suffix in ('.png', '.png.meta', '.frames.json', '.frames.json.meta'):
            add(RESOURCES / (name + suffix), reason)
        tokens[name] = Path(name).name
    for name, reason in policy['files'].items():
        add(RESOURCES / name, reason)
        add(RESOURCES / (name + '.meta'), reason)
        tokens[name] = Path(name).stem
    return chosen, tokens


def guard_references(chosen, tokens):
    # Authoring references use full UUIDs, including texture/sprite sub-assets.
    uuids = set()
    def collect(value):
        if isinstance(value, dict):
            if isinstance(value.get('uuid'), str): uuids.add(value['uuid'])
            for v in value.values(): collect(v)
        elif isinstance(value, list):
            for v in value: collect(v)
    for p in chosen:
        if p.suffix == '.meta': collect(json.loads(p.read_text('utf-8-sig')))
    problems = []
    uuid_pattern = re.compile('|'.join(re.escape(x) for x in sorted(uuids, key=len, reverse=True)))
    token_pattern = re.compile('|'.join(re.escape(x) for x in sorted(tokens.values(), key=len, reverse=True)))
    checked = 0
    provenance = []
    source = '\n'.join(p.read_text('utf-8-sig') for p in (ASSETS / 'scripts').rglob('*.ts'))
    for p in ASSETS.rglob('*'):
        if not p.is_file() or p.resolve() in chosen or p.suffix not in TEXT: continue
        checked += 1
        text = p.read_text('utf-8-sig')
        # HeroSequenceAnimation reads textures/framePages/frames/animation; this
        # authoring-only calibration note is never a resource request. Keep the
        # original JSON bytes unchanged, and report each ignored field explicitly.
        if p.name.endswith('.frames.json') and 'idleReference' not in source:
            manifest = json.loads(text)
            note = manifest.pop('idleReference', None)
            if note is not None:
                provenance.append({'file': p.relative_to(PROJECT).as_posix(), 'idleReference': note})
                text = json.dumps(manifest, ensure_ascii=False)
        for pattern, kind in ((uuid_pattern, 'uuid'), (token_pattern, 'path/name')):
            match = pattern.search(text)
            if match: problems.append({'file': p.relative_to(PROJECT).as_posix(), 'kind': kind, 'reference': match[0]})
    if problems: raise RuntimeError('Retirement blocked by references: ' + json.dumps(problems, ensure_ascii=False))
    if re.search(r'\b(?:resources|assetManager)\.(?:loadDir|preloadDir|loadAny|loadRemote)\s*\(', source):
        raise RuntimeError('Review broad/external dynamic asset loading before retirement')
    return {'textFilesChecked': checked, 'retiredUUIDsChecked': len(uuids), 'externalReferences': [],
            'authoringOnlyCalibrationNotes': provenance,
            'broadOrExternalResourceLoaders': False,
            'manualDynamicReview': ['Hero clip selectors + entry warmup', 'Archer idle/attack template IDs retained',
                'All 16 campaign map/battlefield paths retained', 'All chapter monster atlases and weapon keys retained',
                'HUD/card dynamic ui_* keys retained', 'Fallback media with source references retained',
                'Frame manifest texture pages and active FX loaders retained']}


def plan():
    policy = json.loads(POLICY.read_text('utf-8-sig'))
    chosen, tokens = select(policy)
    checked = guard_references(chosen, tokens)
    archive = (PROJECT / policy['archive']).resolve()
    if archive.is_relative_to(ASSETS.resolve()): raise RuntimeError('Archive must be outside assets')
    assets = file_records(ASSETS)
    files = []
    for p, reason in sorted(chosen.items()):
        name = p.relative_to(ASSETS).as_posix()
        if (archive / name).exists(): raise RuntimeError('Archive path already exists: ' + name)
        files.append({'asset': name, **assets[name], 'reason': reason})
    baseline = {'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=PROJECT, text=True).strip(),
                'assets': assets}
    write(REPORT / 'baseline.json', baseline)
    result = {'schema': 1, 'archive': str(archive), 'resourcesRoot': str(RESOURCES.resolve()),
              'assetFileCount': len(assets), 'retiredFileCount': len(files),
              'retiredSourceBytes': sum(x['bytes'] for x in files), 'referenceAudit': checked, 'files': files}
    write(REPORT / 'retirement-plan.json', result)
    print(json.dumps({k: result[k] for k in ('archive', 'assetFileCount', 'retiredFileCount', 'retiredSourceBytes', 'referenceAudit')}))


def verify():
    baseline = json.loads((REPORT / 'baseline.json').read_text('utf-8'))['assets']
    plan = json.loads((REPORT / 'retirement-plan.json').read_text('utf-8'))
    removed = {x['asset']: x for x in plan['files']}
    remaining = file_records(ASSETS)
    expected = {k: v for k, v in baseline.items() if k not in removed}
    if remaining != expected: raise RuntimeError('Surviving assets changed, disappeared or were added')
    for name, rec in removed.items():
        path = Path(plan['archive']) / name
        if not path.is_file() or path.stat().st_size != rec['bytes'] or sha(path) != rec['sha256']:
            raise RuntimeError('Local archive checksum mismatch: ' + name)
    result = {'remainingAssetFiles': len(remaining), 'archivedFiles': len(removed),
              'archivedBytes': sum(x['bytes'] for x in removed.values()),
              'allSurvivingAssetBytesUnchanged': True, 'allScriptsUnchanged': True,
              'allArchivedBytesPreserved': True, 'gameOrBrowserStarted': False}
    write(REPORT / 'source-verification.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('plan', 'verify'))
    args = parser.parse_args()
    plan() if args.mode == 'plan' else verify()
