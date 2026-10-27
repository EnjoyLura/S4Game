import { scytheMilestones } from '../../config/ScytheConfig';
import { magicBowMilestones } from '../../config/MagicBowConfig';
import { lanceMilestones } from '../../config/ThunderLanceConfig';
import { spaceSwordMilestones } from '../../config/SpaceSwordConfig';
import { newHeroMilestones } from '../../config/NewHeroConfig';
import { windNinjaMilestones } from '../../config/WindNinjaConfig';
/**
 * ④ 升级：四页共用铁匠铺培养界面；保留英雄/基地调用的装备强化弹窗。
 */
import { PageCtx } from '../PageKit';
import { buildTrainingLobby } from '../TrainingLobby';
import { attrsModal, forgeModal } from './HeroPage';
import {
  EquipKind, HERO_DEFS, MAX,
  BT_STEP, BT_SKL, heroBtList, heroStatsAt, weaponBtList,
} from '../../core/GameData';


/** 技能槽显示名：普攻无专属名；技能/大招用各英雄定名（切换英雄即跟随——用户反馈） */
const skillName = (hid: string, slot: 'atk' | 'skill' | 'ult'): string =>
  slot === 'atk' ? '普攻' : slot === 'skill' ? HERO_DEFS[hid].skillName : HERO_DEFS[hid].ultName;
/** 技能槽切图：ui_icon_<atk|skill|ult>_<hid>（切图批次），缺图回退文字 */
const skillIconId = (hid: string, slot: 'atk' | 'skill' | 'ult'): string => `ui_icon_${slot}_${hid}`;

/* 阶段性突破档位（真实数值——用户确认节奏：英雄/武器每10级、技能每5级一次跳升，文案与 GameData 公式一致；已达成的档位打 ✓） */
const btMs = (cap: number, step: number, txt: string): { lv: number; txt: string }[] =>
  Array.from({ length: Math.floor(cap / step) }, (_, i) => ({ lv: (i + 1) * step, txt: `突破 · ${txt}` }));


/** 英雄突破步骤条数据（专属表 txt 直用——弓箭手已定稿；未配置英雄回退通用档） */
const heroMilestones = (hid: string): { lv: number; txt: string }[] => heroBtList(hid).map(m => ({ lv: m.lv, txt: m.txt }));
const weaponMilestones = (hid: string): { lv: number; txt: string }[] => weaponBtList(hid);
/* 弓箭手技能升级里程碑（用户定稿：机制型档位取代通用 +15%/5级）；其余英雄维持通用数值档 */
const SKILL_MS_ARCHER: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '普攻范围 +8%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '强化箭 +2 发' },
    { lv: 15, txt: '强化窗口 +2s' },
    { lv: 20, txt: '强化箭倍率 +0.3' },
  ],
  ult: [
    { lv: 5, txt: '每排箭数 +2' },
    { lv: 10, txt: '追加第三排' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '每箭系数 +0.1' },
  ],
};
/* 重弩手（凯尔·鹰眼）技能升级里程碑（用户定稿） */
const SKILL_MS_SNIPER: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对满血目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '连狙 +2 发' },
    { lv: 15, txt: '索敌窗口 +1s' },
    { lv: 20, txt: '每发倍率 +0.4' },
  ],
  ult: [
    { lv: 5, txt: '大招弹体范围 +20%' },
    { lv: 10, txt: '猎杀标记：受伤 +20% · 5s' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '倍率 +1.0' },
  ],
};
/* 雷法师（沃尔·雷霆）技能升级里程碑（用户定稿） */
const SKILL_MS_VOLT: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对感电目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '连锁目标 +1（累计 6）' },
    { lv: 15, txt: '连锁递增：每跳伤害 +10%' },
    { lv: 20, txt: '每跳倍率 1.4→1.7' },
  ],
  ult: [
    { lv: 5, txt: '落雷范围 +20%' },
    { lv: 10, txt: '落雷命中感电 +25% · 3s' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '每道倍率 2.2→2.6' },
  ],
};
/* 火法师（焰·辉）技能升级里程碑（用户定稿） */
const SKILL_MS_PYRO: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对灼烧目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '火球 +1 发（累计 4）' },
    { lv: 15, txt: '爆炸伤害 40%→60%' },
    { lv: 20, txt: '每发倍率 1.6→1.9' },
  ],
  ult: [
    { lv: 5, txt: '陨石 +2 颗（累计 7）' },
    { lv: 10, txt: '陨石坑范围 +25%' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '每颗倍率 3.5→3.9' },
  ],
};
/* 冰霜法师（莫拉·寒霜）技能升级里程碑（定稿） */
const SKILL_MS_MORA: Record<'atk' | 'skill' | 'ult', { lv: number; txt: string }[]> = {
  atk: [
    { lv: 5, txt: '攻速 +6%' },
    { lv: 10, txt: '暴击率 +5%' },
    { lv: 15, txt: '对减速目标伤害 +25%' },
    { lv: 20, txt: '普攻伤害 +20%' },
  ],
  skill: [
    { lv: 5, txt: '冷却 -1s' },
    { lv: 10, txt: '领域范围 +20%' },
    { lv: 15, txt: '冻结时间 +0.3s' },
    { lv: 20, txt: '倍率 2.0→2.3' },
  ],
  ult: [
    { lv: 5, txt: '减速 50%→60%' },
    { lv: 10, txt: '减速持续 4→6s' },
    { lv: 15, txt: '大招充能 -10%' },
    { lv: 20, txt: '倍率 1.8→2.2' },
  ],
};
const SKILL_GENERIC: Record<'atk' | 'skill' | 'ult', string> = {
  atk: '普攻伤害 +15%',
  skill: `技能伤害 +${Math.round(BT_SKL * 100)}%`,
  ult: '大招伤害 +15%',
};
const skillMilestones = (hid: string, slot: 'atk' | 'skill' | 'ult'): { lv: number; txt: string }[] =>
  hid === 'scythe' ? scytheMilestones(slot) : hid === 'arcane' ? magicBowMilestones(slot) : hid === 'lance' ? lanceMilestones(slot) : hid === 'space' || hid === 'sword' ? spaceSwordMilestones(hid,slot)
    : hid === 'wind' || hid === 'ninja' ? windNinjaMilestones(hid, slot)
    : hid === 'cannon' || hid === 'siphon' ? newHeroMilestones(hid, slot)
    : hid === 'archer' ? SKILL_MS_ARCHER[slot]
    : hid === 'sniper' ? SKILL_MS_SNIPER[slot]
      : hid === 'volt' ? SKILL_MS_VOLT[slot]
        : hid === 'pyro' ? SKILL_MS_PYRO[slot]
          : hid === 'mora' ? SKILL_MS_MORA[slot]
            : btMs(MAX.skill, BT_STEP.skill, SKILL_GENERIC[slot]);

/** 升级预览直接复用两项基础属性，避免与战斗成长产生偏差。 */
function statsAt(hid: string, lv: number, wpnLv: number): { atk: number; skillDmg: number } {
  return heroStatsAt(hid, lv, wpnLv);
}


export function buildUpgrade(ctx: PageCtx): void {
  buildTrainingLobby(ctx, {
    statsAt, heroMilestones, weaponMilestones, skillMilestones, skillName, skillIconId,
    onAttrs: hid => attrsModal(ctx, hid),
  });
}

/** Retained entry point shares the common forge; its caller still owns refresh. */
export function equipModal(ctx: PageCtx, hid: string, kind: EquipKind, rebuild: () => void): void {
  forgeModal({ ...ctx, refresh: rebuild }, hid, kind);
}
