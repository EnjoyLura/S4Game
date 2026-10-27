/** One source for combat values, training milestones and player-facing tips. */
export const LANCE = {attack:80,skill:100,aspd:.72,range:1100,skillRange:1150,cooldown:13,energy:80,
  speed:1080,radius:90,seconds:4.5,interval:.75,tickMul:.22,fieldCap:24,rainGap:.11,recallSeconds:.6};
const growth=(lv:number)=>(1+(lv-1)*.08)*(lv>=20?1.2:1);
export function lanceSkillCfg(lv:number){return {mul:.65*growth(lv),tickMul:.16*growth(lv),
  count:6+(lv>=10?2:0),maxCount:14+(lv>=10?2:0),radius:170*(lv>=15?1.15:1),seconds:4,interval:.8};}
export function lanceUltCfg(lv:number){return {mul:5.5*growth(lv),pulseMul:.65*growth(lv),
  radius:250*(lv>=5?1.15:1),seconds:6+(lv>=10?1:0),interval:1};}
export function lanceMilestones(slot:'atk'|'skill'|'ult'){
  const text=slot==='atk'?['攻速 +6%','暴击率 +5%','普攻范围 +8%','普攻伤害 +20%']
    :slot==='skill'?['冷却 -1秒','基础枪雨 +2柄','枪雨范围 +15%','技能伤害 +20%']
    :['巨枪范围 +15%','持续放电 +1秒','大招充能 -10%','大招伤害 +20%'];
  return text.map((txt,i)=>({lv:(i+1)*5,txt}));
}
