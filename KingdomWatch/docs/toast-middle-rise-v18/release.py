"""Offline source/artifact inspection and deployment receipts; no game execution."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
root = out.parents[1]
web = root / 'build/web-mobile'
concept = root / 'docs/battle-modal-art-concept-v18'
names = ['UINotice', 'PositiveFeedback']
changed = ['assets/scripts/ui/' + name + '.ts' for name in names]
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def module_excerpt(bundle, name):
    marker = 'chunks:///_virtual/' + name + '.ts'
    at = bundle.index(marker)
    end = bundle.find('System.register(', at + len(marker))
    return bundle[at:end if end >= 0 else len(bundle)]

if sys.argv[1] == 'inspect':
    baseline = read(out / 'source-baseline.json')
    retained = {f['path']: sha(root / f['path']) == f['sha256'] for f in baseline if f['path'] not in changed}
    actual = {p.relative_to(root).as_posix() for p in (root / 'assets/scripts').rglob('*.ts')}
    unexpected = sorted(actual - {f['path'] for f in baseline})
    main = max((web / 'assets/main').glob('index*.js'), key=lambda p: p.stat().st_mtime)
    bundle = main.read_text(encoding='utf-8')
    excerpts = {}
    for name, path in zip(names, changed):
        before = (out / 'before' / (name + '.ts.txt')).read_text(encoding='utf-8-sig')
        source = (root / path).read_text(encoding='utf-8-sig')
        (out / (name + '-review.diff')).write_text(''.join(difflib.unified_diff(
            before.splitlines(True), source.splitlines(True), fromfile='before/' + path, tofile=path)), encoding='utf-8')
        excerpts[name] = module_excerpt(bundle, name)
        (out / (name + '-compiled.txt')).write_text(excerpts[name], encoding='utf-8')
    diagnostics = lambda p: re.findall(r'^assets/.*error TS.*$', p.read_text(encoding='utf-8-sig'), re.M)
    types = diagnostics(out / 'type-review.log')
    previous = diagnostics(root / 'docs/feedback-polish-v17/type-review.log')
    manifest = read(concept / 'asset-manifest.json')
    assets = {a['file']: sha(concept / a['file']) == a['sha256'] and
              sha(Path(a['source']) if Path(a['source']).is_absolute() else root / a['source']) == a['sha256']
              for a in manifest}
    html = (concept / 'index.html').read_text(encoding='utf-8')
    references = sorted(set(re.findall(r'(?:src|href)="([^"#]+)"|url\(\x27([^\x27]+)\x27\)', html)))
    missing = [a or b for a, b in references if not (concept / (a or b)).is_file()]
    script = re.search(r'<script>(.*?)</script>', html, re.S).group(1)
    (out / 'preview-inline.js').write_text(script, encoding='utf-8')
    checks = {
        'compiledNoticeHigherLane': bool(re.search(r'\.36', excerpts['UINotice'])),
        'compiledGrowthHigherLane': bool(re.search(r'\.36', excerpts['PositiveFeedback'])),
        'noticeEntryNoOffscreenDistance': 'this.entryDistance=LO.half' not in excerpts['UINotice'] and 'this.entryDistance=' in excerpts['UINotice'],
        'growthEntryUsesRestingLift': bool(re.search(r'var \w+=this\.lift;', excerpts['PositiveFeedback'])),
        'componentAuditClear': not read(out / 'component-audit.json')['conflicts'],
        'existingAssetAndImageCopiesExact': all(assets.values()),
        'htmlLiteralReferencesExist': not missing,
        'typeDiagnosticsUnchanged': types == previous,
        'changedFilesHaveNoDiagnostics': not any(any(n + '.ts(' in t for n in names) for t in types),
    }
    result = {'checks': checks, 'retainedScripts': retained, 'remainingScriptsUnchanged': all(retained.values()),
              'unexpectedScripts': unexpected, 'mainBundle': main.relative_to(web).as_posix(), 'mainSha256': sha(main),
              'sourceHashes': {p: sha(root / p) for p in changed}, 'assetCopies': assets,
              'missingReferences': missing, 'typeDiagnosticCount': len(types),
              'gameRun': False, 'testsRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    print(json.dumps({'checks': checks, 'retained': len(retained), 'types': len(types), 'bundle': result['mainBundle']}, ensure_ascii=False))
    if not all(checks.values()) or not all(retained.values()) or unexpected:
        raise RuntimeError('Static inspection requires attention')
elif sys.argv[1] == 'record':
    stage, build, inspection = (read(out / name) for name in ['deployment-stage.json', 'build-record.json', 'bundle-inspection.json'])
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256']:
        raise RuntimeError('Deployment receipt or bundle mismatch')
    if not all(sha(root / p) == v for p, v in inspection['sourceHashes'].items()):
        raise RuntimeError('Source changed after inspection')
    packaged = Path(stage['stage']) / 'previews/battle-modal-v18'
    preview_hashes = {p.relative_to(packaged).as_posix(): sha(p) for p in packaged.rglob('*') if p.is_file()}
    if not all(sha(concept / p) == v for p, v in preview_hashes.items()):
        raise RuntimeError('Packaged preview mismatch')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'creatorBuildMilliseconds': elapsed,
                          'build': build, 'previewHashes': preview_hashes,
                          'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
                          'gameRun': False, 'testsRun': False, 'browserRun': False, 'audioAudition': False, 'onlineAcceptance': False})
    note = (f"2026-10-17 Toast中部上移v18已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
            '普通和成长提示从屏幕中心显现，上移至距顶部约32%的位置停留，再继续向上淡出；安全边界、渐隐背景/双线、原时长与长按合并保持。'
            '仅UINotice/PositiveFeedback两脚本，其余114脚本散列保持；116脚本无多组件注册。'
            f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR及Wrangler main完成；原九项类型诊断保持，无新增。'
            f'同时交付[暂停/胜利/失败效果图及独立动效方案]({stage["preview"]})，三张内置生图原图和提示词保存；独立预览可重播、拖时间轴、减少动态及手动开原音效。'
            '正式战斗弹窗本轮未替换；未运行测试、模拟、游戏、浏览器、预览、试听或线上验收，待用户人工确认。'
            '详见[Toast位置](docs/toast-middle-rise-v18/README.md)与[战斗弹窗方案](docs/battle-modal-art-concept-v18/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = root / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    for p in [out / 'README.md', concept / 'README.md']:
        with p.open('a', encoding='utf-8') as f:
            f.write(f"\n已发布：[正式游戏]({stage['game']}) · [效果图与动效方案]({stage['preview']}) · [部署快照]({urls[-1]})。构建{elapsed}ms；观感与交互待用户人工确认。\n")
    print(json.dumps({'game': stage['game'], 'preview': stage['preview'], 'deployment': urls[-1]}, ensure_ascii=False))
