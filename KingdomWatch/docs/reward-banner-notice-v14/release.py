"""Read local source/build files and publication receipts. Never execute the game."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import difflib
import hashlib
import json
import re
import sys
import wave

out=Path(__file__).resolve().parent
root=out.parents[1]
web=root/'build/web-mobile'
changed=['assets/scripts/ui/RewardPopup.ts','assets/scripts/ui/UINotice.ts',
         'assets/scripts/ui/UIAudio.ts','assets/scripts/core/AudioCatalog.ts']
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
source=lambda n:(root/n).read_text(encoding='utf-8-sig')
before=lambda n:(out/'before'/(Path(n).name+'.txt')).read_text(encoding='utf-8-sig')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
between=lambda s,a,b:s.split(a,1)[1].split(b,1)[0]

def write(name,value):
    (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1]=='inspect':
    baseline=read(out/'source-baseline.json')
    retained={f['path']:sha(root/f['path'])==f['sha256'] for f in baseline if f['path'] not in changed}
    paths={p.relative_to(root).as_posix() for p in (root/'assets/scripts').rglob('*.ts')}
    unexpected=sorted(paths-{f['path'] for f in baseline})
    popup,notice,audio,catalog=map(source,changed)
    old_popup,old_notice,old_audio,old_catalog=map(before,changed)
    cue_line="  reward: { files: ['levelup'], gain: .94, rate: 1.12, gap: .55, group: 'cue', priority: 5 },\n"
    review={
      'receiptFilterRetained':"const rewards = items.filter(item => Number.isFinite(item.amount) && item.amount > 0);" in popup,
      'oneCloseAndCallbackRetained':between(popup,'  let closing = false','  const columns=')==between(old_popup,'  let closing = false','  const panel ='),
      'popupNeverWritesRewards':all(s not in popup for s in ['claimAllChests','saveData','GameData','loadSave']),
      'popupAppearanceCueAfterDrawRetained':between(popup,'  play(): void','  update(dt:')==between(old_popup,'  play(): void','  update(dt:'),
      'exactlyOneRewardCueWithoutDelayedConfirm':popup.count("uiSound('reward')")==1 and "uiSound('confirm')" not in popup,
      'rewardBannerReplacesOldPaperDialog':all(s in popup for s in ['rewardCelebrationBand','rewardCelebrationTitle','恭喜获得','shopQualitySocket(card,0,0,126,2)','点击任意位置收下']) and all(s not in popup for s in ['comicDialogContent','comicButton','comicPlate']),
      'realAmountsAndOneItemCentering':"'+' + reward.amount.toLocaleString('en-US')" in popup and '((index%columns)-(count-1)/2)*166' in popup,
      'noticePublicTextAndFormattingRetained':between(notice,'export type NoticeKind','const out')==between(old_notice,'export type NoticeKind','const out'),
      'noticeUpperMiddleAndBottomEntry': 'LO.half*.24' in notice and 'this.entryDistance=LO.half+restingY+this.height/2+24' in notice,
      'noticeFadedTwinRules': 'gameToastFadedBackground' in notice and 'fade=edge*edge*(3-2*edge)' in notice and '.64*fade' in notice and '.28*fade' in notice and 'roundRect' not in notice,
      'noticeUpwardFade': '-this.entryDistance*(1-out(this.age/.38))+36*ending' in notice,
      'noticeLifecycleRetained':notice.split('  private removeDisplay()',1)[1]==old_notice.split('  private removeDisplay()',1)[1],
      'onlyRewardAudioRoutingChanged':audio==old_audio.replace("reward: 'confirm'","reward: 'reward'"),
      'onlyRewardCueAddedToCatalog':catalog.replace(cue_line,'')==old_catalog,
      'grantEntryAndDataUnchanged':all(retained[n] for n in ['assets/scripts/ui/pages/LevelsPage.ts','assets/scripts/core/GameData.ts','assets/scripts/core/SaveData.ts','assets/scripts/core/GameAudio.ts']),
      'baseArtworkUnchanged':retained['assets/scripts/ui/pages/BasePage.ts'] and retained['assets/scripts/ui/BaseChrome.ts'],
    }
    for name in changed:
        (out/(Path(name).stem+'-review.diff')).write_text(''.join(difflib.unified_diff(before(name).splitlines(True),source(name).splitlines(True),fromfile='before/'+name,tofile=name)),encoding='utf-8')
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/base-art-live-v13/type-review.log').read_text(encoding='utf-8-sig')
    primary=lambda s:re.findall(r'^assets/.*error TS.*$',s,re.M)
    types={'fullProjectPassed':False,'primaryDiagnosticCount':len(primary(diagnostic)),
           'samePrimaryDiagnosticsAsV13':primary(diagnostic)==primary(prior),
           'modifiedFilesHaveDiagnostics':any(n+'(' in diagnostic for n in changed)}
    main=max((web/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle=main.read_text(encoding='utf-8')
    markers=['rewardCelebrationBand','rewardCelebrationTitle','恭喜获得','点击任意位置收下',
             'gameToastFadedBackground','gameToastText','baseCampTitlePlate','selectedCheckpointName']
    clip=root/'assets/resources/audio/v1/levelup.wav'
    with wave.open(str(clip)) as sound:
        clip_info={'path':clip.relative_to(root).as_posix(),'sha256':sha(clip),'seconds':sound.getnframes()/sound.getframerate(),
                   'rewardPlaybackRate':1.12,'rewardCueGain':.94,'auditioned':False,'source':'existing project asset, no audio modified'}
    result={'mainBundle':main.relative_to(web).as_posix(),'mainSha256':sha(main),
            'sourceHashes':{n:sha(root/n) for n in changed},'sourceReview':review,
            'remainingScriptsUnchanged':all(retained.values()),'retainedScripts':retained,
            'unexpectedNewScripts':unexpected,'compiledMarkers':{m:m in bundle for m in markers},
            'rewardAudio':clip_info,'typeReview':types,'testsRun':False,'simulationRun':False,
            'gameRun':False,'browserRun':False,'audioAudition':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(retained.values()) or unexpected or not all(result['compiledMarkers'].values()) or not types['samePrimaryDiagnosticsAsV13'] or types['modifiedFilesHaveDiagnostics']:
        raise RuntimeError('Local source/build inspection requires attention')
    print(json.dumps({k:v for k,v in result.items() if k not in ['sourceHashes','retainedScripts']},ensure_ascii=False))
elif sys.argv[1]=='record':
    stage,build,inspection=(read(out/n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls=re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',(out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle'])!=inspection['mainSha256'] or not all(sha(root/n)==v for n,v in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch')
    elapsed=int(re.findall(r'build-project-total \((\d+)ms\)',Path(build['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'build':build,
          'creatorBuildMilliseconds':elapsed,'mainSha256':inspection['mainSha256'],
          'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),
          'testsRun':False,'simulationRun':False,'gameRun':False,'browserRun':False,'audioAudition':False,'onlineAcceptance':False})
    note=(f"2026-10-17 横幅领奖与渐隐双线通知v14已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
          '领奖弹窗按参考改全屏暗遮罩/深蓝灰横幅/金色翼饰恭喜获得/方形奖励与右下真实数量，点击任意位置收下；保留数字与碎光，首帧单次领奖旋律，去延后确认声。'
          'reward独立音效语义复用现有levelup采样，rate1.12/gain0.94，原音效开关/解锁/后台静音保持。'
          '通知中上部停留，两侧背景与上下双线渐隐，380ms自屏幕下方滑入、停留约1.8–2.3秒、320ms上移36并淡出；真实成长文本、连升合并和生命周期保持。'
          '仅RewardPopup/UINotice/UIAudio/AudioCatalog四脚本，其余原脚本散列保持；到账/领取/存档/基地与导航保持，无新运行图片/音频或Git提交。'
          f'Cocos退出码{build["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
          '类型仍为原九项诊断，改动模块无诊断；不运行测试、模拟、游戏、浏览器、试听或线上验收，用户人工确认。'
          '详见 [横幅领奖与双线通知](docs/reward-banner-notice-v14/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;contents=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in contents:
            at=contents.index('\n');path.write_text(contents[:at+1]+'\n'+note+'\n'+contents[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
