"""Source/build/deployment receipts only; no runtime execution."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
rel = 'assets/scripts/ui/pages/LevelsPage.ts'
def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))
def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

if sys.argv[1] == 'inspect':
    main = max((game / 'build/web-mobile/assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    before = (out / 'before/LevelsPage.ts.txt').read_text(encoding='utf-8-sig').splitlines(True)
    after = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
    (out / 'source-review.diff').write_text(''.join(difflib.unified_diff(before, after,
        fromfile='before/' + rel, tofile=rel)), encoding='utf-8')
    retained = {row['path']: sha(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] != rel}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (game / 'docs/chapter-route-fill-v2/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', prior, re.M)
    markers = ['campaignHeaderSurface', 'campaignTerrain', 'campaignChapterHeader', 'campaignCurrentStage', 'campaignStartBattle']
    result = {'mainBundle': main.relative_to(game / 'build/web-mobile').as_posix(), 'mainSha256': sha(main),
        'sourceSha256': sha(game / rel), 'compiledMarkers': {m: m in code for m in markers},
        'fixedTerrainBackdropAbsent': 'campaignTerrainBackdrop' not in code, 'retainedSources': retained,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'changedModuleHasDiagnostics': rel + '(' in diagnostics},
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not all(retained.values()) or not same or result['typeReview']['changedModuleHasDiagnostics'] \
        or not result['fixedTerrainBackdropAbsent'] or not all(result['compiledMarkers'].values()):
        raise RuntimeError('Source/build review requires attention.')
    print(json.dumps({k: result[k] for k in ['mainBundle', 'fixedTerrainBackdropAbsent', 'typeReview']}))
elif sys.argv[1] == 'record':
    stage = read(out / 'deployment-stage.json')
    build = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] \
        or sha(game / rel) != inspection['sourceSha256']:
        raise RuntimeError('Deployment receipt or artifact mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': build,
        'mainSha256': inspection['mainSha256'], 'creatorBuildMilliseconds': elapsed,
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False})
    note = (f"2026-10-16 删除顶部固定地图v3已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '按用户要求删除上一轮campaignTerrainBackdrop固定图片，顶部改为米色纸面和深色标题，'
        '保留资源栏/章节条，下方仅保留一张可拖动路线地图；地图/节点/聚焦和底部接合沿用v2。'
        '仅LevelsPage视觉调整，其他脚本散列保持，无新素材、数值或存档变化，未追加Git提交。'
        f"Cocos退出码{build['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅仅原诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，实际画面由用户人工确认。'
        '详见 [删除顶部固定地图](docs/chapter-route-header-v3/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = game / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}))
