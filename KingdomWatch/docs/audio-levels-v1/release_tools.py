"""Retain source, provenance and release receipts without running the game."""
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
source = 'assets/scripts/core/GameAudio.ts'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(name, data):
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare():
    prior = game / 'docs/lobby-ui-quiet-v2'
    publisher = (prior / 'publish.ps1').read_text(encoding='utf-8-sig')
    publisher = publisher.replace('docs/lobby-ui-quiet-v1/deployment-stage.json', 'docs/lobby-ui-quiet-v2/deployment-stage.json')
    publisher = publisher.replace('lobby-ui-quiet-v2-', 'audio-levels-v1-')
    publisher = publisher.replace('quiet shop, hero, base and chapter navigation; shared round hero selector, neutral item surfaces, wallet and bottom navigation', 'BGM and SFX buses +3.01 dB; existing audio, attribution and mix dynamics retained')
    (out / 'publish.ps1').write_text(publisher, encoding='utf-8')
    write('source-hashes.json', {rel: sha(game / rel) for rel in [source, 'tools/prepare-web-release.py']})
    before = (out / 'before/GameAudio.ts.txt').read_text(encoding='utf-8-sig').splitlines(True)
    after = (game / source).read_text(encoding='utf-8-sig').splitlines(True)
    (out / 'source-review.diff').write_text(''.join(difflib.unified_diff(before, after, fromfile='before/' + source, tofile=source)), encoding='utf-8')
    rows, sources = [], []
    for folder, version, key in [('audio-upgrade-v1', 'v1', 'files'), ('combat-audio-v2', 'v2', 'files'), ('battle-exit-death-v3', 'death-v3', 'assets')]:
        manifest = game / 'docs' / folder / ('audio-assets.json' if key == 'assets' else 'assets.json')
        data = read(manifest)
        sources.extend(data['sources'])
        for row in data[key]:
            path = game / 'assets/resources/audio' / version / row['file']
            rows.append({'asset': path.relative_to(game).as_posix(), 'recipe': manifest.relative_to(game).as_posix(), 'matchesRecordedHash': sha(path) == row['sha256']})
    write('license-audit.json', {'checkedOn': '2026-10-16', 'basis': 'Author publication pages and official CC deeds inspected; not independent title verification', 'sources': sources, 'assetRecipes': rows, 'creditsPage': 'audio-credits.html', 'creditsEntry': 'pause settings', 'publishedLicenseFamilies': ['CC0-1.0', 'CC-BY-3.0']})
    print(json.dumps({'publisherPrepared': True, 'assetRecipes': len(rows), 'allRecordedAudioHashesMatch': all(r['matchesRecordedHash'] for r in rows)}))

def inspect():
    main = max((build / 'assets/main').glob('index.*.js'), key=lambda p: p.stat().st_mtime)
    code = main.read_text(encoding='utf-8')
    retained = {rel: sha(game / rel) == value for rel, value in read(out / 'retained-hashes.json').items()}
    current = all(sha(game / rel) == value for rel, value in read(out / 'source-hashes.json').items())
    credits = sha(build / 'audio-credits.html') == sha(game / 'build-templates/web-mobile/audio-credits.html')
    diagnostics = (out / 'type-review.log').read_text(encoding='utf-8-sig')
    artifact = {'mainBundle': main.relative_to(build).as_posix(), 'mainBundleSha256': sha(main), 'compiledBoostPresent': 'Math.SQRT2' in code, 'compiledSfxBusPresent': 'this.sfxBus.gain.value=this.sfxEnabled?' in code, 'currentSourceHashMatches': current, 'retainedSourceAudioCreditsHashes': retained, 'creditsPageIncluded': credits, 'changedModuleHasDiagnostics': source + '(' in diagnostics, 'fullProjectTypeReviewPassed': False, 'inspection': 'Static source and local build artifact inspection only; no tests, simulation, game, browser, online acceptance or listening'}
    write('bundle-inspection.json', artifact)
    if not (artifact['compiledBoostPresent'] and artifact['compiledSfxBusPresent'] and current and credits and all(retained.values())) or artifact['changedModuleHasDiagnostics']:
        raise RuntimeError('Static artifact inspection incomplete')
    print(json.dumps({k: v for k, v in artifact.items() if k != 'retainedSourceAudioCreditsHashes'}))

def record():
    stage, receipt, inspection = read(out / 'deployment-stage.json'), read(out / 'build-record.json'), read(out / 'bundle-inspection.json')
    urls = re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)', (out / 'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage']) / inspection['mainBundle']) != inspection['mainBundleSha256']:
        raise RuntimeError('Published receipt and inspected bundle required')
    ms = int(re.findall(r'build-project-total \((\d+)ms\)', Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json', {**stage, 'status': 'published', 'deployment': urls[-1], 'date': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'build': receipt, 'creatorBuildMilliseconds': ms, 'mainBundleSha256': inspection['mainBundleSha256'], 'boostDB': 3.0102999566, 'validation': {'sourceReview': True, 'localArtifactInspection': True, 'testsRun': False, 'simulationRun': False, 'gameRun': False, 'browserRun': False, 'onlineAcceptance': False, 'listeningPerformed': False, 'manualAcceptance': 'pending user'}})
    note = (f"2026-10-16 音量提高v1已构建发布：[正式游戏]({stage['game']})，部署 `{urls[-1]}`。BGM与音效总线各乘√2提高约3.01dB；初始化与设置刷新共用常量，营地/战斗同步。输出压缩、静音存档、音乐避让、淡入淡出与声部预算保持，音频及其他脚本散列保持。作者发布页与CC官方说明复核：两首cynicmusic BGM及其余大部分采样CC0，qubodup冰/电CC BY 3.0；现有鸣谢随包发布，保留作者/标题/来源/许可及改编说明，来源/编辑配方保留，不能将公开许可视为零争议权属保证。未追加Git提交。Cocos退出码{receipt['exitCode']}、{ms}ms，production/MD5/DPR与Wrangler main完成；静态类型审阅只有既有诊断，本轮GameAudio无诊断。不运行测试、模拟、游戏、浏览器、线上验收或试听，听感由用户人工确认。详见 [音量与许可核对](docs/audio-levels-v1/README.md)。")
    note += '另修复production/MD5将鸣谢改名后固定入口失效：通用prepare-web-release每轮补回audio-credits.html并设no-cache，保留完整鸣谢与来源散列。'
    for name in ['AGENTS.md', 'README.md']:
        path = game / name
        text = path.read_text(encoding='utf-8-sig')
        at = text.index('\n')
        if stage['game'] not in text:
            path.write_text(text[:at+1] + '\n' + note + '\n' + text[at+1:], encoding='utf-8')
    with (out / 'README.md').open('a', encoding='utf-8') as stream:
        stream.write(f"\n已构建发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {ms}ms，听感待用户人工确认。\n")
    print(json.dumps({'published': True, 'game': stage['game'], 'deployment': urls[-1], 'buildMilliseconds': ms}))

{'prepare': prepare, 'inspect': inspect, 'record': record}[sys.argv[1]]()
