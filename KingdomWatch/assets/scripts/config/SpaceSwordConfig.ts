/** First playable space/sword values; battle, training and tips share these functions. */
export const SPACE = { attack: 83, skill: 100, aspd: .85, range: 1100, skillRange: 1150,
  cooldown: 14, energy: 76, speed: 920, targets: 4, prisonTargets: 6, columnSeconds: 3, columnPulses: 10, orbDelay: .35 };
export const SWORD = { attack: 92, skill: 98, aspd: 1, range: 1100, skillRange: 1200,
  cooldown: 10, energy: 72, speed: 1120, intentCap: 6, rainCount: 12, rainGap: .12, radius: 155,
  heavenGap: .3, heavenPause: .2 };
const growth = (level: number) => (1 + (level - 1) * .08) * (level >= 20 ? 1.2 : 1);
export function spaceSkillCfg(level: number) { return { mul: 1.6 * growth(level), targets: SPACE.targets,
  slow: level >= 10 ? .3 : .2, slowSeconds: level >= 15 ? 3 : 2 }; }
export function spaceUltCfg(level: number) { return { mul: .48 * growth(level),
  targets: SPACE.prisonTargets + (level >= 10 ? 2 : 0), duration: SPACE.columnSeconds, pulses: SPACE.columnPulses,
  radius: 105 * (level >= 5 ? 1.2 : 1), orbDelay: SPACE.orbDelay }; }
export function swordSkillCfg(level: number) { return { mul: .35 * growth(level), finalMul: 1.4 * growth(level),
  count: SWORD.rainCount + (level >= 10 ? 3 : 0), radius: SWORD.radius * (level >= 15 ? 1.15 : 1) }; }
export function swordUltCfg(level: number) { return { mul: 1.35 * growth(level) * (level >= 10 ? 1.15 : 1),
  finalMul: 4.2 * growth(level), radius: 240 * (level >= 5 ? 1.15 : 1),
  finalRadius: 320 * (level >= 5 ? 1.15 : 1), count: 5 }; }
export function spaceSwordMilestones(hero: string, slot: 'atk'|'skill'|'ult') {
  const text = slot === 'atk' ? ['攻速 +6%', '暴击率 +5%', '普攻范围 +8%', '普攻伤害 +20%']
    : hero === 'space' ? slot === 'skill' ? ['冷却 -1秒', '传送后减速 +10%', '减速持续 +1秒', '技能伤害 +20%']
      : ['光柱范围 +20%', '禁锢目标 +2', '大招充能 -10%', '光柱伤害 +20%']
    : slot === 'skill' ? ['冷却 -1秒', '落剑数量 +3', '剑阵范围 +15%', '剑阵伤害 +20%']
      : ['天剑范围 +15%', '四方天剑伤害 +15%', '大招充能 -10%', '天剑伤害 +20%'];
  return text.map((txt, i) => ({ lv: (i + 1) * 5, txt }));
}
