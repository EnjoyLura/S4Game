"""Offline reference and cache-policy inventory; never executes a game module."""
from pathlib import Path
from urllib.parse import urlsplit
import fnmatch
import hashlib
import json
import re

out = Path(__file__).resolve().parent
game = out.parents[1]
web = game / 'build/web-mobile'
release = json.loads((web / 'web-release.json').read_text(encoding='utf-8'))
html = re.sub(r'<!--[\s\S]*?-->', '', (web / 'index.html').read_text(encoding='utf-8'))
local_urls = re.findall(r'(?:src|href)="([^"]+)"', html)
local_urls += re.findall(r"System\.import\('\./([^']+)'\)", html)
for url in local_urls:
    parsed = urlsplit(url)
    if not parsed.scheme and not (web / parsed.path).is_file():
        raise RuntimeError('Missing HTML dependency: ' + url)
import_map_path, = (web / 'src').glob('import-map.*.json')
import_map = json.loads(import_map_path.read_text(encoding='utf-8'))
cc_url = import_map['imports']['cc']
cc_path = (import_map_path.parent / urlsplit(cc_url).path).resolve()
if not cc_path.is_file() or ('kwengine=' + release['engineRevision']) not in cc_url:
    raise RuntimeError('Invalid versioned cc import')
engine_links = []
for path in (web / 'cocos-js').glob('*.js'):
    source = path.read_text(encoding='utf-8')
    for match in re.finditer(r'[\x22\x27](\./[^\x22\x27]+\.js(?:\?kwengine=[a-f0-9]{16})?)[\x22\x27]', source):
        url = match.group(1)
        if not (path.parent / urlsplit(url).path).is_file():
            raise RuntimeError('Missing engine dependency: ' + url)
        if ('kwengine=' + release['engineRevision']) not in url:
            raise RuntimeError('Unversioned patched engine dependency: ' + url)
        engine_links.append({'from': path.name, 'to': url})
settings_path, = (web / 'src').glob('settings.*.json')
settings = json.loads(settings_path.read_text(encoding='utf-8'))
if settings['engine']['debug'] or not settings['assets']['bundleVers']:
    raise RuntimeError('Production MD5 build required')
resources_path, = (web / 'assets/resources').glob('config.*.json')
resources = json.loads(resources_path.read_text(encoding='utf-8'))
ux_source = (game / 'assets/scripts/ui/Ux.ts').read_text(encoding='utf-8')
ids_block = ux_source.split('export const UX_PRELOAD_IDS: string[] = [', 1)[1].split('];', 1)[0]
ids = re.findall(r"'([^']+)'", ids_block)
paths = {entry[0] for entry in resources['paths'].values()}
for key in ids:
    if 'ux/' + key + '/spriteFrame' not in paths:
        raise RuntimeError('Missing optional prewarm art: ' + key)
main, = (web / 'assets/main').glob('index.*.js')
compiled = main.read_text(encoding='utf-8')
if 'IdleWarmup' not in compiled or 'badge_lose' not in compiled:
    raise RuntimeError('Latest startup source missing from compiled bundle')
# Evaluate Pages' glob rules against every local file. Two Cache-Control values merge.
rules = []
for line in (web / '_headers').read_text(encoding='utf-8').splitlines():
    if line.startswith('/'):
        rules.append([line, []])
    elif line.strip().startswith('Cache-Control:'):
        rules[-1][1].append(line.strip().split(':', 1)[1].strip())
matched = []
for path in web.rglob('*'):
    if not path.is_file():
        continue
    url = '/' + path.relative_to(web).as_posix()
    policies = [policy for pattern, values in rules if fnmatch.fnmatchcase(url, pattern) for policy in values]
    if len(policies) > 1:
        raise RuntimeError('Conflicting cache rules: ' + url)
    if policies:
        matched.append({'path': url, 'policy': policies[0]})
before = json.loads((out / 'before-metrics.json').read_text(encoding='utf-8'))
after = json.loads((out / 'after-metrics.json').read_text(encoding='utf-8'))
record = {'mode': 'offline file inspection only', 'htmlDependencies': local_urls,
    'versionedEngineImports': engine_links, 'optionalWarmupArt': ids,
    'cachePolicyFileCount': len(matched), 'cachePolicyConflicts': 0,
    'mainBundle': main.relative_to(web).as_posix(),
    'mainBundleSha256': hashlib.sha256(main.read_bytes()).hexdigest(),
    'scriptsBeforeBytes': before['scriptsBytes'], 'scriptsAfterBytes': after['scriptsBytes'],
    'scriptBytesReductionPercent': round(100 * (1 - after['scriptsBytes'] / before['scriptsBytes']), 2),
    'offlineGzipEstimateReductionPercent': round(100 * (1 - after['scriptsGzipEstimateBytes'] / before['scriptsGzipEstimateBytes']), 2),
    'startupTimingMeasured': False, 'networkMeasured': False, 'gameExecuted': False}
(out / 'bundle-inspection.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: record[k] for k in ['cachePolicyFileCount', 'cachePolicyConflicts', 'scriptBytesReductionPercent', 'offlineGzipEstimateReductionPercent']}))
