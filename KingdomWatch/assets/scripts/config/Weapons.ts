/** Pure weapon catalog: also safe to read while migrating the save (no GameData dependency). */
export type WeaponType = 'bow' | 'crossbow' | 'book' | 'staff' | 'cannon';
export const WEAPON_TYPE_NAME: Record<WeaponType, string> = { bow: '弓', crossbow: '弩', book: '魔法书', staff: '法杖', cannon: '重炮' };
export interface WeaponSpec {
  id: string; name: string; type: WeaponType; quality: 0 | 1 | 2 | 3; tier: number;
  focus?: string; description?: string;
  stats: { atk: number; skillDmg: number; atkSpd?: number; critRate?: number; critDmg?: number; chargeEff?: number };
  price: number; unlock: string; art: string; starter?: boolean;
  /** Per ten levels; secondary bonus at 30/60/90. All rates are additive. */
  breakthrough: { atk: number; skill: number; secondary: 'atkSpd' | 'critRate' | 'chargeEff' | 'critDmg'; bonus: number };
}
const art = (name: string): string => 'weapons_v1/' + name;
export const WEAPONS: Record<string, WeaponSpec> = {
  wpn_starter_cannon: { id: 'wpn_starter_cannon', name: '铜铸重炮', type: 'cannon', quality: 0, tier: 1,
    stats: { atk: 14, skillDmg: 6 }, price: 0, unlock: '', art: 'ui_icon_atk_cannon', starter: true,
    breakthrough: { atk: .1, skill: .08, secondary: 'critRate', bonus: .015 } },
  wpn_starter_bow: { id: 'wpn_starter_bow', name: '狩猎木弓', type: 'bow', quality: 0, tier: 1, stats: { atk: 8, skillDmg: 4 }, price: 0, unlock: '', art: art('starter_bow_v2'), starter: true, breakthrough: { atk: .09, skill: .07, secondary: 'atkSpd', bonus: .02 } },
  wpn_starter_crossbow: { id: 'wpn_starter_crossbow', name: '制式轻弩', type: 'crossbow', quality: 0, tier: 1, stats: { atk: 14, skillDmg: 4 }, price: 0, unlock: '', art: art('starter_crossbow'), starter: true, breakthrough: { atk: .10, skill: .06, secondary: 'critRate', bonus: .01 } },
  wpn_starter_book: { id: 'wpn_starter_book', name: '学徒魔法书', type: 'book', quality: 0, tier: 1, stats: { atk: 4, skillDmg: 12 }, price: 0, unlock: '', art: art('starter_book'), starter: true, breakthrough: { atk: .06, skill: .10, secondary: 'chargeEff', bonus: .02 } },
  wpn_starter_staff: { id: 'wpn_starter_staff', name: '学徒法杖', type: 'staff', quality: 0, tier: 1, stats: { atk: 6, skillDmg: 10 }, price: 0, unlock: '', art: art('starter_staff'), starter: true, breakthrough: { atk: .07, skill: .09, secondary: 'critDmg', bonus: .04 } },
  // Existing IDs, ownership and base stats remain valid.
  wpn_bow: { id: 'wpn_bow', name: '猎风长弓', type: 'bow', quality: 1, tier: 1, stats: { atk: 24, skillDmg: 14, atkSpd: .08 }, price: 800, unlock: '1-1', art: art('green_bow_v2'), breakthrough: { atk: .10, skill: .08, secondary: 'atkSpd', bonus: .03 } },
  wpn_green_crossbow: { id: 'wpn_green_crossbow', name: '巡林轻弩', type: 'crossbow', quality: 1, tier: 1, stats: { atk: 30, skillDmg: 10, critRate: .03 }, price: 800, unlock: '1-1', art: art('green_crossbow'), breakthrough: { atk: .11, skill: .07, secondary: 'critRate', bonus: .015 } },
  wpn_green_book: { id: 'wpn_green_book', name: '翠纹秘典', type: 'book', quality: 1, tier: 1, stats: { atk: 12, skillDmg: 30, chargeEff: .06 }, price: 800, unlock: '1-1', art: art('green_book'), breakthrough: { atk: .07, skill: .11, secondary: 'chargeEff', bonus: .03 } },
  wpn_green_staff: { id: 'wpn_green_staff', name: '林语法杖', type: 'staff', quality: 1, tier: 1, stats: { atk: 16, skillDmg: 26, critDmg: .12 }, price: 800, unlock: '1-1', art: art('green_staff'), breakthrough: { atk: .08, skill: .10, secondary: 'critDmg', bonus: .06 } },
  wpn_crossbow: { id: 'wpn_crossbow', name: '鹰眼重弩', type: 'crossbow', quality: 3, tier: 2, stats: { atk: 46, skillDmg: 26, critRate: .05 }, price: 1200, unlock: '1-2', art: 'shop_comic_v1/comic_wpn_crossbow_v1', breakthrough: { atk: .12, skill: .08, secondary: 'critRate', bonus: .02 } },
  // Two new choices per type at rare and epic quality; existing templates above stay unchanged.
  wpn_blue_swift_bow: { id: 'wpn_blue_swift_bow', name: '疾羽短弓', type: 'bow', quality: 2, tier: 1, focus: '攻速弓', description: '轻盈的羽翼形短弓，提供攻击、技能伤害和攻速，适合持续普攻。', stats: { atk: 36, skillDmg: 20, atkSpd: .10 }, price: 1000, unlock: '1-2', art: art('blue_swift_bow_v56'), breakthrough: { atk: .11, skill: .08, secondary: 'atkSpd', bonus: .03 } },
  wpn_blue_briar_bow: { id: 'wpn_blue_briar_bow', name: '铁棘长弓', type: 'bow', quality: 2, tier: 1, focus: '暴击弓', description: '铁棘加固的长弓，攻击较高，兼顾技能伤害与暴击率，适合暴击普攻。', stats: { atk: 40, skillDmg: 16, critRate: .045 }, price: 1000, unlock: '1-2', art: art('blue_briar_bow_v56'), breakthrough: { atk: .12, skill: .07, secondary: 'critRate', bonus: .015 } },
  wpn_purple_gale_bow: { id: 'wpn_purple_gale_bow', name: '逐风之弓', type: 'bow', quality: 3, tier: 2, focus: '攻速弓', description: '象牙色羽翼弓臂搭配金属护片，提供攻击、技能伤害和攻速，延续快速射击路线。', stats: { atk: 40, skillDmg: 22, atkSpd: .10 }, price: 1600, unlock: '1-4', art: art('purple_gale_bow_v56'), breakthrough: { atk: .12, skill: .09, secondary: 'atkSpd', bonus: .035 } },
  wpn_purple_raven_bow: { id: 'wpn_purple_raven_bow', name: '鸦羽猎弓', type: 'bow', quality: 3, tier: 2, focus: '暴击弓', description: '乌木与鸦羽形护片打造的猎弓，偏重攻击和暴击率，同时保留技能伤害。', stats: { atk: 44, skillDmg: 18, critRate: .045 }, price: 1600, unlock: '1-4', art: art('purple_raven_bow_v56'), breakthrough: { atk: .13, skill: .08, secondary: 'critRate', bonus: .02 } },
  wpn_blue_hawk_crossbow: { id: 'wpn_blue_hawk_crossbow', name: '隼翼轻弩', type: 'crossbow', quality: 2, tier: 1, focus: '暴击弩', description: '轻巧的隼翼弩臂便于稳定瞄准，提供攻击、技能伤害与暴击率。', stats: { atk: 46, skillDmg: 14, critRate: .05 }, price: 1000, unlock: '1-2', art: art('blue_hawk_crossbow_v56'), breakthrough: { atk: .12, skill: .07, secondary: 'critRate', bonus: .02 } },
  wpn_blue_rock_crossbow: { id: 'wpn_blue_rock_crossbow', name: '碎岩重弩', type: 'crossbow', quality: 2, tier: 1, focus: '暴伤弩', description: '厚重的铁臂与坚固弩床，兼顾攻击、技能伤害和暴击伤害，适合已有暴击率的搭配。', stats: { atk: 42, skillDmg: 18, critDmg: .20 }, price: 1000, unlock: '1-2', art: art('blue_rock_crossbow_v56'), breakthrough: { atk: .11, skill: .08, secondary: 'critDmg', bonus: .08 } },
  wpn_purple_falcon_crossbow: { id: 'wpn_purple_falcon_crossbow', name: '银隼战弩', type: 'crossbow', quality: 3, tier: 2, focus: '暴击弩', description: '银钢隼翼与长弩轨强调精准重击，偏重攻击和暴击率，兼顾技能伤害。', stats: { atk: 52, skillDmg: 20, critRate: .055 }, price: 1600, unlock: '1-4', art: art('purple_falcon_crossbow_v56'), breakthrough: { atk: .13, skill: .08, secondary: 'critRate', bonus: .025 } },
  wpn_purple_siege_crossbow: { id: 'wpn_purple_siege_crossbow', name: '裂城重弩', type: 'crossbow', quality: 3, tier: 2, focus: '暴伤弩', description: '重型铁臂和青铜机括构成的攻城弩，兼顾攻击、技能伤害与暴击伤害。', stats: { atk: 48, skillDmg: 24, critDmg: .24 }, price: 1600, unlock: '1-4', art: art('purple_siege_crossbow_v56'), breakthrough: { atk: .12, skill: .09, secondary: 'critDmg', bonus: .10 } },
  wpn_blue_tide_book: { id: 'wpn_blue_tide_book', name: '潮汐秘典', type: 'book', quality: 2, tier: 1, focus: '充能魔法书', description: '银色潮纹封面的秘典，偏重技能伤害与充能效率，并提供少量攻击。三系法师通用。', stats: { atk: 18, skillDmg: 44, chargeEff: .09 }, price: 1000, unlock: '1-2', art: art('blue_tide_book_v56'), breakthrough: { atk: .07, skill: .12, secondary: 'chargeEff', bonus: .04 } },
  wpn_blue_ember_book: { id: 'wpn_blue_ember_book', name: '烬纹魔典', type: 'book', quality: 2, tier: 1, focus: '暴击魔法书', description: '烬色皮革与琥珀纹章的魔典，提供攻击、技能伤害和暴击率，适合兼顾法术输出与暴击的搭配。三系法师通用。', stats: { atk: 22, skillDmg: 40, critRate: .04 }, price: 1000, unlock: '1-2', art: art('blue_ember_book_v56'), breakthrough: { atk: .08, skill: .11, secondary: 'critRate', bonus: .015 } },
  wpn_purple_star_book: { id: 'wpn_purple_star_book', name: '星潮法典', type: 'book', quality: 3, tier: 2, focus: '充能魔法书', description: '星盘纹章与银白护角装订的法典，偏重技能伤害与充能效率，适合频繁准备大招。三系法师通用。', stats: { atk: 22, skillDmg: 46, chargeEff: .10 }, price: 1600, unlock: '1-4', art: art('purple_star_book_v56'), breakthrough: { atk: .08, skill: .13, secondary: 'chargeEff', bonus: .05 } },
  wpn_purple_dusk_book: { id: 'wpn_purple_dusk_book', name: '暮鸦秘录', type: 'book', quality: 3, tier: 2, focus: '暴击魔法书', description: '暮色皮革封面镶嵌鸦翼纹章，提供攻击、技能伤害和暴击率。三系法师通用。', stats: { atk: 26, skillDmg: 42, critRate: .045 }, price: 1600, unlock: '1-4', art: art('purple_dusk_book_v56'), breakthrough: { atk: .09, skill: .12, secondary: 'critRate', bonus: .02 } },
  wpn_blue_frost_staff: { id: 'wpn_blue_frost_staff', name: '霜晶法杖', type: 'staff', quality: 2, tier: 1, focus: '暴伤法杖', description: '银爪托起淡蓝霜晶的法杖，提供攻击、技能伤害和暴击伤害，适合提高暴击命中的伤害。三系法师通用。', stats: { atk: 24, skillDmg: 38, critDmg: .18 }, price: 1000, unlock: '1-2', art: art('blue_frost_staff_v56'), breakthrough: { atk: .09, skill: .10, secondary: 'critDmg', bonus: .08 } },
  wpn_blue_echo_staff: { id: 'wpn_blue_echo_staff', name: '回响法杖', type: 'staff', quality: 2, tier: 1, focus: '充能法杖', description: '黄铜环首包围青色宝珠，偏重技能伤害和充能效率，兼顾攻击。三系法师通用。', stats: { atk: 20, skillDmg: 42, chargeEff: .09 }, price: 1000, unlock: '1-2', art: art('blue_echo_staff_v56'), breakthrough: { atk: .08, skill: .11, secondary: 'chargeEff', bonus: .04 } },
  wpn_purple_sun_staff: { id: 'wpn_purple_sun_staff', name: '裂日法杖', type: 'staff', quality: 3, tier: 2, focus: '暴伤法杖', description: '金色日轮杖首与琥珀晶石，提供攻击、技能伤害和暴击伤害，适合暴击搭配。三系法师通用。', stats: { atk: 28, skillDmg: 42, critDmg: .20 }, price: 1600, unlock: '1-4', art: art('purple_sun_staff_v56'), breakthrough: { atk: .10, skill: .11, secondary: 'critDmg', bonus: .10 } },
  wpn_purple_moon_staff: { id: 'wpn_purple_moon_staff', name: '月泉法杖', type: 'staff', quality: 3, tier: 2, focus: '充能法杖', description: '象牙色杖身与银月托珠，偏重技能伤害和充能效率，并提供攻击。三系法师通用。', stats: { atk: 24, skillDmg: 46, chargeEff: .10 }, price: 1600, unlock: '1-4', art: art('purple_moon_staff_v56'), breakthrough: { atk: .09, skill: .12, secondary: 'chargeEff', bonus: .05 } },
};
export const STARTER_WEAPON: Record<string, string> = {
  cannon: 'wpn_starter_cannon', siphon: 'wpn_starter_staff',
  archer: 'wpn_starter_bow', sniper: 'wpn_starter_crossbow', pyro: 'wpn_starter_book', volt: 'wpn_starter_staff', mora: 'wpn_starter_staff',
};
export function weaponFits(hid: string, id: string): boolean {
  const type = WEAPONS[id]?.type;
  return hid === 'cannon' ? type === 'cannon' : hid === 'archer' ? type === 'bow' : hid === 'sniper' ? type === 'crossbow'
    : ['pyro', 'volt', 'mora', 'siphon'].includes(hid) && (type === 'book' || type === 'staff');
}
export function weaponUsers(id: string): string {
  const type = WEAPONS[id]?.type;
  return type === 'cannon' ? '重炮工程师专用' : type === 'bow' ? '弓手专用' : type === 'crossbow' ? '重弩手专用' : '火 / 雷 / 冰 / 生命法师通用';
}
