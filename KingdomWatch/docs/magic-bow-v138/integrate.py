from pathlib import Path
import json,uuid
ROOT=Path(__file__).resolve().parents[2]
def edit(rel,old,new):
 p=ROOT/'assets/scripts'/rel;s=p.read_text(encoding='utf-8')
 if old not in s:raise RuntimeError(f'Missing anchor {rel}: {old}')
 p.write_text(s.replace(old,new),encoding='utf-8')
def pre(rel,text):
 p=ROOT/'assets/scripts'/rel;p.write_text(text+'\n'+p.read_text(encoding='utf-8'),encoding='utf-8')
pre('core/GameData.ts',"import { MAGIC_BOW } from '../config/MagicBowConfig';")
edit('core/GameData.ts','  lance: {',"""  arcane: {
    id:'arcane',name:'希琳·星弦',job:'魔法弓 · 两段爆发',avatar:'ui_avatar_arcane',
    baseAtk:MAGIC_BOW.attack,baseSkillDmg:MAGIC_BOW.skill,growthType:'hybrid',atkSpd:MAGIC_BOW.aspd,
    weaponName:'星辉魔弓',skillName:'奥术爆裂箭',ultName:'星陨巨箭',shopPrice:5600,
    story:'以银弓引动星光的魔法射手。蓝色箭矢击穿敌阵，巨箭直上云霄，坠地冲击后再爆发奥术能量。',
  },
  lance: {""")
for rel in ['core/GameData.ts','core/SaveData.ts','battle/BattleDirector.ts','ui/PickArt.ts']:
 edit(rel,"'sword', 'lance']","'sword', 'lance', 'arcane']")
pre('config/Cards.ts',"import { MAGIC_BOW,magicBowSkillCfg } from './MagicBowConfig';")
edit('config/Cards.ts',"    case 'lance':", "    case 'arcane': return magicBowSkillCfg(level).mul;\n    case 'lance':")
edit('config/Cards.ts','export function baseLanceStats()',"export function baseMagicBowStats(): HeroStats {return {...baseArcherStats(),atk:MAGIC_BOW.attack,skillDmg:MAGIC_BOW.skill,aspd:MAGIC_BOW.aspd,range:MAGIC_BOW.range,skillRange:MAGIC_BOW.skillRange};}\nexport function baseLanceStats()")
edit('config/Cards.ts','export const LANCE_CARDS:',"export const MAGIC_BOW_CARDS: CardDef[] = commonHeroCards('arcane');\nexport const LANCE_CARDS:")
edit('config/Cards.ts','...LANCE_CARDS,','...LANCE_CARDS, ...MAGIC_BOW_CARDS,')
pre('battle/BattleDirector.ts',"import { MagicBowHero } from './MagicBowHero';\nimport { baseMagicBowStats } from '../config/Cards';")
edit('battle/BattleDirector.ts',"const st = hid === 'lance' ?","const st = hid === 'arcane' ? baseMagicBowStats() : hid === 'lance' ?")
edit('battle/BattleDirector.ts',"return hid === 'lance' ?","return hid === 'arcane' ? new MagicBowHero(heroLayer, slots[i], st) : hid === 'lance' ?")
edit('battle/BattleDirector.ts',"    if (this.heroes.some(h => h.id === 'lance'))", "    if (this.heroes.some(h => h.id === 'arcane')) this.projs.warmMagicBowFlight();\n    if (this.heroes.some(h => h.id === 'lance'))")
edit('config/Mobs.ts',"source === 'lance' ||","source === 'arcane' || source === 'lance' ||")
pre('battle/UltimateTiming.ts',"import { magicBowTimeline } from './MagicBowPlans';")
edit('battle/UltimateTiming.ts',"  lance: {","  arcane: {windup:magicBowTimeline().launch,duration:magicBowTimeline().end},\n  lance: {")
edit('battle/UltimatePresentation.ts',"  lance: [","  arcane: [105,191,255],\n  lance: [")
edit('ui/HeroComic.ts',"  lance:'#","  arcane:'#D7E9FF',\n  lance:'#")
edit('ui/HeroComic.ts',"'sword','lance']","'sword','lance','arcane']")
edit('ui/ComicUI.ts','space|sword|lance)', 'space|sword|lance|arcane)')
edit('ui/HUD.ts',"  lance:'#","  arcane:'#69BFFF',\n  lance:'#")
edit('ui/HUD.ts',"      lance:[", "      arcane:['#528FE3','#9CD7FF','#F0FAFF'],\n      lance:[")
edit('ui/BattleEntryWarmup.ts',"  lance:['fx/thunder-lance-flow']", "  arcane:['fx/magic-bow-flow'],\n  lance:['fx/thunder-lance-flow']")
edit('ui/BattleEntryWarmup.ts',"    if (id === 'lance') firstPaint", "    if (id === 'arcane') firstPaint.push(imageReady('new_heroes_v138/arcane_battle', priority));\n    if (id === 'lance') firstPaint")
pre('ui/TrainingLobby.ts',"import { magicBowUltCfg } from '../config/MagicBowConfig';")
edit('ui/TrainingLobby.ts',"'sword','lance'].includes(hid)","'sword','lance','arcane'].includes(hid)")
edit('ui/TrainingLobby.ts',": hid === 'lance' ? lanceUltCfg(level).mul", ": hid === 'arcane' ? magicBowUltCfg(level).mul : hid === 'lance' ? lanceUltCfg(level).mul")
edit('ui/TrainingLobby.ts',"hid === 'lance' ? '落地爆炸技能倍率'", "hid === 'arcane' ? '首段冲击技能倍率' : hid === 'lance' ? '落地爆炸技能倍率'")
pre('ui/pages/UpgradePage.ts',"import { magicBowMilestones } from '../../config/MagicBowConfig';")
edit('ui/pages/UpgradePage.ts',"  hid === 'lance' ?", "  hid === 'arcane' ? magicBowMilestones(slot) : hid === 'lance' ?")
pre('ui/GrowthFeedback.ts',"import { magicBowUltCfg } from '../config/MagicBowConfig';")
edit('ui/GrowthFeedback.ts',"  lance: newHeroNormalCfg", "  arcane: newHeroNormalCfg,\n  lance: newHeroNormalCfg")
edit('ui/GrowthFeedback.ts',"  lance: lv =>", "  arcane: lv => magicBowUltCfg(lv).mul,\n  lance: lv =>")
for name,key in [('SHOTS','bow'),('SKILLS','skill'),('ULTIMATES','bowUlt'),('HEAVY_HITS','pierceHeavy')]:
 edit('core/Sfx.ts',f'const {name}: Record<string, SfxName> = {{', f"const {name}: Record<string, SfxName> = {{ arcane:'{key}',")
edit('config/Weapons.ts',"'sword' | 'spear';", "'sword' | 'spear' | 'magicBow';")
edit('config/Weapons.ts',"spear:'雷枪'", "spear:'雷枪',magicBow:'魔法弓'")
edit('config/Weapons.ts','export const WEAPONS: Record<string, WeaponSpec> = {',"""export const WEAPONS: Record<string, WeaponSpec> = {
  wpn_starter_arcane: {id:'wpn_starter_arcane',name:'星辉魔弓',type:'magicBow',quality:0,tier:1,
    stats:{atk:10,skillDmg:10},price:0,unlock:'',art:'ui_icon_atk_arcane',starter:true,
    breakthrough:{atk:.08,skill:.08,secondary:'chargeEff',bonus:.02}},""")
edit('config/Weapons.ts',"  lance:'wpn_starter_lance'", "  arcane:'wpn_starter_arcane',\n  lance:'wpn_starter_lance'")
edit('config/Weapons.ts',"return hid === 'lance' ?", "return hid === 'arcane' ? type === 'magicBow' : hid === 'lance' ?")
edit('config/Weapons.ts',"return type === 'spear' ?", "return type === 'magicBow' ? '魔法弓手专用' : type === 'spear' ?")
edit('battle/ImpactFX.ts',"  lance: '#", "  arcane: '#A0D9FF',\n  lance: '#")
edit('ui/BattleComicPanels.ts',"= { lance:", "= { arcane:'#69BFFF', lance:")
edit('ui/BattleProgressBar.ts',"  lance: {", "  arcane: { bar:'#69BFFF',value:'#DFF3FF' },\n  lance: {")
pre('ui/Panels.ts',"import { MAGIC_BOW, MAGIC_BOW_TIMING, magicBowSkillCfg,magicBowUltCfg } from '../config/MagicBowConfig';")
edit('ui/Panels.ts',"    if (hero.id === 'lance') {", """    if (hero.id === 'arcane') {
      w=350;const sc=magicBowSkillCfg(h.skillLv),uc=magicBowUltCfg(h.ultLv);
      if(kind==='atk'){
        title='普攻 · 星辉魔箭';rows=[['法术伤害',String(Math.round(hero.effAtk*h.normalMul))],['攻速',h.aspd.toFixed(2)+'次/秒'],
          ['索敌范围',String(Math.round(h.range))],['弹速',String(MAGIC_BOW.speed)],['暴击率',Math.round(h.critRate*100)+'%'],['效果','魔法箭矢 · 可对空']];
      }else if(kind==='skill'){
        title='技能 · 奥术爆裂箭';rows=[['爆炸法伤',String(Math.round(hero.abilityDamage(sc.mul)))],
          ['爆炸半径',String(Math.round(sc.radius*h.skillRangeMul))],['冷却',hero.skillCdTotal.toFixed(1)+'秒'],
          ['施法范围',String(Math.round(h.skillRange))],['目标','敌群最密集处'],['效果','发射一支魔箭 · 命中爆炸']];
      }else{
        title='大招 · 星陨巨箭';rows=[['落地冲击',String(Math.round(hero.abilityDamage(uc.mul,true)))+'法伤'],
          ['第二段爆炸',String(Math.round(hero.abilityDamage(uc.blastMul,true)))+'法伤'],
          ['冲击 / 爆炸半径',Math.round(uc.impactRadius*h.skillRangeMul)+' / '+Math.round(uc.radius*h.skillRangeMul)],
          ['两段间隔',MAGIC_BOW_TIMING.detonation+'秒'],['充能需求',Math.round(hero.chargeGoal)+'能量'],['效果','升空后落下 · 冲击后再爆炸']];
      }
    } else if (hero.id === 'lance') {""")
pre('battle/Projectile.ts',"import { drawMagicArrow,MAGIC_BOW_EFFECT } from './MagicBowVFX';")
edit('battle/Projectile.ts',"'lance' | 'greatLance';", "'lance' | 'greatLance' | 'magicArrow';")
edit('battle/Projectile.ts','  lanceShader: boolean;', '  lanceShader: boolean;\n  magicBowShader: boolean;')
edit('battle/Projectile.ts','  private lanceFlight:', '  private magicBowFlight: HeroFxShader | null = null;\n  private lanceFlight:')
edit('battle/Projectile.ts','  warmLanceFlight():void{',"  warmMagicBowFlight():void{this.magicBowFlight ||=new HeroFxShader(this.field,'magicArrowFlight',32,'plasma',{effect:MAGIC_BOW_EFFECT,technique:0});}\n  warmLanceFlight():void{")
edit('battle/Projectile.ts',"    a.lanceShader =", "    a.magicBowShader = spec.visual==='magicArrow' && !!this.magicBowFlight?.ready;\n    a.lanceShader =")
edit('battle/Projectile.ts','lanceShader: false, spaceShader: false', 'lanceShader: false, magicBowShader: false, spaceShader: false')
edit('battle/Projectile.ts','    this.lanceFlight?.begin();','    this.magicBowFlight?.begin();\n    this.lanceFlight?.begin();')
edit('battle/Projectile.ts',"      if(s.visual==='lance'||s.visual==='greatLance'){", "      if(s.visual==='magicArrow'){drawMagicArrow(a.magicBowShader?this.magicBowFlight:null,g,s.x,s.y,Math.atan2(a.vy,a.vx),size,a.age,a.fxSeed);continue;}\n      if(s.visual==='lance'||s.visual==='greatLance'){")
edit('battle/Projectile.ts','    this.lanceFlight?.end();','    this.magicBowFlight?.end();\n    this.lanceFlight?.end();')
for rel in ['config/MagicBowConfig.ts','battle/MagicBowPlans.ts','battle/MagicBowHero.ts','battle/MagicBowVFX.ts']:
 p=ROOT/'assets/scripts'/(rel+'.meta');p.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n',encoding='utf-8')
p=ROOT/'assets/resources/fx/magic-bow-flow.effect.meta';m=json.loads((ROOT/'assets/resources/fx/thunder-lance-flow.effect.meta').read_text(encoding='utf-8'));m['uuid']=str(uuid.uuid4());p.write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
print('Magic bow integrated.')
