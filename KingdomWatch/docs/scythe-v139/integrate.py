from pathlib import Path
import json,uuid
ROOT=Path(__file__).resolve().parents[2]
def edit(rel,old,new):
 p=ROOT/'assets/scripts'/rel;s=p.read_text(encoding='utf-8')
 if old not in s:raise RuntimeError(f'Missing {rel}: {old}')
 p.write_text(s.replace(old,new),encoding='utf-8')
def pre(rel,s):
 p=ROOT/'assets/scripts'/rel;p.write_text(s+'\n'+p.read_text(encoding='utf-8'),encoding='utf-8')
pre('core/GameData.ts',"import { SCYTHE } from '../config/ScytheConfig';")
edit('core/GameData.ts','  arcane: {',"""  scythe: {
    id:'scythe',name:'艾登·烬镰',job:'镰刀法师 · 横扫敌阵',avatar:'ui_avatar_scythe',
    baseAtk:SCYTHE.attack,baseSkillDmg:SCYTHE.skill,growthType:'hybrid',atkSpd:SCYTHE.aspd,
    weaponName:'赤焰长镰',skillName:'回旋猎镰',ultName:'三重断界',shopPrice:5600,
    story:'以赤焰长镰切开战场的法师。弧光掠过敌群，飞镰旋舞收割，三重巨刃横贯整片战场。',
  },
  arcane: {""")
for rel in ['core/GameData.ts','core/SaveData.ts','battle/BattleDirector.ts','ui/PickArt.ts']:
 edit(rel,"'lance', 'arcane']","'lance', 'arcane', 'scythe']")
pre('config/Cards.ts',"import { SCYTHE,scytheSkillCfg } from './ScytheConfig';")
edit('config/Cards.ts',"    case 'arcane':","    case 'scythe': return scytheSkillCfg(level).mul;\n    case 'arcane':")
edit('config/Cards.ts','export function baseMagicBowStats()',"export function baseScytheStats(): HeroStats {return {...baseArcherStats(),atk:SCYTHE.attack,skillDmg:SCYTHE.skill,aspd:SCYTHE.aspd,range:SCYTHE.range,skillRange:SCYTHE.skillRange};}\nexport function baseMagicBowStats()")
edit('config/Cards.ts','export const MAGIC_BOW_CARDS:',"export const SCYTHE_CARDS: CardDef[] = commonHeroCards('scythe');\nexport const MAGIC_BOW_CARDS:")
edit('config/Cards.ts','...MAGIC_BOW_CARDS,','...MAGIC_BOW_CARDS, ...SCYTHE_CARDS,')
pre('battle/BattleDirector.ts',"import { ScytheHero } from './ScytheHero';\nimport { baseScytheStats } from '../config/Cards';")
edit('battle/BattleDirector.ts',"const st = hid === 'arcane' ?","const st = hid === 'scythe' ? baseScytheStats() : hid === 'arcane' ?")
edit('battle/BattleDirector.ts',"return hid === 'arcane' ?","return hid === 'scythe' ? new ScytheHero(heroLayer, slots[i], st) : hid === 'arcane' ?")
edit('battle/BattleDirector.ts',"    if (this.heroes.some(h => h.id === 'arcane'))","    if (this.heroes.some(h => h.id === 'scythe')) this.projs.warmScytheFlight();\n    if (this.heroes.some(h => h.id === 'arcane'))")
edit('config/Mobs.ts',"source === 'arcane' ||","source === 'scythe' || source === 'arcane' ||")
edit('battle/UltimateTiming.ts',"  arcane: {","  scythe: {windup:.48,duration:3.8},\n  arcane: {")
edit('battle/UltimatePresentation.ts',"  arcane: [","  scythe: [255,110,56],\n  arcane: [")
edit('ui/HeroComic.ts',"  arcane:'#","  scythe:'#FFD4BD',\n  arcane:'#")
edit('ui/HeroComic.ts',"'lance','arcane']","'lance','arcane','scythe']")
edit('ui/ComicUI.ts','lance|arcane)', 'lance|arcane|scythe)')
edit('ui/HUD.ts',"  arcane:'#","  scythe:'#FF6E38',\n  arcane:'#")
edit('ui/HUD.ts',"      arcane:[","      scythe:['#CF3827','#FF8E43','#FFF0B8'],\n      arcane:[")
edit('ui/BattleEntryWarmup.ts',"  arcane:['fx/magic-bow-flow']","  scythe:['fx/scythe-flow'],\n  arcane:['fx/magic-bow-flow']")
edit('ui/BattleEntryWarmup.ts',"    if (id === 'arcane') firstPaint","    if (id === 'scythe') firstPaint.push(imageReady('new_heroes_v139/scythe_battle', priority));\n    if (id === 'arcane') firstPaint")
pre('ui/TrainingLobby.ts',"import { scytheUltCfg } from '../config/ScytheConfig';")
edit('ui/TrainingLobby.ts',"'lance','arcane'].includes(hid)","'lance','arcane','scythe'].includes(hid)")
edit('ui/TrainingLobby.ts',": hid === 'arcane' ? magicBowUltCfg(level).mul",": hid === 'scythe' ? scytheUltCfg(level).mul : hid === 'arcane' ? magicBowUltCfg(level).mul")
edit('ui/TrainingLobby.ts',"hid === 'arcane' ? '首段冲击技能倍率'","hid === 'scythe' ? '单道镰刃技能倍率' : hid === 'arcane' ? '首段冲击技能倍率'")
pre('ui/pages/UpgradePage.ts',"import { scytheMilestones } from '../../config/ScytheConfig';")
edit('ui/pages/UpgradePage.ts',"  hid === 'arcane' ?","  hid === 'scythe' ? scytheMilestones(slot) : hid === 'arcane' ?")
pre('ui/GrowthFeedback.ts',"import { scytheUltCfg } from '../config/ScytheConfig';")
edit('ui/GrowthFeedback.ts',"  arcane: newHeroNormalCfg","  scythe: newHeroNormalCfg,\n  arcane: newHeroNormalCfg")
edit('ui/GrowthFeedback.ts',"  arcane: lv =>","  scythe: lv => scytheUltCfg(lv).mul,\n  arcane: lv =>")
for name,key in [('SHOTS','pierce'),('SKILLS','skill'),('ULTIMATES','ult'),('HEAVY_HITS','pierceHeavy')]:
 edit('core/Sfx.ts',f'const {name}: Record<string, SfxName> = {{',f"const {name}: Record<string, SfxName> = {{ scythe:'{key}',")
edit('config/Weapons.ts',"| 'magicBow';","| 'magicBow' | 'scythe';")
edit('config/Weapons.ts',"magicBow:'魔法弓'","magicBow:'魔法弓',scythe:'镰刀'")
edit('config/Weapons.ts','export const WEAPONS: Record<string, WeaponSpec> = {',"""export const WEAPONS: Record<string, WeaponSpec> = {
  wpn_starter_scythe: {id:'wpn_starter_scythe',name:'赤焰长镰',type:'scythe',quality:0,tier:1,
    stats:{atk:10,skillDmg:10},price:0,unlock:'',art:'ui_icon_atk_scythe',starter:true,
    breakthrough:{atk:.08,skill:.08,secondary:'chargeEff',bonus:.02}},""")
edit('config/Weapons.ts',"  arcane:'wpn_starter_arcane'","  scythe:'wpn_starter_scythe',\n  arcane:'wpn_starter_arcane'")
edit('config/Weapons.ts',"return hid === 'arcane' ?","return hid === 'scythe' ? type === 'scythe' : hid === 'arcane' ?")
edit('config/Weapons.ts',"return type === 'magicBow' ?","return type === 'scythe' ? '镰刀法师专用' : type === 'magicBow' ?")
edit('battle/ImpactFX.ts',"  arcane: '#","  scythe: '#FF9A50',\n  arcane: '#")
edit('ui/BattleComicPanels.ts',"= { arcane:","= { scythe:'#FF6E38', arcane:")
edit('ui/BattleProgressBar.ts',"  arcane: {","  scythe: {bar:'#FF6E38',value:'#FFE7AE'},\n  arcane: {")
pre('ui/Panels.ts',"import { SCYTHE,SCYTHE_TIMING,scytheSkillCfg,scytheUltCfg } from '../config/ScytheConfig';")
edit('ui/Panels.ts',"    if (hero.id === 'arcane') {","""    if (hero.id === 'scythe') {
      w=350;const sc=scytheSkillCfg(h.skillLv),uc=scytheUltCfg(h.ultLv);
      if(kind==='atk'){
        title='普攻 · 赤焰弧刃';rows=[['法术伤害',String(Math.round(hero.effAtk*h.normalMul))],['攻速',h.aspd.toFixed(2)+'次/秒'],
          ['刃身宽度',String(SCYTHE.halfLength*2)],['索敌范围',String(Math.round(h.range))],['基础穿透','命中后可再穿透2个敌人'],['效果','圆弧光刃 · 可对空']];
      }else if(kind==='skill'){
        title='技能 · 回旋猎镰';rows=[['每次切割',String(Math.round(hero.abilityDamage(sc.mul)))+'法伤'],
          ['切割半径',String(Math.round(sc.radius*h.skillRangeMul))],['持续时间',sc.duration+'秒'],['伤害间隔',SCYTHE_TIMING.tick+'秒'],
          ['冷却',hero.skillCdTotal.toFixed(1)+'秒'],['效果','甩出长镰旋转切割 · 最后回收']];
      }else{
        title='大招 · 三重断界';rows=[['每道镰刃',String(Math.round(hero.abilityDamage(uc.mul,true)))+'法伤'],['数量','三道'],
          ['范围','横向全屏 · 向前贯穿'],['出手间隔',SCYTHE_TIMING.gap+'秒'],['充能需求',Math.round(hero.chargeGoal)+'能量'],['效果','每道巨刃对同一敌人命中一次']];
      }
    } else if (hero.id === 'arcane') {""")
pre('battle/Projectile.ts',"import { drawScytheBlade,SCYTHE_EFFECT } from './ScytheVFX';")
edit('battle/Projectile.ts',"| 'magicArrow';","| 'magicArrow' | 'scytheBlade';")
edit('battle/Projectile.ts','  magicBowShader: boolean;','  magicBowShader: boolean;\n  scytheShader: boolean;')
edit('battle/Projectile.ts','  private magicBowFlight:', '  private scytheFlight: HeroFxShader | null = null;\n  private magicBowFlight:')
edit('battle/Projectile.ts','  warmMagicBowFlight():void{',"  warmScytheFlight():void{this.scytheFlight ||=new HeroFxShader(this.field,'scytheBladeFlight',40,'plasma',{effect:SCYTHE_EFFECT,technique:0});}\n  warmMagicBowFlight():void{")
edit('battle/Projectile.ts','    a.magicBowShader =',"    a.scytheShader = spec.visual==='scytheBlade' && !!this.scytheFlight?.ready;\n    a.magicBowShader =")
edit('battle/Projectile.ts','magicBowShader: false,','magicBowShader: false, scytheShader: false,')
edit('battle/Projectile.ts','    this.magicBowFlight?.begin();','    this.scytheFlight?.begin();\n    this.magicBowFlight?.begin();')
edit('battle/Projectile.ts',"      if(s.visual==='magicArrow')", "      if(s.visual==='scytheBlade'){drawScytheBlade(a.scytheShader?this.scytheFlight:null,g,s.x,s.y,Math.atan2(a.vy,a.vx),s.lineHalfLength||43,a.age,a.fxSeed);continue;}\n      if(s.visual==='magicArrow')")
edit('battle/Projectile.ts','    this.magicBowFlight?.end();','    this.scytheFlight?.end();\n    this.magicBowFlight?.end();')
for rel in ['config/ScytheConfig.ts','battle/ScythePlans.ts','battle/ScytheHero.ts','battle/ScytheVFX.ts']:
 p=ROOT/'assets/scripts'/(rel+'.meta');p.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n',encoding='utf-8')
p=ROOT/'assets/resources/fx/scythe-flow.effect.meta';m=json.loads((ROOT/'assets/resources/fx/magic-bow-flow.effect.meta').read_text(encoding='utf-8'));m['uuid']=str(uuid.uuid4());p.write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
print('Scythe hero integrated.')
