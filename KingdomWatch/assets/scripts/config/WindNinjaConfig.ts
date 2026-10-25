/** First playable wind/ninja values, shared by battle, training, and tips. */
export const WIND = { attack: 72, skill: 92, aspd: .9, range: 1050, skillRange: 950, cooldown: 12, energy: 70,
  bladeSpeed: 840, bladePierce: 2, bladeFalloff: .8, eyeRadius: 165, eyeDuration: 4, eyeTick: .5, eyeMul: .35,
  eyePull: 94, tornadoRadius: 120, tornadoDuration: 5, tornadoTick: .4, tornadoMul: .55, tornadoSpeed: 82, tornadoPull: 65 };
export const NINJA = { attack: 95, skill: 100, aspd: 1.1, range: 1000, skillRange: 1100, cooldown: 10, energy: 68,
  speed: 1000, markCap: 80, recallSpeed: 1100, recallMul: 1.8, ultRadius: 145, ultDuration: 4, ultTick: .25, ultMul: .38 };
export const VOLT_FIELD = { duration: 3, tick: .5, radius: 95, mul: .2, maxFields: 8 };
export function windSkillCfg(level: number) { return { mul: WIND.eyeMul*(1+(level-1)*.08)*(level>=20?1.2:1),
  radius: WIND.eyeRadius*(level>=15?1.15:1), duration: WIND.eyeDuration+(level>=10?1:0), pull: WIND.eyePull }; }
export function windUltCfg(level: number) { return { mul: WIND.tornadoMul*(1+(level-1)*.08)*(level>=20?1.2:1),
  radius: WIND.tornadoRadius*(level>=5?1.15:1), duration: WIND.tornadoDuration+(level>=10?1:0) }; }
export function ninjaSkillCfg(level: number) { return { mul: NINJA.recallMul*(1+(level-1)*.08)*(level>=20?1.2:1),
  speed: NINJA.recallSpeed*(level>=10?1.15:1), pierce: level>=15?2:0 }; }
export function ninjaUltCfg(level: number) { return { mul: NINJA.ultMul*(1+(level-1)*.08)*(level>=20?1.2:1),
  radius: NINJA.ultRadius*(level>=5?1.15:1), duration: NINJA.ultDuration+(level>=10?1:0) }; }
export function windNinjaMilestones(hero: string, slot: 'atk'|'skill'|'ult') {
  const text=slot==='atk'?['攻速 +6%','暴击率 +5%','普攻索敌范围 +8%','普攻伤害 +20%']
    :hero==='wind'?slot==='skill'?['冷却 -1秒','风眼持续 +1秒','风眼范围 +15%','切割伤害 +20%']
      :['龙卷范围 +15%','龙卷持续 +1秒','大招充能 -10%','龙卷伤害 +20%']
    :slot==='skill'?['冷却 -1秒','回收速度 +15%','回收额外穿透 +2','回收伤害 +20%']
      :['旋刃范围 +15%','旋刃持续 +1秒','大招充能 -10%','旋刃伤害 +20%'];
  return text.map((txt,i)=>({lv:(i+1)*5,txt}));
}
