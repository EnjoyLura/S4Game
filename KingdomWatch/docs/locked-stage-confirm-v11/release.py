"""Read source, build files and publication receipts without running the game."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import difflib,hashlib,json,re,sys

out=Path(__file__).resolve().parent
root=out.parents[1]
build=root/'build/web-mobile'
changed=['assets/scripts/ui/SquadPanel.ts','assets/scripts/ui/pages/LevelsPage.ts',
         'assets/scripts/ui/pages/HeroPage.ts','assets/scripts/ui/UINotice.ts']
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=lambda n:(root/n).read_text(encoding='utf-8-sig')
before=lambda n:(out/'before'/(Path(n).name+'.txt')).read_text(encoding='utf-8-sig')
between=lambda s,a,b:s.split(a,1)[1].split(b,1)[0]
def write(name,data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

if sys.argv[1]=='inspect':
    main=max((build/'assets/main').glob('index.*.js'),key=lambda p:p.stat().st_mtime)
    bundle=main.read_text(encoding='utf-8')
    diff=[]
    for n in changed:
        diff.extend(difflib.unified_diff(before(n).splitlines(True),source(n).splitlines(True),fromfile='before/'+n,tofile=n))
    (out/'source-review.diff').write_text(''.join(diff),encoding='utf-8')
    squad,levels,hero,notice=map(source,changed)
    oldsquad,oldlevels,oldhero,oldnotice=map(before,changed)
    retained={p['path']:sha(root/p['path'])==p['sha256'] for p in read(out/'source-baseline.json') if p['path'] not in changed}
    review={
        'formationAndBrowserBackRetained':between(squad,'export function openSquadPanel','  function confirmRemove')==between(oldsquad,'export function openSquadPanel','  function confirmRemove'),
        'removeTransactionRetained':between(squad,'      const result = undeployHero(hid);','    }, { tone:')==between(oldsquad,'      const result = undeployHero(hid);','    }, { tone:'),
        'sharedConfirmShell':"detailDialog(dim, 548, 360, '下阵确认', 'squadRemoveDialog')" in squad and 'detailFooter(panel)' in squad and 'detailActionY(panel)' in squad,
        'confirmOnlyPresentationChanged':between(squad,'    const modal = panel.parent!;','    heroPortrait')==between(oldsquad,'    const modal = panel.parent!;','    heroPortrait'),
        'checkpointWarnBeforeSelection':between(levels,'      bindButton(item, () => {','        if (!st.drawer) saveOffset();').endswith('        if (!levelOpen(level.order)) { notifyLockedLevel(level.order); return; }\n'),
        'warningNamesRealPreviousStage':"previous = LEVELS[i - 1]" in levels and "previous.id + ' ' + previous.name + '（普通难度）'" in levels and "key: 'campaignLockedLevel:' + level.id" in levels,
        'worldAndDrawerRetained':levels.split('  function openDrawer',1)[1]==oldlevels.split('  function openDrawer',1)[1],
        'unlockedSelectionRetained':between(levels,'        if (!st.drawer) saveOffset();','      }, { dragThreshold:')==between(oldlevels,'        if (!st.drawer) saveOffset();','      }, { dragThreshold:'),
        'heroChangesOnlyOutsideActions':hero.replace('// Keep the raised equipment panel compact; detail actions sit outside its lower edge.','// Align the equipment panel to the stage top; its two actions share the panel\'s lower section.').replace('const equipmentH = 86 + sq * 3;','const equipmentH = 86 + sq * 3 + 76;').replace("N('heroDetails', stage, 213, equipmentY - equipmentH / 2 - 38, 260, 52)","N('heroDetails', equipment, 0, -equipmentH / 2 + 38, 260, 52)")==oldhero,
        'notificationOnlyScaleFixed':notice.replace('    const scale = reduced ? 1 : settle * (1 - .01 * ending);\n    this.card.setScale(scale, scale, 1);','    this.card.setScale(reduced ? 1 : settle * (1 - .01 * ending));')==oldnotice,
    }
    diagnostic=(out/'type-review.log').read_text(encoding='utf-8-sig')
    prior=(root/'docs/squad-trim-v10/type-review.log').read_text(encoding='utf-8-sig')
    primary=lambda s:re.findall(r'^assets/.*error TS.*$',s,re.M)
    types={'fullProjectPassed':False,'primaryDiagnosticCount':len(primary(diagnostic)),
           'onlyOldNoticeErrorRemoved':primary(diagnostic)==[x for x in primary(prior) if not x.startswith('assets/scripts/ui/UINotice.ts(')],
           'changedModulesHaveDiagnostics':any(n+'(' in diagnostic for n in changed)}
    markers=['squadRemoveDialog','campaignLockedLevel:','（普通难度）','shopProductTitleBar']
    result={'mainBundle':main.relative_to(build).as_posix(),'mainSha256':sha(main),
            'sourceHashes':{n:sha(root/n) for n in changed},'sourceReview':review,'remainingScriptsUnchanged':all(retained.values()),
            'retainedScripts':retained,'compiledMarkers':{m:m in bundle for m in markers},'typeReview':types,
            'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False}
    write('bundle-inspection.json',result)
    if not all(review.values()) or not all(retained.values()) or not all(result['compiledMarkers'].values()) or not types['onlyOldNoticeErrorRemoved'] or types['changedModulesHaveDiagnostics']:
        raise RuntimeError('Source/build review needs attention; see saved record')
    print(json.dumps({k:v for k,v in result.items() if k not in ['sourceHashes','retainedScripts']},ensure_ascii=False))
elif sys.argv[1]=='record':
    stage,receipt,inspection=(read(out/n) for n in ['deployment-stage.json','build-record.json','bundle-inspection.json'])
    urls=re.findall(r'Deployment complete!.*?(https://[a-z0-9]+\.kingdom-watch\.pages\.dev)',(out/'publish.log').read_text(encoding='utf-8-sig'))
    if not urls or sha(Path(stage['stage'])/inspection['mainBundle'])!=inspection['mainSha256'] or not all(sha(root/n)==v for n,v in inspection['sourceHashes'].items()):
        raise RuntimeError('Publication receipt/hash mismatch')
    elapsed=int(re.findall(r'build-project-total \((\d+)ms\)',Path(receipt['log']).read_text(encoding='utf-8-sig'))[-1])
    write('release.json',{**stage,'status':'published','deployment':urls[-1],'build':receipt,'creatorBuildMilliseconds':elapsed,
        'mainSha256':inspection['mainSha256'],'date':datetime.now(timezone(timedelta(hours=8))).isoformat(),
        'testsRun':False,'gameRun':False,'simulationRun':False,'browserRun':False,'onlineAcceptance':False})
    note=(f"2026-10-17 下阵确认与锁定关卡通知v11已构建发布：[正式游戏]({stage['game']})，部署 {urls[-1]}。"
        '下阵二次确认复用DetailDialog金边纸面、深蓝标题和底部分割，单层取消/确认按钮下留30；原上下阵及手机返回保留。'
        '锁定关卡和灰色准备入口显示warning通知，包含前置关卡编号/名称与普通难度条件，不改变当前选择。'
        '修复UINotice单数值setScale被Cocos当Vec3读取的无效缩放，明确使用scale,scale,1，恢复通知可见性，曲线/时长/合并保持。'
        '英雄属性/故事移到装备栏外侧下方，装备背板缩短76、与按钮间距12，按钮屏幕位置和已上移背包起点保持。'
        '仅SquadPanel/LevelsPage/HeroPage/UINotice四脚本，其余散列保持，无数值/存档、新图片或Git提交。'
        f'Cocos退出码{receipt["exitCode"]}、{elapsed}ms，production/MD5/DPR与Wrangler main完成。'
        '静态类型消除UINotice旧诊断，余九项原诊断，改动文件无诊断；不运行测试、模拟、游戏、浏览器或线上验收，用户人工确认。'
        '详见 [下阵确认与锁定提示](docs/locked-stage-confirm-v11/README.md)。')
    for name in ['AGENTS.md','README.md']:
        path=root/name;content=path.read_text(encoding='utf-8-sig')
        if stage['game'] not in content:
            at=content.index('\n');path.write_text(content[:at+1]+'\n'+note+'\n'+content[at+1:],encoding='utf-8')
    with (out/'README.md').open('a',encoding='utf-8') as f:
        f.write(f"\n已发布：[正式游戏]({stage['game']}) · [部署快照]({urls[-1]})。Cocos {elapsed}ms。\n")
    print(json.dumps({'game':stage['game'],'deployment':urls[-1]},ensure_ascii=False))
