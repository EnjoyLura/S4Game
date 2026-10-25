/** First playable values; shared by battle, training and ability descriptions. */
export const NEW_HERO_IDS = ['cannon', 'siphon'] as const;
export const CANNON = { attack: 150, skill: 150, aspd: .45, range: 1100, skillRange: 1000,
  cooldown: 11, energy: 75, blast: 90, skillBlast: 150, shred: .15, shredSeconds: 4 };
export const SIPHON = { attack: 64, skill: 95, aspd: 1, range: 1000, skillRange: 950,
  cooldown: 12, energy: 62, tick: .25, rampPerSecond: .1, rampMax: .5 };
export const SIPHON_LASER = { windup: .6, duration: 1.8, tail: .18, tick: .15, halfWidth: 28, turnRate: .45 };
export function newHeroNormalCfg(level: number): { normalMul: number } {
  return { normalMul: (1 + (level - 1) * .08) * (level >= 20 ? 1.2 : 1) };
}
export function cannonSkillCfg(level: number) {
  return { mul: (2.2 + (level >= 20 ? .35 : 0)) * (1 + (level - 1) * .08),
    radiusMul: level >= 15 ? 1.2 : 1, shredSeconds: CANNON.shredSeconds + (level >= 10 ? 1 : 0) };
}
export function cannonUltCfg(level: number) {
  return { mul: (1.7 + (level >= 20 ? .3 : 0)) * (1 + (level - 1) * .08),
    shots: 6 + (level >= 5 ? 2 : 0), radius: 145 * (level >= 10 ? 1.2 : 1) };
}
export function siphonSkillCfg(level: number) {
  return { mul: (.75 + (level >= 20 ? .15 : 0)) * (1 + (level - 1) * .08),
    branches: 2 + (level >= 10 ? 1 : 0), duration: 4 + (level >= 15 ? 1 : 0) };
}
export function siphonUltCfg(level: number) {
  return { mul: (5.2 + (level >= 20 ? .8 : 0)) * (1 + (level - 1) * .08),
    halfWidth: SIPHON_LASER.halfWidth + (level >= 5 ? 6 : 0), duration: SIPHON_LASER.duration + (level >= 10 ? .3 : 0) };
}
export function newHeroMilestones(hero: string, slot: 'atk' | 'skill' | 'ult') {
  const texts = slot === 'atk' ? ['攻速 +6%', '暴击率 +5%', '普攻索敌范围 +8%', '普攻伤害 +20%']
    : hero === 'cannon' ? slot === 'skill'
      ? ['冷却 -1秒', '破甲持续 +1秒', '技能爆炸范围 +20%', '技能倍率 +0.35']
      : ['轰炸导弹 +2', '轰炸范围 +20%', '大招充能 -10%', '每弹倍率 +0.3']
    : slot === 'skill' ? ['冷却 -1秒', '分流目标 +1', '分流持续 +1秒', '分流倍率 +0.15']
      : ['激光宽度 +12', '激光持续 +0.3秒', '大招充能 -10%', '每秒倍率 +0.8'];
  return texts.map((txt, i) => ({ lv: (i + 1) * 5, txt }));
}
