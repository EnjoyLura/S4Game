/** Capture real values around existing save operations; presentation never estimates growth. */
import { EQUIPS, EquipKind, HERO_DEFS, OpResult, PCT_STATS, STAT_NAME, StatKey, equipStat, heroBtList, heroStats, keepHp, keepShield, wornInst, equippedWeapon, weaponBtList } from '../core/GameData';
import { loadSave } from '../core/SaveData';
import { archerAtkCfg, archerUltCfg, moraAtkCfg, moraUltCfg, pyroAtkCfg, pyroUltCfg, sniperAtkCfg, sniperUltCfg, voltAtkCfg, voltUltCfg, skillBaseMultiplier } from '../config/Cards';
import { gearArtKey } from './HeroComic';
import { GLOBAL_ROOT, toast } from './PageKit';
import { NoticeNumberFormat, NoticeStat } from './UINotice';
import { showPositiveFeedback } from './PositiveFeedback';

export type GrowthTarget = { kind: 'hero' | 'weapon' | 'atk' | 'skill' | 'ult'; hid: string }
  | { kind: 'equip'; hid: string; slot: EquipKind } | { kind: 'keep' };
interface GrowthState {
  key: string; name: string; level: number; icon?: string; heroId?: string; power?: number;
  stats: { name: string; value: number; format?: NoticeNumberFormat }[]; milestone?: string;
}
const NORMAL_CFG: Record<string, (lv: number) => { normalMul: number }> = {
  archer: archerAtkCfg, sniper: sniperAtkCfg, volt: voltAtkCfg, pyro: pyroAtkCfg, mora: moraAtkCfg,
};
const ULT_DAMAGE: Record<string, (lv: number) => number> = {
  archer: lv => archerUltCfg(lv).coeff, sniper: lv => sniperUltCfg(lv).boltMul,
  volt: lv => voltUltCfg(lv).boltMul, pyro: lv => pyroUltCfg(lv).boltMul, mora: lv => moraUltCfg(lv).boltMul,
};

function capture(target: GrowthTarget): GrowthState {
  const sv = loadSave();
  if (target.kind === 'keep') return { key: 'growth:keep', name: '王国主城', level: sv.keepLv,
    icon: 'shop_comic_v1/comic_nav_castle_v1', stats: [{ name: '防线耐久', value: keepHp(sv.keepLv) }, { name: '防线护盾', value: keepShield(sv.keepLv) }] };
  const hid = target.hid, hero = sv.heroes[hid], def = HERO_DEFS[hid], stats = heroStats(hid);
  if (target.kind === 'equip') {
    const inst = wornInst(hid, target.slot), d = inst ? EQUIPS[inst.defId] : null;
    return { key: 'growth:gear:' + (inst?.uid || hid + ':' + target.slot), name: d?.name || '装备', level: inst?.lv || 0,
      icon: d ? gearArtKey(d.id) : undefined, power: stats.power,
      stats: inst && d ? (Object.keys(d.stats) as StatKey[]).filter(key => (d.stats[key] || 0) > 0).map((key): GrowthState['stats'][number] => ({
        name: STAT_NAME[key], value: equipStat(inst, key), format: PCT_STATS.includes(key) ? 'percent' : 'integer',
      })) : [] };
  }
  if (target.kind === 'hero') return { key: 'growth:hero:' + hid, name: def.name, heroId: hid, level: hero.lv, power: stats.power,
    stats: [{ name: '攻击力', value: stats.atk }, { name: '技能伤害', value: stats.skillDmg }],
    milestone: heroBtList(hid).find(m => m.lv === hero.lv)?.txt };
  if (target.kind === 'weapon') return { key: 'growth:weapon:' + hid, name: equippedWeapon(hid).name, icon: equippedWeapon(hid).art, level: hero.weaponLv, power: stats.power,
    stats: [{ name: '攻击', value: stats.atk }, { name: '技能伤害', value: stats.skillDmg }],
    milestone: weaponBtList(hid).find(m => m.lv === hero.weaponLv)?.txt };
  const slot = target.kind, level = hero[slot === 'atk' ? 'atkLv' : slot === 'skill' ? 'skillLv' : 'ultLv'];
  return { key: 'growth:' + slot + ':' + hid, name: slot === 'atk' ? def.name + ' · 普攻' : slot === 'skill' ? def.skillName : def.ultName,
    icon: 'ui_icon_' + slot + '_' + hid, level, power: stats.power,
    stats: slot === 'skill' ? [{ name: '技能伤害倍率', value: skillBaseMultiplier(hid, level), format: 'percent' }]
      : [{ name: slot === 'atk' ? '普攻伤害加成' : '单次大招伤害倍率', value: slot === 'atk' ? NORMAL_CFG[hid](level).normalMul - 1 : ULT_DAMAGE[hid](level), format: 'percent' }],
    milestone: level % 5 === 0 ? 'Lv.' + level + ' 阶段突破已达成' : undefined };
}

export function growthAction(target: GrowthTarget, action: () => OpResult, repeating = false): OpResult {
  if (target.kind === 'equip' && target.slot === 'weapon') target = { kind: 'weapon', hid: target.hid };
  const before = capture(target), result = action();
  if (!result.ok) { toast(result.msg, { kind: 'warning', title: '暂时无法提升' }); return result; }
  const after = capture(target);
  const stats: NoticeStat[] = after.stats.map(s => ({ name: s.name, before: before.stats.find(b => b.name === s.name)?.value ?? s.value,
    after: s.value, format: s.format })).filter(s => Math.abs(s.after - s.before) > .00001);
  const milestone = target.kind === 'keep' && keepShield(after.level) > keepShield(before.level) ? '阶段护盾提升 +' + (keepShield(after.level) - keepShield(before.level)) : after.milestone;
  if (GLOBAL_ROOT?.isValid) showPositiveFeedback(GLOBAL_ROOT, {
    title: target.kind === 'keep' ? '主城升级' : target.kind === 'weapon' || target.kind === 'equip' ? '强化成功' : '升级成功',
    key: after.key, name: after.name, level: { before: before.level, after: after.level }, stats, milestone,
    power: before.power !== undefined && after.power !== undefined ? { before: before.power, after: after.power } : undefined,
    keep: target.kind === 'keep', repeating });
  return result;
}
