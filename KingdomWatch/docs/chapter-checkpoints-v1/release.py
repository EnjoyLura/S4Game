"""Inspect sources and local production artifacts; never run the game."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys

out = Path(__file__).resolve().parent
game = out.parents[1]
build = game / 'build/web-mobile'
changed = ['assets/scripts/ui/pages/LevelsPage.ts', 'assets/scripts/ui/CampaignRoute.ts',
    'assets/scripts/ui/CampaignCheckpointArt.ts']
def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))
def write(name, value):
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

if sys.argv[1] == 'inspect':
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    patches = []
    for rel in changed:
        old = out / 'before' / (Path(rel).name + '.txt')
        before = old.read_text(encoding='utf-8-sig').splitlines(True) if old.exists() else []
        after = (game / rel).read_text(encoding='utf-8-sig').splitlines(True)
        patches.extend(difflib.unified_diff(before, after, fromfile='before/' + rel, tofile=rel))
    (out / 'source-review.diff').write_text(''.join(patches), encoding='utf-8')
    retained = {row['path']: sha(game / row['path']) == row['sha256']
        for row in read(out / 'source-baseline.json') if row['path'] not in changed}
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    prior = (game / 'docs/chapter-route-overlay-v4/type-review.log').read_text(encoding='utf-8-sig')
    same = re.findall(r'^assets/.*error TS.*$', diagnostics, re.M) == re.findall(r'^assets/.*error TS.*$', prior, re.M)
    markers = ['campaignLockedTerrainShade', 'campaignChapterLocked', 'campaignTerrain',
        'campaignChapterHeader', 'campaignPrepare', 'campaignCurrentStage', 'campaignStartBattle',
        'campaignCheckpointOutpost', 'campaignCheckpointForest', 'campaignCheckpointLair']
    result = {'mainBundle': main.relative_to(build).as_posix(), 'mainSha256': sha(main),
        'sourceHashes': {rel: sha(game / rel) for rel in changed},
        'compiledMarkers': {m: m in code for m in markers},
        'fixedTerrainBackdropAbsent': 'campaignTerrainBackdrop' not in code,
        'fullHeaderSurfaceAbsent': 'campaignHeaderSurface' not in code,
        'retainedSources': retained,
        'typeReview': {'fullProjectPassed': False, 'samePriorPrimaryDiagnostics': same,
            'changedModulesHaveDiagnostics': any(rel + '(' in diagnostics for rel in changed)},
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False}
    write('bundle-inspection.json', result)
    if not all(retained.values()) or not same or result['typeReview']['changedModulesHaveDiagnostics'] \
        or not result['fixedTerrainBackdropAbsent'] or not result['fullHeaderSurfaceAbsent'] \
        or not all(result['compiledMarkers'].values()):
        raise RuntimeError('Source/build review requires attention.')
    print(json.dumps({k: result[k] for k in ['mainBundle', 'fixedTerrainBackdropAbsent', 'fullHeaderSurfaceAbsent', 'typeReview']}))
elif sys.argv[1] == 'record':
    stage = read(out / 'deployment-stage.json')
    receipt = read(out / 'build-record.json')
    inspection = read(out / 'bundle-inspection.json')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',
        (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainSha256'] \
        or not all(sha(game / rel) == h for rel, h in inspection['sourceHashes'].items()):
        raise RuntimeError('Deployment receipt or artifact mismatch.')
    elapsed = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'build': receipt,
        'mainSha256': inspection['mainSha256'], 'creatorBuildMilliseconds': elapsed,
        'date': datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False})
    note = (f"2026-10-16 章节特色关卡牌v1已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '前哨蓝底卫戍盾牌、深林木路标/木纹铁钉/苔藓、兽穴黑铁牌/骨牙/嵌饰，使用静态原生矢量绘制，无新图片下载。'
        '共用112×128触摸区、真实星级、锁标、宝箱红点及章末提示；木/铁牌选中保留材质并强化金边和脚下光环，名称签留16单位间隙。'
        '顶部无整块底板、单张地图滚动、未解锁章节48%遮罩及解锁条件、灰色锁定牌和置灰出战按钮全部保留。'
        '修改LevelsPage/CampaignRoute并新增CampaignCheckpointArt，其他脚本散列保持，无关卡规则、数值、存档或奖励变化，未追加Git提交。'
        f"Cocos退出码{receipt['exitCode']}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。"
        '静态类型审阅仅原有诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器或线上验收，实际画面由用户人工确认。'
        '详见 [章节特色关卡牌](docs/chapter-checkpoints-v1/README.md)。')
    for name in ['AGENTS.md', 'README.md']:
        p = game / name
        text = p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at = text.index('\n')
            p.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game': stage['game'], 'deployment': urls[-1]}))
