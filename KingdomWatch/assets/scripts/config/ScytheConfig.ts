/** One source for combat, descriptions and training. All attacks deal magic damage. */
export const SCYTHE={attack:78,skill:104,aspd:.95,range:1120,skillRange:1180,cooldown:12,energy:80,speed:1000,halfLength:43};
export const SCYTHE_TIMING={windup:.48,reapStart:.62,reapGap:.24,reapTail:.62,skillWindup:.2,throw:.42,recall:.34,tick:.4};
const growth=(lv:number)=>(1+(lv-1)*.08)*(lv>=20?1.2:1);
export function scytheSkillCfg(lv:number){return {mul:.48*growth(lv)*(lv>=10?1.15:1),radius:155*(lv>=15?1.2:1),duration:4};}
/** Eight cuts plus a double-strength finisher retain the old three-wave total multiplier (8.1 at lv1). */
export function scytheUltCfg(lv:number){return {mul:.81*growth(lv)*(lv>=5?1.1:1)*(lv>=10?1.15:1),hits:9,finalMul:2,radius:320,
 duration:SCYTHE_TIMING.reapStart+8*SCYTHE_TIMING.reapGap+SCYTHE_TIMING.reapTail};}
export function scytheMilestones(slot:'atk'|'skill'|'ult'){
 const texts=slot==='atk'?['攻速 +6%','暴击率 +5%','普攻范围 +8%','普攻伤害 +20%']:
  slot==='skill'?['冷却 -1秒','旋转伤害 +15%','切割范围 +20%','技能伤害 +20%']:
  ['大招伤害 +10%','绞杀伤害 +15%','大招充能 -10%','大招伤害 +20%'];
 return texts.map((txt,i)=>({lv:(i+1)*5,txt}));
}
