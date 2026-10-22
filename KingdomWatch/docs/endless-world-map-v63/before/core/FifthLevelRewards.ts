/** Normal 1-5 first-win bundle. Both inventory instances and the receipt share the stars save. */
import { EquipInst, loadSave } from './SaveData';

export const FIFTH_LEVEL_GIFTS: readonly string[] = ['wpn_green_crossbow', 'acc_moon'];

export function fifthRewardsAvailable(id: string, difficulty: number): boolean {
  const sv = loadSave();
  return id === '1-5' && difficulty === 0 && !sv.stars['1-5'] && !sv.fifthRewards!.claimed;
}

/** No save or navigation here: the caller commits both gifts, receipt and stars together. */
export function fifthLevelVictory(id: string, difficulty: number, previousStars: number): EquipInst[] {
  if (id !== '1-5' || difficulty !== 0) return [];
  const sv = loadSave(), receipt = sv.fifthRewards!;
  if (previousStars || receipt.claimed) return [];
  const gifts: EquipInst[] = FIFTH_LEVEL_GIFTS.map(defId => {
    const base = 'fifth_rewards_v1_' + defId;
    let uid = base, suffix = 0;
    while (sv.equips.some(e => e.uid === uid)) uid = base + '_' + (++suffix);
    return { uid, defId, lv: 1 };
  });
  sv.equips.push(...gifts);
  receipt.uids = gifts.map(e => e.uid); receipt.claimed = true;
  return gifts;
}
