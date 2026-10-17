"""Offline source inventory and publication packaging; never runs or plays the game."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import re
import shutil
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CHANGED = [
    'assets/scripts/core/AudioCatalog.ts', 'assets/scripts/core/GameAudio.ts',
    'assets/scripts/ui/UIAudio.ts', 'assets/scripts/ui/PositiveFeedback.ts',
    'assets/scripts/battle/Monster.ts', 'assets/scripts/battle/BattleDirector.ts',
    'assets/scripts/ui/TrainingLobby.ts', 'assets/scripts/ui/pages/HeroPage.ts',
    'assets/scripts/ui/pages/BasePage.ts',
    'assets/scripts/ui/ComicUI.ts',
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(name, data):
    (HERE/name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def snapshot():
    if (HERE/'before.json').exists():
        raise ValueError('Original snapshot already exists')
    for rel in CHANGED:
        dest = HERE/'before'/rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT/rel, dest)
    files = list((ROOT/'assets/scripts').rglob('*.ts')) + list((ROOT/'assets/resources/audio').rglob('*'))
    write('before.json', {str(p.relative_to(ROOT)).replace('\\', '/'): digest(p) for p in files if p.is_file()})
    print('Saved exact pre-change sources and audio inventory')


def inspect():
    before = json.loads((HERE/'before.json').read_text(encoding='utf-8'))
    changed = [rel for rel, sha in before.items() if not (ROOT/rel).exists() or digest(ROOT/rel) != sha]
    if set(changed) != set(CHANGED):
        raise ValueError('Unexpected changes: ' + str(changed))
    catalog = (ROOT/CHANGED[0]).read_text(encoding='utf-8')
    original = (HERE/'before'/CHANGED[0]).read_text(encoding='utf-8')
    if catalog.split('} as const;', 1)[0] != original.split('} as const;', 1)[0]:
        raise ValueError('Original audio catalog or source sample assignments changed')
    keys = re.findall(r'^  (\w+): \{ files:', catalog, re.M)
    silent_body = catalog.split('const SILENT_CUES', 1)[1].split(']);', 1)[0]
    silent = re.findall(r"'([a-zA-Z]+)'", silent_body)
    alias_body = catalog.split('const SHARED_CUES', 1)[1].split('};', 1)[0]
    aliases = dict(re.findall(r"(\w+): '([a-zA-Z]+)'", alias_body))

    def resolve(cue):
        return None if cue in silent else aliases.get(cue, cue)

    if not set(silent).issubset(keys) or not set(aliases).issubset(keys) or not set(aliases.values()).issubset(keys):
        raise ValueError('Invalid policy cue name')
    if set(aliases.values()) & (set(silent) | set(aliases)):
        raise ValueError('Alias is silent or indirect')
    canonical = sorted(set(filter(None, map(resolve, keys))))
    old_list = json.loads((ROOT/'docs/audio-replacement-list/音效用途映射.json').read_text(encoding='utf-8'))['items']
    items = []
    for old in old_list:
        mapped = list(dict.fromkeys(resolve(cue) for cue in old['cues']))
        # Warnings keep the shared click, while closing surfaces is silent.
        if old['id'] == 'A08':
            mapped = ['ui']
        # Only elite/BOSS deaths retain the shared heavy landing.
        if old['id'] in ['G01', 'G02', 'G03', 'G04']:
            mapped = [None]
        items.append({'id': old['id'], 'name': old['name'], 'previousCues': old['cues'],
                      'currentCues': mapped, 'status': '静音' if mapped == [None] else '保留或共用'})
    result = {'sourceChanged': changed, 'unchangedOriginalFiles': len(before)-len(changed),
              'allAudioAndMetadataUnchanged': True, 'catalogDefinitionsUnchanged': True,
              'originalCueCount': len(keys), 'silentCueCount': len(silent),
              'sharedCueCount': len(aliases), 'remainingCanonicalCueCount': len(canonical),
              'canonicalCues': canonical, 'silentCues': silent, 'aliases': aliases,
              'gameOrAudioPlaybackPerformed': False, 'items': items}
    diagnostic = re.compile(r'^(assets/[^\(]+)\(\d+,\d+\): error (TS\d+): (.*)$', re.M)
    before_types = diagnostic.findall((HERE/'types-before.log').read_text(encoding='utf-8-sig'))
    after_types = diagnostic.findall((HERE/'types-after.log').read_text(encoding='utf-8-sig'))
    added = [d for d in after_types if d not in before_types]
    if added:
        raise ValueError('New type diagnostics: ' + str(added))
    result['typeDiagnostics'] = {'before': len(before_types), 'after': len(after_types), 'added': added,
                                 'note': 'Full-project existing diagnostics remain; changed modules have no new errors'}
    write('source-inspection.json', result)
    lines = ['# 本轮61项用途处理明细', '', '当前音源均沿用已有版本；静音并不代表删除资源。', '',
             '| 编号 | 用途 | 本轮处理 | 当前播放入口 |', '|---|---|---|---|']
    for item in items:
        names = ' / '.join(cue or '无' for cue in item['currentCues'])
        lines.append(f"| {item['id']} | {item['name']} | {item['status']} | {names} |")
    (HERE/'用途处理明细.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k not in ['items', 'canonicalCues', 'silentCues', 'aliases']}, ensure_ascii=False))


def stage():
    prior = Path(json.loads((ROOT/'docs/audio-representatives-r1/deployment-stage.json').read_text(encoding='utf-8-sig'))['stage'])
    build = ROOT/'build/web-mobile'
    release = json.loads((build/'web-release.json').read_text(encoding='utf-8-sig'))
    if not release['production']:
        raise ValueError('Production build required')
    target = ROOT/'build'/('publish-audio-reduction-v23-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copytree(build, target, ignore=shutil.ignore_patterns('previews'))
    shutil.copytree(prior/'previews', target/'previews')
    previews = list((prior/'previews').rglob('*'))
    for p in previews:
        if p.is_file() and digest(p) != digest(target/'previews'/p.relative_to(prior/'previews')):
            raise ValueError('Prior preview changed: ' + str(p))
    version = re.search(r'\?v=(\d+)', release['entry']).group(1)
    record = {'stage': str(target), 'priorPublishedStage': str(prior), 'entryVersion': version,
              'project': 'kingdom-watch', 'branch': 'main',
              'game': 'https://kingdom-watch.pages.dev/?v=audio-reduction-v23-'+version,
              'scope': 'Reduce redundant sound triggers and concurrency; reuse v21 samples; no candidate sound integration',
              'priorPreviewFilesPreserved': sum(p.is_file() for p in previews),
              'manualAcceptance': 'pending user review; no game/browser/audio playback performed'}
    write('deployment-stage.json', record)
    for name in ['build-record.json', 'web-release.json']:
        shutil.copy2(build/name, HERE/name)
    print(json.dumps(record, ensure_ascii=False))


if __name__ == '__main__':
    {'snapshot': snapshot, 'inspect': inspect, 'stage': stage}[sys.argv[1]]()
