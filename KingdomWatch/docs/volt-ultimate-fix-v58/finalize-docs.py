from pathlib import Path
import json,re
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
r=json.loads(read(HERE/'deployment-stage.json'));b=json.loads(read(HERE/'build-record.json'));w=json.loads(read(HERE/'web-release.json'))
assert r['published'] and r['staticHttpCheck']['mainBundleHashMatches'] and r['staticHttpCheck']['compiledVoltGetterMatches']
duration=re.search(r'builder:build-project-total \((\d+)ms\)',read(Path(b['log'])))[1]
upload=re.search(r'Uploaded (\d+) files \((\d+) already uploaded\)',read(HERE/'publish.log'))
uploadnote=f'Wrangler main上传{upload[1]}份，复用{upload[2]}份。' if upload else 'Wrangler main报告Deployment complete。'
doc=f'''# 雷法师大招报错修复 v58

已发布：[正式游戏]({r['game']})，[部署快照]({r['deployment']})。

用户反馈雷法师释放大招报 `Cannot read properties of undefined (reading 'duration')`，无法落雷。源码 VoltHero.ultShowDuration 通过 super.ultShowDuration 访问父类 getter；Cocos Creator 3.8.8 本项目生产编译把它降为 HeroBase.prototype.ultShowDuration。getter 在父类原型上执行时没有实例 id，导致 ULT_TIMING[undefined].duration 抛错。异常发生在充能清零之后、落雷队列创建之前。错误编译片段保存于 [before-bundle-getters.json](before-bundle-getters.json)。

唯一游戏代码改动：改为直接读取 ULT_TIMING.volt.duration，再叠加原额外落雷时长公式。与弓箭手、火法师现有直接读取各自配置的方式一致，避免 Cocos 的 super getter 编译路径。[源码差异](review.diff)、[修复后的生产片段](after-bundle-getter.json)。

基础15道、雷暴增援20/25道，演出4.5/5.7/6.9秒，以及落雷排程、伤害、眩晕、充能、音效、选卡保护等均未改动。没有加入吞错兜底，也不改变其他英雄或本轮之前的装备、武器、关卡及存档。

核对1964份原文件，仅 Hero.ts 的时长读取和说明注释变化；其他1963份及全部{r['allOriginalNativeResourcesPreserved']}份生产原生资源保持原字节，没有新增游戏资源，历史{r['priorPreviewFilesPreserved']}份预览保持。类型诊断仍为原10条，无新增。

Creator3.8.8生产构建{duration}ms、退出{b['exitCode']}；DPR与缓存准备完成，引擎 {w['engineRevision']} 保持。{uploadnote}入口HTTP200，线上主包SHA256与本地一致，已确认修复后的雷法getter及旧prototype访问消失。

只进行了静态源代码、类型、编译产物、媒体身份与只读HTTP检查，没有运行游戏、浏览器、测试、战斗模拟或音频。实际释放效果由用户刷新后人工体验；更新不恢复报错前旧页面已经消耗的充能，也不将旧页面热替换为新战斗。
'''
(HERE/'README.md').write_text(doc,encoding='utf-8')
ledger=(f"2026-10-19 用户反馈雷法大招Cannot read properties of undefined(reading duration)、不能释放；已发布[雷法大招报错修复v58](docs/volt-ultimate-fix-v58/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。"
 '生产包证实super.ultShowDuration被Cocos loose编译为父类prototype.ultShowDuration，父getter中this.id缺失，ULT_TIMING[undefined].duration抛错；发生在清零充能后、雷队列生成前。唯一改动Hero.ts雷法getter直接ULT_TIMING.volt.duration加原增援延时并说明原因。原15/20/25道及4.5/5.7/6.9秒、队列/伤害/眩晕/充能/音效/卡/其他英雄不变；源码无其他super调用，弓/火现已直接配置。'
 f"1964原文件仅Hero一处+注释变化，其他1963保持；{r['allOriginalNativeResourcesPreserved']}原生资源及{r['priorPreviewFilesPreserved']}预览保持，无新增媒体，原10类型诊断无新增。Creator{duration}ms退出{b['exitCode']}，DPR/缓存/引擎{w['engineRevision']}保持。{uploadnote}入口200/主包SHA一致，线上修复getter匹配及旧prototype读取消失；未运行游戏/浏览器/测试/模拟/音频，实际由用户刷新人工验收。无Git提交，原工作及.tmp-kwsfx保留。")
for name in ['README.md','AGENTS.md']:
 p=ROOT/name;s=read(p)
 if '[雷法大招报错修复v58]' not in s:
  first,_,rest=s.partition('\n');p.write_text(first+'\n\n'+ledger+'\n'+rest,encoding='utf-8')
print('Documentation saved:',r['game'])
