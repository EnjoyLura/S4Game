/** Shared combat, growth and tooltip values. */
export const MAGIC_BOW={attack:76,skill:106,aspd:1.05,range:1120,skillRange:1180,cooldown:11,energy:78,speed:1250};
export const MAGIC_BOW_TIMING={windup:.55,ascent:.5,skyPause:.18,descent:.56,detonation:.30,tail:.65};
const growth=(lv:number)=>(1+(lv-1)*.08)*(lv>=20?1.2:1);
export function magicBowSkillCfg(lv:number){return {mul:2.6*growth(lv)*(lv>=10?1.15:1),radius:150*(lv>=15?1.2:1)};}
export function magicBowUltCfg(lv:number){return {mul:3.4*growth(lv),blastMul:4.8*growth(lv)*(lv>=10?1.15:1),
  impactRadius:175*(lv>=5?1.15:1),radius:275*(lv>=5?1.15:1)};}
export function magicBowMilestones(slot:'atk'|'skill'|'ult'){
 const text=slot==='atk'?['攻速 +6%','暴击率 +5%','普攻范围 +8%','普攻伤害 +20%']
  :slot==='skill'?['冷却 -1秒','爆炸伤害 +15%','爆炸范围 +20%','技能伤害 +20%']
  :['落地与爆炸范围 +15%','第二段爆炸伤害 +15%','大招充能 -10%','两段伤害 +20%'];
 return text.map((txt,i)=>({lv:(i+1)*5,txt}));
}
