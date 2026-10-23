"""Static cache/package audit. Does not execute the launcher, worker or game."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
sys.path.insert(0, str(PROJECT / 'tools/github-pages'))
from export import validate_package


def sha(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def write(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', 'utf-8')


def assets():
    return {p.relative_to(PROJECT).as_posix(): sha(p) for p in sorted((PROJECT / 'assets').rglob('*')) if p.is_file()}


def snapshot():
    package = Path('D:/AI/kingdom-watch-pages')
    release = json.loads((package / 'hosting-release.json').read_text('utf-8'))
    inventory = json.loads((package / release['inventory']).read_text('utf-8'))
    for name, record in inventory['files'].items():
        if sha(package / name) != record['sha256']:
            raise RuntimeError('Baseline runtime changed: ' + name)
    if (HERE / 'baseline.json').exists():
        previous = json.loads((HERE / 'baseline.json').read_text('utf-8'))
        if previous['assets'] != assets() or previous['release'] != release:
            raise RuntimeError('Preserve the original baseline; source or runtime changed')
    write('baseline.json', {'release': release, 'files': inventory['files'], 'assets': assets(),
                            'entryHtml': (package / release['entry']).read_text('utf-8'),
                            'fullPackageBytes': sum(p.stat().st_size for p in package.rglob('*') if p.is_file() and '.git' not in p.parts)})
    print('Baseline recorded; no game, browser, worker, tests or WASM executed.')


def verify(package):
    config = json.loads((PROJECT / 'tools/github-pages/config.json').read_text('utf-8'))
    result = validate_package(package, config)
    baseline = json.loads((HERE / 'baseline.json').read_text('utf-8'))
    release = result['release']
    inventory = json.loads((package / release['inventory']).read_text('utf-8'))
    old, new = baseline['files'], inventory['files']
    changes = sorted(name for name in set(old) | set(new) if old.get(name) != new.get(name))
    expected = {'hosting-cache-sw.js', 'hosting-diagnostics.html', 'index.html'}
    if release['entry'] != baseline['release']['entry']:
        expected.update((release['entry'], baseline['release']['entry']))
    if set(changes) != expected:
        raise RuntimeError('Unexpected runtime changes: ' + repr(changes))
    if baseline['assets'] != assets():
        raise RuntimeError('Source game assets changed')
    normalize = lambda value: re.sub(r'\?v=\d+', '?v=BUILD_TIMESTAMP', value)
    if normalize((package / release['entry']).read_text('utf-8')) != normalize(baseline['entryHtml']):
        raise RuntimeError('Game entry changed beyond the original build timestamp')
    if release['runtime_cache']['scope'] != release['base_path']:
        raise RuntimeError('Cache registration is not confined to the project')
    syntax_dir = PROJECT / 'build/browser-cache-v90-syntax'
    syntax_dir.mkdir(parents=True, exist_ok=True)
    syntax = []
    scripts = [package / 'hosting-cache-sw.js', PROJECT / 'tools/github-pages/runtime-cache-client.js']
    for name in ('index.html', 'hosting-diagnostics.html'):
        html = (package / name).read_text('utf-8')
        for i, match in enumerate(re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script>', html)):
            if re.search(r'\bsrc\s*=', match[1]):
                continue
            path = syntax_dir / (name.replace('.', '-') + '-' + str(i) + '.js')
            path.write_text(match[2], 'utf-8')
            scripts.append(path)
    for path in scripts:
        check = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', str(path)], capture_output=True, text=True)
        if check.returncode:
            raise RuntimeError('JavaScript syntax error: ' + check.stderr)
        syntax.append(str(path))
    worker = (package / 'hosting-cache-sw.js').read_text('utf-8')
    client = (PROJECT / 'tools/github-pages/runtime-cache-client.js').read_text('utf-8')
    for forbidden in ('caches.delete(', '.addAll(', 'location.reload(', 'importScripts(', 'WebAssembly.', 'localStorage.'):
        if forbidden in worker or forbidden in client:
            raise RuntimeError('Unexpected cache side effect: ' + forbidden)
    required = ('request.mode === \'navigate\'', 'request.cache === \'no-store\'', 'request.headers.has(\'Range\')',
                "url.searchParams.has('diag')", "url.searchParams.has('check')", 'url.origin !== BASE.origin',
                'value.clients[event.clientId]', 'await sha(bytes) === record.sha256', 'usedBytes + record.bytes > LIMIT')
    for guard in required:
        if guard not in worker:
            raise RuntimeError('Cache guard missing: ' + guard)
    summary = {'checks': result, 'sourceAssetsUnchanged': len(baseline['assets']),
               'unchangedRuntimeFiles': sum(1 for name, meta in old.items() if new.get(name) == meta), 'runtimeFilesChangedOrAdded': changes,
               'baselineBytes': baseline['fullPackageBytes'], 'fullPackageBytes': result['full_package_bytes'],
               'addedPackageBytes': result['full_package_bytes'] - baseline['fullPackageBytes'],
               'entryUnchangedExceptOriginalBuildTimestamp': True, 'mainGameCodeUnchanged': True, 'syntaxOnlyFiles': syntax,
               'sourceReviewGuardsPresent': list(required), 'automaticWholePackagePrecache': False,
               'gameBrowserWorkerTestsAudioOrWasmExecuted': False,
               'manualChecksRemaining': ['Phone first visit, close/reopen and cached resource reuse',
                                         'Update with an old tab still open', 'Storage disabled/full and uncached offline resource recovery']}
    write('package-static-verification.json', summary)
    print(json.dumps({k: v for k, v in summary.items() if k not in ('checks', 'sourceReviewGuardsPresent', 'syntaxOnlyFiles')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('snapshot', 'verify'))
    parser.add_argument('--package', type=Path, default=PROJECT / 'build/github-pages-browser-cache-v90')
    args = parser.parse_args()
    snapshot() if args.mode == 'snapshot' else verify(args.package.resolve())
