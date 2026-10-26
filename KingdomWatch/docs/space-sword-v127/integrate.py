from pathlib import Path
import json, uuid
ROOT=Path(__file__).resolve().parents[2]
def edit(rel, old, new):
    p=ROOT/rel;s=p.read_text(encoding='utf-8')
    if old not in s: raise RuntimeError(f'Missing integration anchor: {rel}: {old[:70]}')
    p.write_text(s.replace(old,new),encoding='utf-8')
def prepend(rel,text):
    p=ROOT/rel;p.write_text(text+p.read_text(encoding='utf-8'),encoding='utf-8')
S='assets/scripts/'
prepend(S+'core/GameData.ts',"import { SPACE, SWORD } from '../config/SpaceSwordConfig';\n")
edit(S+'core/GameData.ts',"  ninja: {\n",'''  space: {
    id:'space', name:'伊芙·折界', job:'空间 · 传送切割', avatar:'ui_avatar_space',
    baseAtk:SPACE.attack, baseSkillDmg:SPACE.skill, growthType:'skill', atkSpd:SPACE.aspd,
    weaponName:'折界晶核', skillName:'空间放逐', ultName:'双重界刃', shopPrice:5600,
    story:'以紫晶折叠空间的守望者，将逼近城墙的敌人送回远方，再用横贯战场的界刃切开敌阵。',
  },
  sword: {
    id:'sword', name:'凌霄·御锋', job:'御剑 · 剑阵爆发', avatar:'ui_avatar_sword',
    baseAtk:SWORD.attack, baseSkillDmg:SWORD.skill, growthType:'hybrid', atkSpd:SWORD.aspd,
    weaponName:'青霄灵剑', skillName:'御剑追锋', ultName:'万剑归宗', shopPrice:5600,
    story:'远行至王国边境的御剑师。飞剑命中积蓄剑意，追锋破敌，剑阵落成时万剑归一。',
  },
  ninja: {
''')
edit(S+'core/GameData.ts',"...['wind', 'ninja'].map", "...['wind', 'ninja', 'space', 'sword'].map")
edit(S+'core/SaveData.ts',"'siphon', 'wind', 'ninja']", "'siphon', 'wind', 'ninja', 'space', 'sword']")
prepend(S+'config/Cards.ts',"import { SPACE, SWORD, spaceSkillCfg, swordSkillCfg } from './SpaceSwordConfig';\n")
edit(S+'config/Cards.ts',"    case 'wind': return", "    case 'space': return spaceSkillCfg(level).mul;\n    case 'sword': return swordSkillCfg(level).mul;\n    case 'wind': return")
edit(S+'config/Cards.ts','export interface GlobalStats {','''export function baseSpaceStats(): HeroStats {
  return {...baseArcherStats(), atk:SPACE.attack, skillDmg:SPACE.skill, aspd:SPACE.aspd,
    range:SPACE.range, skillRange:SPACE.skillRange};
}
export function baseSwordStats(): HeroStats {
  return {...baseArcherStats(), atk:SWORD.attack, skillDmg:SWORD.skill, aspd:SWORD.aspd,
    range:SWORD.range, skillRange:SWORD.skillRange};
}
export interface GlobalStats {''')
edit(S+'config/Cards.ts',"export const WIND_CARDS:","export const SPACE_CARDS: CardDef[] = commonHeroCards('space');\nexport const SWORD_CARDS: CardDef[] = commonHeroCards('sword');\nexport const WIND_CARDS:")
edit(S+'config/Cards.ts','...WIND_CARDS, ...NINJA_CARDS,','...WIND_CARDS, ...NINJA_CARDS, ...SPACE_CARDS, ...SWORD_CARDS,')
prepend(S+'battle/BattleDirector.ts',"import { SpaceHero, SwordHero } from './SpaceSwordHeroes';\nimport { baseSpaceStats, baseSwordStats } from '../config/Cards';\n")
edit(S+'battle/BattleDirector.ts',"const st = hid === 'wind' ?", "const st = hid === 'space' ? baseSpaceStats() : hid === 'sword' ? baseSwordStats() : hid === 'wind' ?")
edit(S+'battle/BattleDirector.ts',"return hid === 'wind' ?", "return hid === 'space' ? new SpaceHero(heroLayer, slots[i], st)\n        : hid === 'sword' ? new SwordHero(heroLayer, slots[i], st)\n        : hid === 'wind' ?")
edit(S+'battle/BattleDirector.ts',"hid === 'cannon' || hid === 'siphon' || hid === 'wind' || hid === 'ninja'", "['cannon', 'siphon', 'wind', 'ninja', 'space', 'sword'].includes(hid)")
edit(S+'config/Mobs.ts',"source === 'wind' ||", "source === 'space' || source === 'wind' ||")
edit(S+'battle/UltimateTiming.ts',"  wind: {", "  space: {windup:.6, duration:4},\n  sword: {windup:.55, duration:4.5},\n  wind: {")
edit(S+'battle/UltimatePresentation.ts',"  wind: [", "  space: [187,99,216], sword: [99,210,164],\n  wind: [")
edit(S+'ui/HeroComic.ts',"  wind: '#", "  space:'#EED6F5', sword:'#DEF1DE',\n  wind: '#")
edit(S+'ui/HeroComic.ts',"if (id === 'wind' || id === 'ninja')", "if (['wind','ninja','space','sword'].includes(id))")
edit(S+'ui/HeroComic.ts',"id === 'wind' || id === 'ninja' ? 24 / 768", "['wind','ninja','space','sword'].includes(id) ? 24 / 768")
edit(S+'ui/HUD.ts',"  wind: '#", "  space:'#BB63D8', sword:'#63D2A4',\n  wind: '#")
edit(S+'ui/HUD.ts',"      wind: ['#", "      space:['#BB63D8','#DFA7F0','#FFF0FF'],\n      sword:['#63D2A4','#B2E7CD','#FFF6D6'],\n      wind: ['#")
edit(S+'ui/PickArt.ts',"'wind', 'ninja'].includes", "'wind', 'ninja', 'space', 'sword'].includes")
edit(S+'ui/BattleEntryWarmup.ts',"    if (id === 'wind' || id === 'ninja') firstPaint", "    if (id === 'space' || id === 'sword') firstPaint.push(imageReady('new_heroes_v127/' + id + '_battle', priority));\n    if (id === 'wind' || id === 'ninja') firstPaint")
prepend(S+'ui/TrainingLobby.ts',"import { spaceUltCfg, swordUltCfg } from '../config/SpaceSwordConfig';\n")
edit(S+'ui/TrainingLobby.ts',"hid === 'cannon' || hid === 'siphon' || hid === 'wind' || hid === 'ninja'", "['cannon','siphon','wind','ninja','space','sword'].includes(hid)")
edit(S+'ui/TrainingLobby.ts',": hid === 'wind' ? windUltCfg(level).mul", ": hid === 'space' ? spaceUltCfg(level).mul : hid === 'sword' ? swordUltCfg(level).mul\n            : hid === 'wind' ? windUltCfg(level).mul")
edit(S+'ui/TrainingLobby.ts',"hid === 'wind' || hid === 'ninja' ? '大招每段技能倍率'", "['wind','ninja','space','sword'].includes(hid) ? '大招每段技能倍率'")
prepend(S+'ui/pages/UpgradePage.ts',"import { spaceSwordMilestones } from '../../config/SpaceSwordConfig';\n")
edit(S+'ui/pages/UpgradePage.ts',"  hid === 'wind' || hid === 'ninja' ? windNinjaMilestones", "  hid === 'space' || hid === 'sword' ? spaceSwordMilestones(hid,slot)\n    : hid === 'wind' || hid === 'ninja' ? windNinjaMilestones")
for mapping,key in [('SHOTS','skill'),('ULTIMATES','ult'),('SKILLS','skill'),('HEAVY_HITS','pierceHeavy')]:
    edit(S+'core/Sfx.ts',f'const {mapping}: Record<string, SfxName> = {{',f"const {mapping}: Record<string, SfxName> = {{ space:'{key}', sword:'{key}',")
edit(S+'config/Weapons.ts',"'cannon' | 'shuriken'", "'cannon' | 'shuriken' | 'sword'")
edit(S+'config/Weapons.ts',"shuriken: '手里剑'", "shuriken: '手里剑', sword:'灵剑'")
edit(S+'config/Weapons.ts','export const WEAPONS: Record<string, WeaponSpec> = {', '''export const WEAPONS: Record<string, WeaponSpec> = {
  wpn_starter_space: {id:'wpn_starter_space',name:'折界晶核',type:'staff',quality:0,tier:1,
    stats:{atk:8,skillDmg:10},price:0,unlock:'',art:'ui_icon_atk_space',starter:true,
    breakthrough:{atk:.07,skill:.09,secondary:'chargeEff',bonus:.02}},
  wpn_starter_sword: {id:'wpn_starter_sword',name:'青霄灵剑',type:'sword',quality:0,tier:1,
    stats:{atk:12,skillDmg:8},price:0,unlock:'',art:'ui_icon_atk_sword',starter:true,
    breakthrough:{atk:.09,skill:.07,secondary:'atkSpd',bonus:.02}},''')
edit(S+'config/Weapons.ts',"  wind: 'wpn_starter_wristfocus'", "  space:'wpn_starter_space',sword:'wpn_starter_sword',\n  wind: 'wpn_starter_wristfocus'")
edit(S+'config/Weapons.ts',"return hid === 'ninja' ?", "return hid === 'sword' ? type === 'sword' : hid === 'ninja' ?")
edit(S+'config/Weapons.ts',"'siphon', 'wind'].includes", "'siphon', 'wind', 'space'].includes")
edit(S+'config/Weapons.ts',"return type === 'shuriken' ?", "return type === 'sword' ? '御剑师专用' : type === 'shuriken' ?")
edit(S+'config/Weapons.ts',"火 / 雷 / 冰 / 生命 / 风系法师通用", "火 / 雷 / 冰 / 生命 / 风 / 空间法师通用")
for rel in ['config/SpaceSwordConfig.ts','battle/SpaceSwordHeroes.ts','battle/SpaceSwordVFX.ts']:
    p=ROOT/(S+rel+'.meta')
    if not p.exists():p.write_text(json.dumps({'ver':'4.0.24','importer':'typescript','imported':True,'uuid':str(uuid.uuid4()),'files':[],'subMetas':{},'userData':{}},indent=2)+'\n',encoding='utf-8')
print('Integrated two heroes without gifting old saves or changing source remote.')
