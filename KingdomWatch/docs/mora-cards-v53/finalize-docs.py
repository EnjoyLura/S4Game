from pathlib import Path
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
r=json.loads(read(HERE/'deployment-stage.json'))
b=json.loads(read(HERE/'build-record.json'))
w=json.loads(read(HERE/'web-release.json'))
assert r['published'] and r['staticHttpCheck']['allIconHashesMatch']
assert r['staticHttpCheck']['nativeIconCount']==8
note=(f"已发布：[正式游戏]({r['game']})，[部署快照]({r['deployment']})。"
      f"Creator3.8.8生产构建19556ms、退出{b['exitCode']}，DPR和缓存准备完成；入口`{w['entry']}`，"
      f"引擎revision `{w['engineRevision']}`与v52一致。正式入口只读HTTP200，8张新图标均200且SHA256一致。"
      "Wrangler main上传26份、复用2626份、共2652份文件。"
      f"核对{r['originalFilesChecked']}个原文件，仅7脚本变化，新增8PNG+8meta；"
      f"原全部媒体与{r['priorPreviewFilesPreserved']}份历史预览散列保持。原10条类型诊断无新增。"
      "没有运行游戏、浏览器、测试、模拟或音频，实际由用户人工验收，无新Git提交。")
p=HERE/'README.md'
s=read(p).replace('发布状态：待构建发布，最终以deployment-stage.json为准。',note)
art=json.loads(read(HERE/'art-manifest.json'))['assets']
if '## 生成素材' not in s:
    s+='\n\n## 生成素材\n\n内置image_gen制作；[完整提示词](image-prompts.json)、[图标总览](final-art-contact.png)、[来源与散列](art-manifest.json)。最终资源：\n\n'
    s+='\n'.join('- ['+Path(a['path']).name+'](../../'+a['path']+')' for a in art)+'\n'
p.write_text(s,encoding='utf-8')
ledger=(f"2026-10-19 用户批准冰法整套卡，冰封延长改+1秒，大招一段改三段，不合格图标重生；已发布"
        f"[冰法强化与三段大招v53](docs/mora-cards-v53/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。"
        "17卡白2蓝7紫5金3，通用四卡保持，法术精研蓝×1.3三层技能/大招任一前置；极寒扩散蓝半径×1.2三层不改首次索敌，冷却蓝−2秒三层；"
        "凛冬蓝全系减速+10个百分点三层上限90%，冰川蓝大招×1.4三层；速冻紫普攻实际命中冰冻0.6秒+15%概率两层，低等级0→15→30%，70级突破15→30→45%，修复旧无突破不生效及发射就冻；"
        "碎冰紫仅冰法自身对减速/冰封普攻技能大招+30%累加两层，与既有普攻15级对减速+25%独立；寒冬紫全系减速+1秒两层无大招前置、不延长冰封；"
        "冰封延长紫需技能+1秒两层基础1.5→2.5→3.5秒、局外80及技能15合计4.2秒；快速充能紫×.75两层；解锁两金各1；绝对零度金1层需大招，命中冰封1.5秒刷新不相加，解冻后减速，Boss免冻仍受大招伤害及减速；士气移除。"
        "大招0.5/1.7/2.9秒三次全场实际命中，原总基础伤害均分三份，逐段当前活怪/状态重算；保留4.2秒演出、256颗连续全场随机雨、原视频音效，非重复整场三次。"
        "领域修复暴击只标记未乘倍率，领域及大招统计真实扣血封顶；旧其他英雄卡/战斗与永久养成不变。"
        "只读检查17图，重做7旧冰法不规则/方底/镂空图+新增冰封延长，共8张内置image_gen参考弓箭手技能，满圆不透明场景、圆外透明；原字节版本化入资源，两套选卡统一圆形Mask/冰蓝兜底/cover仅裁图标子树。"
        f"{r['originalFilesChecked']}原文件只改Cards/Hero/Projectile/UltimateTiming/Panels/PickArt/BattleComicPanels七脚本，新增8PNG+8meta，原媒体和{r['priorPreviewFilesPreserved']}预览散列保持；"
        f"原10类型诊断无新增，Creator19556ms退出{b['exitCode']}，DPR/缓存/引擎{w['engineRevision']}保持，Wrangler main上传26复用2626共2652，入口200且8图SHA256一致。"
        "未运行游戏/浏览器/测试/模拟/音频，用户人工验收，无Git提交，原工作及.tmp-kwsfx保持。")
for name in ['README.md','AGENTS.md']:
    p=ROOT/name;s=read(p)
    if '[冰法强化与三段大招v53]' not in s:
        first,sep,rest=s.partition('\n')
        p.write_text(first+'\n\n'+ledger+'\n'+rest,encoding='utf-8')
print('Release documentation updated:',r['game'])
