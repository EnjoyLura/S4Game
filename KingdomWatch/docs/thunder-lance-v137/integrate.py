from pathlib import Path
import json,uuid
ROOT=Path(__file__).resolve().parents[2]
def edit(rel,old,new):
 p=ROOT/'assets/scripts'/rel;s=p.read_text(encoding='utf-8')
 if old not in s:raise RuntimeError(f'Missing anchor {rel}: {old}')
 p.write_text(s.replace(old,new),encoding='utf-8')
def pre(rel,text):
 p=ROOT/'assets/scripts'/rel;p.write_text(text+'\n'+p.read_text(encoding='utf-8'),encoding='utf-8')
pre('core/GameData.ts',"import { LANCE } from '../config/ThunderLanceConfig';")
edit('core/GameData.ts','  space: {',"""  lance: {
    id:'lance',name:'雷恩·逐霆',job:'雷枪 · 持续雷域',avatar:'ui_avatar_lance',
    baseAtk:LANCE.attack,baseSkillDmg:LANCE.skill,growthType:'hybrid',atkSpd:LANCE.aspd,
    weaponName:'逐霆雷枪',skillName:'回雷枪雨',ultName:'天罚巨枪',shopPrice:5600,
    story:'将金色雷霆铸成投枪的战士。雷枪插地形成雷域，回收后化作枪雨；天罚巨枪落地爆发雷光，持续释放电冲击波。',
  },
  space: {""")
for rel in ['core/GameData.ts','core/SaveData.ts','battle/BattleDirector.ts','ui/PickArt.ts']:
 edit(rel,"'space', 'sword']","'space', 'sword', 'lance']")
pre('config/Cards.ts',"import { LANCE,lanceSkillCfg } from './ThunderLanceConfig';")
edit('config/Cards.ts',"    case 'space':", "    case 'lance': return lanceSkillCfg(level).mul;\n    case 'space':")
edit('config/Cards.ts','export function baseSpaceStats()',"export function baseLanceStats(): HeroStats {return {...baseArcherStats(),atk:LANCE.attack,skillDmg:LANCE.skill,aspd:LANCE.aspd,range:LANCE.range,skillRange:LANCE.skillRange};}\nexport function baseSpaceStats()")
edit('config/Cards.ts','export const SPACE_CARDS:',"export const LANCE_CARDS: CardDef[] = commonHeroCards('lance');\nexport const SPACE_CARDS:")
edit('config/Cards.ts','...SPACE_CARDS, ...SWORD_CARDS,','...SPACE_CARDS, ...SWORD_CARDS, ...LANCE_CARDS,')
pre('battle/BattleDirector.ts',"import { ThunderLanceHero } from './ThunderLanceHero';\nimport { baseLanceStats } from '../config/Cards';")
edit('battle/BattleDirector.ts',"const st = hid === 'space' ?","const st = hid === 'lance' ? baseLanceStats() : hid === 'space' ?")
edit('battle/BattleDirector.ts',"return hid === 'space' ?","return hid === 'lance' ? new ThunderLanceHero(heroLayer, slots[i], st) : hid === 'space' ?")
edit('battle/BattleDirector.ts',"    if (this.heroes.some(h => h.id === 'space'))", "    if (this.heroes.some(h => h.id === 'lance')) this.projs.warmLanceFlight();\n    if (this.heroes.some(h => h.id === 'space'))")
edit('config/Mobs.ts',"source === 'space' ||","source === 'lance' || source === 'space' ||")
edit('battle/UltimateTiming.ts',"  space: {","  lance: {windup:.65,duration:7.6},\n  space: {")
edit('battle/UltimatePresentation.ts',"  space: [","  lance: [255,211,79],\n  space: [")
edit('ui/HeroComic.ts',"  space:'#","  lance:'#FFF0BD',\n  space:'#")
edit('ui/HeroComic.ts',"'space','sword']","'space','sword','lance']")
edit('ui/ComicUI.ts','ninja|space|sword)', 'ninja|space|sword|lance)')
edit('ui/HUD.ts',"  space:'#","  lance:'#FFD34F',\n  space:'#")
edit('ui/HUD.ts',"      space:[", "      lance:['#DCA329','#FFD958','#FFF9CE'],\n      space:[")
edit('ui/BattleEntryWarmup.ts',"  space:['fx/space-sword-burst']", "  lance:['fx/thunder-lance-flow'],\n  space:['fx/space-sword-burst']")
edit('ui/BattleEntryWarmup.ts',"    if (id === 'space' || id === 'sword') firstPaint", "    if (id === 'lance') firstPaint.push(imageReady('new_heroes_v137/lance_battle', priority));\n    if (id === 'space' || id === 'sword') firstPaint")
pre('ui/TrainingLobby.ts',"import { lanceUltCfg } from '../config/ThunderLanceConfig';")
edit('ui/TrainingLobby.ts',"'space','sword'].includes(hid)","'space','sword','lance'].includes(hid)")
edit('ui/TrainingLobby.ts',": hid === 'space' ? spaceUltCfg(level).mul", ": hid === 'lance' ? lanceUltCfg(level).mul : hid === 'space' ? spaceUltCfg(level).mul")
edit('ui/TrainingLobby.ts',"hid === 'sword' ? '剑雨每剑技能倍率'", "hid === 'lance' ? '枪雨每枪技能倍率' : hid === 'sword' ? '剑雨每剑技能倍率'")
edit('ui/TrainingLobby.ts',"hid === 'space' ? '光柱每次技能倍率'", "hid === 'lance' ? '落地爆炸技能倍率' : hid === 'space' ? '光柱每次技能倍率'")
pre('ui/pages/UpgradePage.ts',"import { lanceMilestones } from '../../config/ThunderLanceConfig';")
edit('ui/pages/UpgradePage.ts',"  hid === 'space' || hid === 'sword' ?", "  hid === 'lance' ? lanceMilestones(slot) : hid === 'space' || hid === 'sword' ?")
pre('ui/GrowthFeedback.ts',"import { lanceUltCfg } from '../config/ThunderLanceConfig';")
edit('ui/GrowthFeedback.ts',"  space: newHeroNormalCfg", "  lance: newHeroNormalCfg,\n  space: newHeroNormalCfg")
edit('ui/GrowthFeedback.ts',"  space: lv =>", "  lance: lv => lanceUltCfg(lv).mul,\n  space: lv =>")
for name,key in [('SHOTS','thunder'),('SKILLS','thunderSkill'),('ULTIMATES','thunderUlt'),('HEAVY_HITS','thunderHeavy')]:
 edit('core/Sfx.ts',f'const {name}: Record<string, SfxName> = {{', f"const {name}: Record<string, SfxName> = {{ lance:'{key}',")
edit('config/Weapons.ts',"'shuriken' | 'sword';", "'shuriken' | 'sword' | 'spear';")
edit('config/Weapons.ts',"sword:'灵剑'", "sword:'灵剑',spear:'雷枪'")
edit('config/Weapons.ts','export const WEAPONS: Record<string, WeaponSpec> = {',"""export const WEAPONS: Record<string, WeaponSpec> = {
  wpn_starter_lance: {id:'wpn_starter_lance',name:'逐霆雷枪',type:'spear',quality:0,tier:1,
    stats:{atk:10,skillDmg:10},price:0,unlock:'',art:'ui_icon_atk_lance',starter:true,
    breakthrough:{atk:.08,skill:.08,secondary:'chargeEff',bonus:.02}},""")
edit('config/Weapons.ts',"  space:'wpn_starter_space'", "  lance:'wpn_starter_lance',\n  space:'wpn_starter_space'")
edit('config/Weapons.ts',"return hid === 'sword' ?", "return hid === 'lance' ? type === 'spear' : hid === 'sword' ?")
edit('config/Weapons.ts',"return type === 'sword' ?", "return type === 'spear' ? '雷枪专用' : type === 'sword' ?")
edit('battle/ImpactFX.ts',"  space: '#", "  lance: '#FFE477',\n  space: '#")
edit('ui/BattleComicPanels.ts',"= { space:", "= { lance:'#FFD34F', space:")
edit('ui/BattleProgressBar.ts',"  space: {", "  lance: { bar:'#EABD3E',value:'#FFF0B2' },\n  space: {")
pre('ui/Panels.ts',"import { LANCE,lanceSkillCfg,lanceUltCfg } from '../config/ThunderLanceConfig';")
edit('ui/Panels.ts',"    if (hero.id === 'space' || hero.id === 'sword') {", """    if (hero.id === 'lance') {
      w=350;const sc=lanceSkillCfg(h.skillLv),uc=lanceUltCfg(h.ultLv);
      if(kind==='atk'){
        title='普攻 · 插地雷枪';const hit=hero.effAtk*h.normalMul;
        rows=[['落地法伤',String(Math.round(hit))],['电击法伤',String(Math.round(hit*LANCE.tickMul))+' / '+LANCE.interval+'秒'],
          ['雷域持续',LANCE.seconds+'秒'],['雷域半径',String(LANCE.radius)],['攻速',h.aspd.toFixed(2)+'次/秒'],['效果','插地放电 · 可对空']];
      }else if(kind==='skill'){
        title='技能 · 回雷枪雨';rows=[['每枪法伤',String(Math.round(hero.abilityDamage(sc.mul)))],
          ['电击法伤',String(Math.round(hero.abilityDamage(sc.tickMul)))+' / '+sc.interval+'秒'],
          ['枪雨数量',sc.count+'柄 + 回收数量 · 上限'+sc.maxCount],['雷域持续',sc.seconds+'秒'],
          ['冷却',hero.skillCdTotal.toFixed(1)+'秒'],['效果','回收普通雷枪 · 保留大招巨枪']];
      }else{
        title='大招 · 天罚巨枪';rows=[['落地爆炸',String(Math.round(hero.abilityDamage(uc.mul,true)))+'法伤'],
          ['电冲击波',String(Math.round(hero.abilityDamage(uc.pulseMul,true)))+'法伤 / 秒'],
          ['巨枪持续',uc.seconds+'秒'],['伤害半径',String(Math.round(uc.radius*h.skillRangeMul))],
          ['充能需求',Math.round(hero.chargeGoal)+'能量'],['效果','密集处爆炸 · 持续电冲击波']];
      }
    } else if (hero.id === 'space' || hero.id === 'sword') {""")
pre('battle/Projectile.ts',"import { drawLanceFlight,LANCE_EFFECT } from './ThunderLanceVFX';")
edit('battle/Projectile.ts',"'heavenSword' | 'spaceBlade';", "'heavenSword' | 'spaceBlade' | 'lance' | 'greatLance';")
edit('battle/Projectile.ts','  swordShader: boolean;', '  swordShader: boolean;\n  lanceShader: boolean;')
edit('battle/Projectile.ts','  private swordFlight:', '  private lanceFlight: HeroFxShader | null = null;\n  private swordFlight:')
edit('battle/Projectile.ts','  warmSwordFlight(): void {',"  warmLanceFlight():void{this.lanceFlight ||=new HeroFxShader(this.field,'goldenLanceFlight',32,'plasma',{effect:LANCE_EFFECT,technique:0});}\n  warmSwordFlight(): void {")
edit('battle/Projectile.ts',"    a.swordShader =", "    a.lanceShader = (spec.visual==='lance'||spec.visual==='greatLance') && !!this.lanceFlight?.ready;\n    a.swordShader =")
edit('battle/Projectile.ts','swordShader: false, spaceShader: false', 'swordShader: false, lanceShader: false, spaceShader: false')
edit('battle/Projectile.ts','    this.swordFlight?.begin();','    this.lanceFlight?.begin();\n    this.swordFlight?.begin();')
edit('battle/Projectile.ts',"      if(s.visual==='spaceBlade')", "      if(s.visual==='lance'||s.visual==='greatLance'){drawLanceFlight(a.lanceShader?this.lanceFlight:null,g,s.x,s.y,Math.atan2(a.vy,a.vx),size,a.age,a.fxSeed);continue;}\n      if(s.visual==='spaceBlade')")
edit('battle/Projectile.ts','    this.swordFlight?.end();','    this.lanceFlight?.end();\n    this.swordFlight?.end();')
for rel in ['config/ThunderLanceConfig.ts','battle/ThunderLancePlans.ts','battle/ThunderLanceHero.ts','battle/ThunderLanceVFX.ts']:
 p=ROOT/'assets/scripts'/(rel+'.meta');p.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n',encoding='utf-8')
p=ROOT/'assets/resources/fx/thunder-lance-flow.effect.meta'
m=json.loads((ROOT/'assets/resources/fx/sword-jade-flow.effect.meta').read_text(encoding='utf-8'));m['uuid']=str(uuid.uuid4());p.write_text(json.dumps(m,indent=2)+'\n',encoding='utf-8')
print('Thunder lance integrated.')
