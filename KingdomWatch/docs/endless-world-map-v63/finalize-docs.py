from pathlib import Path
import hashlib, json, re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
read = lambda p: p.read_text(encoding='utf-8-sig')
r = json.loads(read(HERE/'deployment-stage.json'))
assert r['published'] and r['staticHttpCheck']['newSceneHashMatches']
w = json.loads(read(HERE/'web-release.json'))
b = json.loads(read(HERE/'build-record.json'))
duration = re.search(r'build-project-total \((\d+)ms\)',read(Path(b['log']))).group(1)
image = ROOT/'assets/resources/scenes/bg_endless_world_v63.png'
meta = json.loads(read(Path(str(image)+'.meta')))
art = dict(source='docs/endless-world-map-concept-v61/world-map-placeholder-v61.png',
           target=image.relative_to(ROOT).as_posix(), width=1024, height=1536,
           sha256=hashlib.sha256(image.read_bytes()).hexdigest(), uuid=meta['uuid'],
           operation='Copied original provisional-map PNG bytes without editing or resampling; independent image meta.')
(HERE/'art.json').write_text(json.dumps(art,ensure_ascii=False,indent=2),encoding='utf-8')
text = f'''# 无尽世界地图实装 v63

[正式游戏]({r['game']}) · [本次部署]({r['deployment']})

从「基地 → 无尽挑战」进入。本轮按用户最新标注直接实现游戏，不再只交付效果图。

## 页面与交互

- 独立二级页面，删除原无尽列表弹窗。通关普通1-10解锁建筑；之后每通关一章的第10关开放对应无尽挑战。
- 没有底部五页导航，也没有全宽顶部挡板。返回箭头仍在左上角，共用金币/钻石余额；标题使用资源栏下方的关卡页尖角菱形板。
- 临时连续世界地图可单指拖动、双指缩放；同时提供＋、－、定位和可滚动章节目录。相机限定地图边界，章旗文字与点击区保持屏幕尺寸，拖动不会当作旗标点击。
- 一章一个旗标，选择旗标显示真实历史最高已通层与解锁条件。底部复用左大金色「出战准备」、右深蓝「编队」与当前人数。
- 出战准备沿关卡页米色底板与金色「开始战斗」。没有难度选择、星级或宝箱。
- 挑战掉落展示为紧凑金币卡、概率装备分隔标题、每行6个真实品质方框装备图。只有装备列表局部滚动；详情列出真实池和各件权重占比，点装备查看属性与普通/精英/首领实际概率。
- 地图、准备页、目录、装备详情、编队支持已有返回流程。离开战斗回到无尽地图，保留会话内所选章节和视角；调整浏览器大小重建时也保留相机状态。

目前正式章节仍为前哨、深林、兽穴三章，目录从真实CAMPAIGN_CHAPTERS构建；临时地图其他5处只显示「待开放」，不伪造已实现章节、敌人或可开战入口。今后替换地图PNG和章节坐标即可继续扩展，不把每一层画成节点。临时地貌位置尚不是最终章节地理。

## 掉落与保存

无尽真实装备池已接入既有击杀掉落、拾取与背包系统。独立equipmentChance覆盖值由实际抽取与UI共用；主线普通/精英/地狱原掉率与奖励保持。

初始装备掉率：普通怪 **0.5%**、精英怪 **4%**、首领 **10%**，每次击杀至多抽一件。

| 无尽挑战 | 绿色占比 | 蓝色占比 | 紫色占比 |
| --- | ---: | ---: | ---: |
| 第1章 | 70% | 27% | 3% |
| 第2章 | 55% | 38% | 7% |
| 第3章及后续初始配置 | 45% | 43% | 12% |

上表为**已触发装备掉落后**的品质占比，同品质模板等权；只包含已定义且解锁章节不晚于所选章节的绿蓝紫装备/武器。不是每只怪获得该品质的绝对概率。白色新手武器/原白手套不加入本轮无尽池。装备按当前全体EQUIPS生成，包含已实装的新武器与四部位装备，拾取Lv.1实例，不自动穿戴、不覆盖现有装备。

金币继续用已有击杀金币数值，每层完成时差额入账。拾取的装备立即保存；每层完成、失败、主动结束挑战或离场时自动收取剩余落地装备。复用UID去重与金币差额结算，不重复发放。结算显示本次通层、抵达层、最高纪录、金币和装备数量，可打开本局装备明细，然后「返回地图」。

每次仍从1层开始，保留v59清层/3游戏秒休整/每5层首领/跨层强化与防线/累计怪池规则，不发钻石、主线星数、星级宝箱或首通奖励，不续接中断战局。强刷浏览器不会恢复未保存的当前层战斗；此前已保存收益与最高通层记录保留。

本轮掉率与品质分布是可调整的初值，尚无实际掉落节奏或经济平衡的人工验收结论。

## 美术与实现

复用[v61无UI临时地图](../endless-world-map-concept-v61/world-map-placeholder-v61.png)原字节，1024×1536，独立UUID接入scenes/bg_endless_world_v63。没有烘焙旗标、标题或锁图标，没有重新生图或修改原PNG。详情见[来源与散列](art.json)。v62效果图中的导航/全宽顶栏/大号金币装备示例卡已按用户最新标注取消。

主要新增代码为EndlessPage.ts、EndlessMapController.ts、EndlessLootPreview.ts；路由由MainUI/Flow/PageCtx负责，掉落覆盖由LevelDifficulty/StageLoot共享，BattleDirector按层收取并恢复二级页。旧BaseModalSession继续用于主城建设和怪物图鉴。

## 构建与发布记录

- 1970个原游戏/资源/构建文件仅10个脚本变化，1960个保持；新增3份TS及meta、1份原字节PNG及meta，共8文件。[差异](review.diff)、[源码清单](source-check.json)。原雷法v58的Hero.ts字节保持，未引入super getter。
- TypeScript使用Cocos自带编译器、ES2018/DOM与skipLibCheck静态检查；[原10个源码诊断](types-before.log)保持，[本轮结果](types-after.log)无新增。不是零诊断声明。
- Creator3.8.8 web-mobile生产/MD5构建：{duration}ms，退出{b['exitCode']}；DPR补丁与生产缓存步骤完成，引擎版本{w['engineRevision']}保持。
- 原{r['allOriginalNativeResourcesPreserved']}份native媒体路径与SHA保持，新增1张世界地图；原{r['priorPreviewFilesPreserved']}份历史预览路径与SHA保持。
- Wrangler main发布完成。入口HTTP200，线上入口版本、主JS包与新图SHA逐一匹配；[完整部署记录](deployment-stage.json)。
- **没有运行游戏、浏览器、测试、战斗模拟、音频或视觉/交互验收；这些由用户试玩确认。**只进行源码、类型、媒体、构建包与只读HTTP身份检查。
- 没有Git提交；原未提交工作与.tmp-kwsfx保留。
'''
(HERE/'README.md').write_text(text,encoding='utf-8')
ledger = f"2026-10-19 用户要求直接接入无尽世界地图并按最新截图去导航/全宽顶栏、改真实品质方框掉落展示；已发布[无尽世界地图v63](docs/endless-world-map-v63/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。基地无尽改独立二级页，左上返回、资源栏下关卡式菱形标题，单指拖动/双指缩放/定位/滚动目录，真实3章旗标+5待开放占位。下方左大金出战准备、右深蓝编队与人数；米色准备页含真实金币卡/6列品质装备图/局部滚动/概率与属性详情/开始战斗，无难度/星级/宝箱。v61原字节地图独立PNG/meta接入，不再沿v62导航与大示例奖励卡。章10关通关解锁和累计怪池保持，结束回地图、会话视角与选择保持。真实装备掉落已接，独立初值普通0.5%/精英4%/Boss10%，触发后绿蓝紫章1=70/27/3、章2=55/38/7、章3及后45/43/12，同品质等权，模板只取对应章及之前；含已有扩展武器/装备，不发白装/钻石。复用拾取即时保存/UID去重，通层与结束自动收取，金币差额入账，结果可看装备明细；无主线奖励串账。1970原文件仅10TS变化、1960保持，新增3TS及meta+地图及meta共8；原713媒体及793预览SHA保持，原10类型诊断无新增，雷法Hero字节保持。Creator{duration}ms退出{b['exitCode']}，DPR/缓存/引擎{w['engineRevision']}保持，main发布HTTP身份核对通过。未运行游戏/浏览器/测试/模拟/音频或视觉交互验收，需用户人工确认初始平衡和布局；无Git提交，原工作及.tmp-kwsfx保持。\n\n"
for name in ['README.md','AGENTS.md']:
    p=ROOT/name; old=read(p)
    if '[无尽世界地图v63]' in old:
        continue
    if name=='AGENTS.md':
        marker='# 交付要求\n\n'; assert marker in old
        new=old.replace(marker,marker+ledger,1)
    else:
        line,sep,rest=old.partition('\n'); new=line+'\n\n'+ledger+rest.lstrip('\n')
    p.write_text(new,encoding='utf-8')
print('Release documentation and project ledger updated.')
