"""Offline source/resource inspection and publication receipt. No game execution."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys
import wave
import numpy as np

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
WEB=ROOT/'build/web-mobile'
CHANGED=['core/AudioCatalog.ts','core/GameAudio.ts','ui/UIAudio.ts','ui/PickMotion.ts',
         'battle/BattleDirector.ts','ui/SettlementMotion.ts','ui/PositiveFeedback.ts','battle/BattleLoot.ts']
CHANGED=['assets/scripts/'+p for p in CHANGED]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
src=lambda p:(ROOT/p).read_text(encoding='utf-8-sig')
old=lambda p:(OUT/'before'/(Path(p).name+'.txt')).read_text(encoding='utf-8-sig')
def write(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def decode_uuid(value):
    if len(value)!=22:return value
    table='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    h=value[:2]+''.join(f'{(table.index(value[i])<<6)|table.index(value[i+1]):03x}' for i in range(2,22,2))
    return '-'.join([h[:8],h[8:12],h[12:16],h[16:20],h[20:]])

if sys.argv[1]=='inspect':
    baseline=read(OUT/'source-baseline.json')
    retained={f['path']:sha(ROOT/f['path'])==f['sha256'] for f in baseline if f['path'] not in CHANGED}
    actual={p.relative_to(ROOT).as_posix() for p in (ROOT/'assets/scripts').rglob('*.ts')}
    unexpected=actual-{f['path'] for f in baseline}
    main=max((WEB/'assets/main').glob('index*.js'),key=lambda p:p.stat().st_mtime)
    bundle=main.read_text(encoding='utf-8')
    excerpts={}
    for path in CHANGED:
        name=Path(path).stem; start=bundle.index('chunks:///_virtual/'+name+'.ts')
        end=bundle.find('System.register(',start+1)
        excerpts[name]=bundle[start:end if end>=0 else len(bundle)]
        (OUT/(name+'-compiled.txt')).write_text(excerpts[name],encoding='utf-8')
        (OUT/(name+'-review.diff')).write_text(''.join(difflib.unified_diff(old(path).splitlines(True),src(path).splitlines(True),fromfile='before/'+path,tofile=path)),encoding='utf-8')
    catalog=src(CHANGED[0]); files=[]; cue_files={}
    for name,expression in re.findall(r'^\s+(\w+): \{ files: (.*?), gain:',catalog,re.M):
        values=re.findall(r"'([^']+)'",expression)
        resolved=['v21/'+v for v in values] if expression.startswith('combat(') else [f'v21/{values[0]}_{i}' for i in [1,2,3]] if expression.startswith('deaths(') else values
        cue_files[name]=resolved;files+=resolved
    resolve=lambda f:ROOT/'assets/resources/audio'/((f if '/' in f else 'v1/'+f)+'.wav')
    missing=[f for f in set(files) if not resolve(f).exists()]
    resource=read(next((WEB/'assets/resources').glob('config*.json')))
    versions=dict(zip(resource['versions']['native'][::2],resource['versions']['native'][1::2]))
    paths={row[0]:int(i) for i,row in resource['paths'].items()}
    assets=read(OUT/'assets.json'); audio=[]
    for item in assets['files']:
        path=ROOT/'assets/resources/audio/v21'/item['file']; info=read(Path(str(path)+'.meta'))
        index=paths['audio/v21/'+path.stem]; uuid=decode_uuid(resource['uuids'][index])
        native=WEB/'assets/resources/native'/uuid[:2]/f'{uuid}.{versions[index]}.wav'
        with wave.open(str(path),'rb') as w:
            sample=w.readframes(w.getnframes()); a=np.frombuffer(sample,'<i2').astype(np.int32)
            shape=w.getnchannels()==1 and w.getframerate()==44100 and w.getsampwidth()==2
        audio.append(dict(file=item['file'], native=native.relative_to(WEB).as_posix(),uuid=uuid,
            uuidMatches=uuid==info['uuid'], shape=shape, hashMatches=sha(path)==item['sha256'],
            nativeMatches=sha(path)==sha(native), noClipping=bool(np.max(abs(a))<32767),
            zeroEnds=bool(a[0]==0 and a[-1]==0), dcAcceptable=bool(abs(a.mean()/32768)<.001)))
    oldmedia={f['source']:f['sha256'] for f in read(ROOT/'docs/combat-audio-v2/assets.json')['sources']}
    music={p.name:sha(p) for p in (ROOT/'assets/resources/audio/v1').glob('bgm*') if p.is_file()}
    original_music=read(ROOT/'docs/audio-upgrade-v1/assets.json')
    diagnostic=lambda p:re.findall(r'^assets/.*error TS.*$',p.read_text(encoding='utf-8-sig'),re.M)
    normalize=lambda rows:[re.sub(r'\(\d+,\d+\)','(line,column)',row) for row in rows]
    director=src(CHANGED[4]); expected=old(CHANGED[4]).replace("        Sfx.play('confirm');","        // PickMotion owns the single confirmation at the selected card's landing.",1).replace("    Sfx.play('victory');\n",'',1).replace("    Sfx.play('defeat');\n",'',1)
    loot=src(CHANGED[7]); expected_loot=old(CHANGED[7]).replace("GameAudio.play('confirm', { gain: .3, rate: 1.18, lowpass: 4200, duration: .22 });","GameAudio.play('lootDrop');",1).replace("GameAudio.play('confirm', { gain: .58, rate: .94 + Math.random() * .08, lowpass: 5100, duration: .28 });","GameAudio.play('lootPickup');",1)
    motion=src(CHANGED[5]); pick=src(CHANGED[3]); audio_source=src(CHANGED[1]);growth=src(CHANGED[6])
    checks={
        'onlyEightOriginalScriptsChanged':all(retained.values()) and not unexpected,
        'sameNineExistingTypeDiagnostics':normalize(diagnostic(OUT/'type-review.log'))==normalize(diagnostic(ROOT/'docs/battle-rewards-feather-v20/type-review.log')) and len(diagnostic(OUT/'type-review.log'))==9,
        'noMultipleRegisteredComponents':not read(OUT/'component-audit.json')['conflicts'],
        'allCatalogFilesExist':not missing,
        'eightyThreeNativeAudioResources':len(audio)==83 and all(all(r[k] for k in ['uuidMatches','shape','hashMatches','nativeMatches','noClipping','zeroEnds','dcAcceptable']) for r in audio),
        'allNewAudioUsed':set('v21/'+Path(f['file']).stem for f in assets['files'])=={f for f in files if f.startswith('v21/')},
        'oldUiAndMusicCatalogRetained':catalog[catalog.index('  ui:'):]==old(CHANGED[0])[old(CHANGED[0]).index('  ui:'):],
        'battleTransactionsOnlyAudioChanges':director==expected and loot==expected_loot,
        'singlePickLandingCue':pick.count("uiSound('pickChoose')")==1 and "Sfx.play('confirm');" not in director,
        'outcomeOnceOnVisibleFrameIncludingReducedMotion':"this.outcomeCue = intro;" in motion and "this.outcomeCue = false; uiSound(this.win ? 'victory' : 'defeat');" in motion and 'Director.EVENT_AFTER_DRAW' in motion,
        'noSecondSettlementFanfare':"uiSound('rewardLand')" in motion and "uiSound('reward')" not in motion,
        'heldGrowthShortLaneAndSeparateLanding':"merged || next.repeating ? 'growthTick'" in growth and "uiSound('growthLand')" in growth,
        'trustedGestureAndBackgroundRulesRetained':all(s in audio_source for s in ['event.isTrusted','document.hidden',"window.addEventListener('pagehide'",'loadSave().sfx === false',"this.state !== 'running' && this.state !== 'prepare'"]),
        'noGlobalVolumeIncrease': 'const AUDIO_LEVEL_BOOST = Math.SQRT2 * Math.pow(10, 1 / 20);' in audio_source and 'master.gain.value = .8;' in audio_source,
        'compiledNewCuesAndFirstDrawBinding':all(s in excerpts['AudioCatalog'] for s in ['v21/','pickChoose','rewardLand','growthLand']) and 'outcomeCue' in excerpts['SettlementMotion'] and 'pickChoose' in excerpts['PickMotion'],
        'creditsBundled':sha(WEB/'audio-credits.html')==sha(ROOT/'build-templates/web-mobile/audio-credits.html') and 'Little Robot Sound Factory' in (WEB/'audio-credits.html').read_text(encoding='utf-8'),
        'productionAndDpr':read(WEB/'web-release.json')['production'] and read(WEB/'build-record.json')['dprPatch']=='completed',
        'offlinePeakReductionBounded':all(f['maxOfflinePeakReductionDB']<=6.01 and f['clippedSamples']==0 for f in assets['files']),
    }
    write('bundle-inspection.json',dict(checks=checks,sourceHashes={p:sha(ROOT/p) for p in CHANGED},retainedScripts=retained,
        missingAudio=missing,audioResources=audio,musicHashes=music,mainBundle=main.relative_to(WEB).as_posix(),mainSha256=sha(main),
        sourceScriptCount=len(actual),typeDiagnosticCount=len(diagnostic(OUT/'type-review.log')),
        gameRun=False,testsRun=False,audioAudition=False,browserRun=False,onlineAcceptance=False))
    print(json.dumps(dict(checks=checks,retained=len(retained),audio=len(audio)),ensure_ascii=False))
    if not all(checks.values()):raise RuntimeError('Offline inspection needs attention')
elif sys.argv[1]=='record':
    stage,build,review=[read(OUT/name) for name in ['deployment-stage.json','build-record.json','bundle-inspection.json']]
    urls=re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',(OUT/'publish.log').read_text(encoding='utf-8-sig'))
    assert urls and sha(Path(stage['stage'])/review['mainBundle'])==review['mainSha256']
    assert all(sha(ROOT/p)==h for p,h in review['sourceHashes'].items())
    assert all(sha(Path(stage['stage'])/row['native'])==sha(ROOT/'assets/resources/audio/v21'/row['file']) for row in review['audioResources'])
    elapsed=int(re.findall(r'build-project-total \((\d+)ms\)',Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',dict(**stage,status='published',deployment=urls[-1],build=build,creatorBuildMilliseconds=elapsed,
        date=datetime.now(timezone(timedelta(hours=8))).isoformat(),gameRun=False,testsRun=False,audioAudition=False,browserRun=False,onlineAcceptance=False))
    note=(f"2026-10-17 音效重制v21已构建发布：[正式游戏]({stage['game']}) · [19组新旧音效人工试听]({stage['preview']})，部署 {urls[-1]}。"
        '83条44.1k/16bit授权录音编辑与完整短乐句，约4.97MB，替换五英雄普攻/命中/技能/大招/击杀、三选一、领奖/购买/招募、胜败、培养/突破/主城升级。'
        '新卡牌出现/翻牌/选中落点，移除Director第二次确认；胜败在结算素材就绪首绘后单次播放，减少动态仍有音效，重绘不重复；结算数字/成长落点/星级/长按连升用短音，完整庆祝互斥，切场景和离场清尾。'
        '既有总音量不提高，离线最多6dB峰值控制、保留材质/瞬态和长度层次，普通命中尾声让位技能，重要声音让背景音乐退让；可信手势/开关/后台/暂停保留，BGM文件和数值/交易/存档/战斗动作/美术不变。'
        '新增Little Robot Sound Factory CC BY3.0署名和修改说明，来源/参数/散列保存在docs/audio-overhaul-v21。八原脚本，其余110脚本散列保持；118脚本无多组件注册、原九项类型诊断保持，83条生产native/UUID/散列/零削波检查通过。'
        f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR及Wrangler main完成。'
        '未运行测试、模拟、游戏、浏览器、试听或线上验收，实际听感待用户人工确认，发布不代表音质认可。详见[音效重制](docs/audio-overhaul-v21/README.md)。')
    for name in ['AGENTS.md','README.md']:
        p=ROOT/name;text=p.read_text(encoding='utf-8-sig')
        if stage['game'] not in text:
            at=text.index('\n');p.write_text(text[:at+1]+'\n'+note+'\n'+text[at+1:],encoding='utf-8')
    with (OUT/'README.md').open('a',encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [手动新旧试听]({stage['preview']}) · [部署快照]({urls[-1]})。构建{elapsed}ms；实际听感待用户确认。\n")
    print(json.dumps(dict(game=stage['game'],preview=stage['preview'],deployment=urls[-1]),ensure_ascii=False))
