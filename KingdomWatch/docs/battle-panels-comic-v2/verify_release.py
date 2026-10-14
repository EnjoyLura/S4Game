"""Check the published original-layout battle skins against the Creator build."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import sys
import tempfile

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
BUILD = GAME / 'build/web-mobile'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    index = (BUILD / 'index.html').read_text(encoding='utf-8')
    version = 'battle-skin-v2-' + re.search(r'index\.js\?v=(\d+)', index).group(1)
    entry = (BUILD / 'assets/main/index.js').read_text(encoding='utf-8')
    for token in ['BattlePanelSkin', 'battle_skin_v2/', 'battleStatBar', 'pickAdRefresh',
                  'pickDiamondRefresh', 'battleDouble', 'battleRevive', '暂 停',
                  '▶ 看广告双倍', '复活：耐久 +30%', 'baseUpperScene',
                  'trainingActionDock', 'bg_upgrade_comic_v1', 'bg_heroes_comic_v3',
                  'bg_levels_', '_comic_v2', 'shopShelfBackdrop', 'ABILITY_CARDS',
                  'skillUnlocked', 'ultUnlocked', 'canTakeCard', 'RAIN_CAP = 128']:
        assert token in entry, token
    panel = entry.split('System.register("chunks:///_virtual/Panels.ts"', 1)[1]
    panel = panel.split('System.register(', 1)[0]
    assert 'BattleComicPanels' not in panel, 'obsolete popup renderer is active'
    assert "FROST_RESOURCE = 'fx/frost_domain_video_v10'" in entry
    assert '__KW_DPR_CAP' in index
    engine = next(p for p in (BUILD / 'cocos-js').glob('_virtual_cc-*.js')
                  if 'window.__KW_DPR_CAP || 2' in p.read_text(encoding='utf-8'))
    files = {'index.html': 'index.html', 'main.js': 'assets/main/index.js',
             'resources-config.json': 'assets/resources/config.json',
             'dpr-engine.js': engine.relative_to(BUILD).as_posix()}
    specs = json.loads((OUT / 'assets.json').read_text(encoding='utf-8'))
    for resource in specs:
        source = Path(resource['file'])
        meta = json.loads(source.with_suffix(source.suffix + '.meta').read_text(encoding='utf-8'))
        uuid = meta['uuid']
        rel = f'assets/resources/native/{uuid[:2]}/{uuid}{source.suffix}'
        assert sha(source) == sha(BUILD / rel), resource['key'] + ' build mismatch'
        files[resource['key']] = rel

    def check(item):
        key, rel = item
        target = Path(tempfile.gettempdir()) / ('kw-battle-skin-v2-' + key.replace('.', '-') + Path(rel).suffix)
        subprocess.run(['curl.exe', '--fail', '--location', '--silent', '--show-error', '--retry', '2',
                        '--max-time', '30', '--proxy', 'http://127.0.0.1:10808', '--output', str(target),
                        'https://kingdom-watch.pages.dev/' + rel + '?v=' + version], check=True, capture_output=True)
        assert sha(target) == sha(BUILD / rel), key + ' online mismatch'
        return key, {'matchesLocal': True, 'bytes': target.stat().st_size,
                     'sha256': sha(target), 'path': rel}

    with ThreadPoolExecutor(max_workers=4) as pool:
        matches = dict(pool.map(check, files.items()))
    reports = {name: json.loads((OUT / (name + '.json')).read_text(encoding='utf-8'))
               for name in ['ui-validation', 'online-validation']}
    assert all(report['ok'] for report in reports.values())
    assert reports['online-validation']['url'].endswith(version)
    record = {'dateUTC': datetime.now(timezone.utc).isoformat(), 'status': 'published',
              'url': 'https://kingdom-watch.pages.dev/?v=' + version, 'deployment': sys.argv[1],
              'typeCheck': 'passed', 'creatorBuild': 'passed: 3.8.8 web-mobile', 'dprPatch': 'passed',
              'newArt': len(specs), 'realBattleStarted': False, 'checks': reports, 'onlineFiles': matches}
    (OUT / 'deployment-validation.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'url': record['url'], 'onlineMatches': len(matches)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
