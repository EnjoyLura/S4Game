from pathlib import Path
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
read=lambda p:p.read_text(encoding='utf-8-sig')
r=json.loads(read(HERE/'deployment-stage.json'))
assert r['published'] and r['staticHttpCheck']['allIconHashesMatch']
assert r['staticHttpCheck']['nativeIconCount']==13
note=(f"已发布：[正式游戏]({r['game']})，[部署快照]({r['deployment']})。"
      "Creator3.8.8生产构建20364ms、退出36，DPR与缓存准备完成；"
      "入口index.000b2.js?v=1792343521，引擎revision 2cb74a1e8caa095a保持。"
      "Wrangler main上传36、复用2592、共2628文件；正式入口只读HTTP200，13张新图标均200且SHA256与源文件相同。"
      "1858原文件只变更6个脚本，新增13PNG与13meta；原资源及793历史预览逐项散列保持。"
      "原10条类型诊断无新增。没有运行游戏、浏览器、测试、模拟或音频，实际由用户人工验收，无新Git提交。")
p=HERE/'README.md'
s=read(p).replace('发布状态：待构建发布，最终以deployment-stage.json为准。',note)
if '## 生成素材' not in s:
    art=json.loads(read(HERE/'art-manifest.json'))['assets']
    s+='\n\n## 生成素材\n\n'
    s+='内置image_gen制作；[完整提示词](image-prompts.json)、[图标检查总览](final-art-contact.png)、[来源与散列](art-manifest.json)。最终资源：\n\n'
    s+='\n'.join('- ['+Path(a['path']).name+'](../../'+a['path']+')' for a in art)+'\n'
p.write_text(s,encoding='utf-8')
ledger=(f"2026-10-19 用户批准雷法整套强化并增加落雷眩晕+1.5秒金卡，要求火/雷旧图标形状检查重做，已发布"
        f"[雷法强化与圆形图标v52](docs/volt-cards-v52/README.md)，游戏 {r['game']} ，部署 {r['deployment']} 。"
        "雷法17卡白2蓝6紫5黄4，通用四卡原样；法术精研蓝×1.3三层技能/大招任一前置，电弧延伸蓝跳距×1.3三层不改首次索敌，冷却蓝−2秒三层，雷霆威能蓝大招×1.4三层；"
        "连锁增幅紫+2目标三层同次不重复，感电紫25%/3秒一层对全队生效，高压紫雷法自身对感电+30%累加两层，余电紫感电+1秒两层，两者需感电；快速充能紫×.75两层；"
        "解锁两黄各1，雷暴增援黄+5道两层15→25，雷霆震慑黄+1.5秒一层基础1→2.5秒，80级突破3秒，三强化需大招；士气删除/雷法加速窗口清理。"
        "普攻/连锁/落雷接高压与感电延时，保留局外突破；过期感电强度清空，同类取高刷新；连锁修正只标暴击未乘暴伤，连锁/落雷统计按实际扣血封顶，大招原本不暴击保持。"
        "额外落雷真实排队，前15道节奏保持，新五道组起点4.35/5.55秒、间隔.16秒，演出4.5→5.7→6.9秒，末道节拍同步，目标死亡重选保持。"
        "只读检查27候选图：火法5张旧不规则/镂空、雷法4张方底/越界重做，另4张雷法新图；13PNG内置image_gen参考弓箭手技能、完整满圆背景、原字节版本化入资源，两套选卡统一圆形Mask/cover/各自兜底且仅裁图标子树，其他英雄不变；"
        "火法所有卡效果及其他英雄卡/战斗保持。1858原文件仅Cards/Hero/Monster/Panels/PickArt/BattleComicPanels六脚本变化，新增13PNG+13meta，原媒体和793预览散列保持；"
        "原10类型诊断无新增，Creator20364ms退出36，DPR/缓存/引擎2cb74a1e8caa095a保持，Wrangler main上传36复用2592共2628，正式入口200且13图SHA256一致。"
        "未运行游戏/浏览器/测试/模拟/音频，用户人工验收，无Git提交，原工作及.tmp-kwsfx保持。")
for name in ['AGENTS.md','README.md']:
    p=ROOT/name
    s=read(p)
    if '[雷法强化与圆形图标v52]' not in s:
        first,sep,rest=s.partition('\n')
        p.write_text(first+'\n\n'+ledger+'\n'+rest,encoding='utf-8')
print('Release documentation updated:',r['game'])
