/** First playable space/sword values; battle, training and tips share these functions. */
export const SPACE = { attack: 83, skill: 100, aspd: .85, range: 1100, skillRange: 1150,
  cooldown: 14, energy: 76, speed: 920, targets: 4, ultSpeed: 850, bladeGap: .65 };
export const SWORD = { attack: 92, skill: 98, aspd: 1, range: 1100, skillRange: 1200,
  cooldown: 10, energy: 72, speed: 1120, intentCap: 6, rainCount: 12, rainGap: .18, radius: 155 };
const growth = (level: number) => (1 + (level - 1) * .08) * (level >= 20 ? 1.2 : 1);
export function spaceSkillCfg(level: number) { return { mul: 1.6 * growth(level), targets: SPACE.targets,
  slow: level >= 10 ? .3 : .2, slowSeconds: level >= 15 ? 3 : 2 }; }
export function spaceUltCfg(level: number) { return { mul: 3.6 * growth(level), speed: SPACE.ultSpeed,
  halfLength: 423, gap: SPACE.bladeGap, slow: level >= 5 ? .3 : 0, slowSeconds: level >= 10 ? 3 : 2 }; }
export function swordSkillCfg(level: number) { return { mul: .85 * growth(level),
  swords: 3 + (level >= 10 ? 1 : 0), speed: SWORD.speed * (level >= 15 ? 1.15 : 1) }; }
export function swordUltCfg(level: number) { return { mul: .65 * growth(level), finalMul: 3.2 * growth(level),
  radius: SWORD.radius * (level >= 5 ? 1.15 : 1), count: SWORD.rainCount + (level >= 10 ? 3 : 0) }; }
export function spaceSwordMilestones(hero: string, slot: 'atk'|'skill'|'ult') {
  const text = slot === 'atk' ? ['攻速 +6%', '暴击率 +5%', '普攻范围 +8%', '普攻伤害 +20%']
    : hero === 'space' ? slot === 'skill' ? ['冷却 -1秒', '传送后减速 +10%', '减速持续 +1秒', '技能伤害 +20%']
      : ['魔法刃附带30%减速', '减速持续 +1秒', '大招充能 -10%', '魔法刃伤害 +20%']
    : slot === 'skill' ? ['冷却 -1秒', '追击飞剑 +1', '飞剑速度 +15%', '追击伤害 +20%']
      : ['剑阵范围 +15%', '落剑数量 +3', '大招充能 -10%', '剑阵伤害 +20%'];
  return text.map((txt, i) => ({ lv: (i + 1) * 5, txt }));
}
