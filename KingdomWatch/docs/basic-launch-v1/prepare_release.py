"""Prepare build/publication scripts for the basic projectile release visuals."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
GAME = OUT.parents[1]
PREVIOUS = GAME/'docs/pick-comic-v1'
old_scope = 'original pick artwork and lower placement; ice idle/attack; new fire attack and idle loop; sniper 0.5/s, fire and volt 1/s'
scope = 'five hero basic projectile releases: bow/crossbow wind pressure, fire jet, violet lightning and frost crystals'
build = (PREVIOUS/'build_game.ps1').read_text(encoding='utf-8-sig')
build = build.replace('kwPick','kwBasicLaunch').replace('pick-comic-v1','basic-launch-v1').replace(old_scope,scope)
(OUT/'build_game.ps1').write_text(build,encoding='utf-8')
publisher = (PREVIOUS/'publish.ps1').read_text(encoding='utf-8-sig')
publisher = publisher.replace('kwPick','kwBasicLaunch').replace('pick-comic-v1','basic-launch-v1').replace(old_scope,scope)
publisher = publisher.replace('docs/settlement-comic-v1/deployment-stage.json','docs/pick-comic-v1/deployment-stage.json')
publisher = publisher.replace('layoutChanged = $true','layoutChanged = $false')
(OUT/'publish.ps1').write_text(publisher,encoding='utf-8')
integration = {'status':'source integrated, build pending','scope':scope,
    'renderer':'BasicAttackLaunchVFX; original native Graphics geometry, no AI generation',
    'styles':{'archer':{'element':'white/mint wind pressure','seconds':.18},
        'sniper':{'element':'white/blue wind pressure, 1.28x scale','seconds':.22},
        'pyro':{'element':'orange/red flame jet, pale yellow core and embers','seconds':.24},
        'volt':{'element':'violet branched lightning with pale core','seconds':.18},
        'mora':{'element':'ice-blue frosty air and small faceted crystals','seconds':.25}},
    'direction':'Normalized actual projectile direction; same world origin as the spawned basic projectile',
    'triggers':'Archer once per actual basic row including serial and empowered arrows; other four heroes once in shoot',
    'fanEffectDuplicatedPerArrow':False,'source':'User references for launch style, no copied game assets',
    'clock':'ImpactFX.tick battle simulation dt; pause, pick, settlement and speed handled by existing battle clock',
    'poolCapacity':36,'newNodesPerShot':0,'newTweensPerShot':0,'graphicsNodes':1,
    'retained':['all hero imagery and idle/attack atlases','projectile bodies and flight trails',
        'basic attack speed and damage','projectile speed, collision and hit callbacks',
        'skills, ultimates, sounds and UI'],
    'paidImageTasks':0,'paidVideoTasks':0,'gameplayTestsRun':False,
    'browserValidationRun':False,'onlineValidationRun':False,'userVisualAccepted':False}
(OUT/'integration.json').write_text(json.dumps(integration,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'README.md').write_text('''# 五英雄普攻发射特效

根据用户参考图的短促出手风压，使用原创原生 Graphics 几何绘制发射特效，不复制其他游戏素材，也不调用图片或视频模型。只改普攻发射瞬间，已完成的五英雄人物、待机和攻击序列帧保持。

- 弓箭手：0.18秒白青色空气膜、两道细风弧及顺弹道速度线。每排只发一次，齐射不按箭数叠加，连射每排独立触发；强化普攻轻微放大同款风压。
- 重弩手：0.22秒白蓝风压弧，基准放大到1.28倍，扩张更有冲击感。
- 火法师：0.24秒橙红外焰、短促黄色焰芯、左右焰舌及少量向前余烬。
- 雷法师：0.18秒紫色分叉电弧，淡紫白芯和少量电星；形态变化走模拟年龄，不使用画面帧数。
- 冰法师：0.25秒冰蓝霜气弧和细丝，几枚蓝白晶面小冰屑向发射方向散开。

坐标和方向来自真实普攻的同一出弹原点及拦截预判方向；按前向／垂向坐标绘制，左右与斜射自动一致。弓箭手原大招出手、全部技能、大招、命中特效、飞行中的弹体和拖尾保留。没有改伤害、攻速、弹速、碰撞、索敌或声音。

`BasicAttackLaunchVFX.ts` 为一个 Graphics 和最多36份预分配数据，满池只丢弃装饰，不阻挡出弹。无逐发 Node、Tween 或系统时间；通过 `ImpactFX.tick` 共用模拟时钟，因此暂停／三选一／结算冻结，倍速同步，场景销毁随原图层清理。

按用户要求只构建 Cocos 3.8.8 web-mobile、执行DPR补丁并发布 main，不运行测试、游戏、浏览器或线上效果验收。用户人工查看，源码接入与发布不等于视觉认可。构建、发布和回执由本目录保存。
''',encoding='utf-8')
print('Prepared basic launch release scripts and documentation')
