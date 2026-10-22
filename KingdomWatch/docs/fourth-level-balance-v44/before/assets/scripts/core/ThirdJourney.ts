/** Independent 1-3 teaching and first-win staff receipt. No camp navigation or auto-equipping. */
import { EquipInst, loadSave, saveSave } from './SaveData';

export function thirdTeachingBattle(id: string, difficulty: number): boolean {
  const j = loadSave().thirdJourney!;
  return id === '1-3' && difficulty === 0 && j.enabled && !j.skipped && !j.battleDone;
}
export function skipThirdBattleTeaching(): void {
  loadSave().thirdJourney!.skipped = true; saveSave();
}
export function firstStaffAvailable(id: string, difficulty: number): boolean {
  const sv = loadSave();
  return id === '1-3' && difficulty === 0 && !sv.stars['1-3'] && !sv.thirdJourney!.rewardClaimed;
}
/** Caller commits the equipment instance, receipt and stage stars in the same save. */
export function thirdLevelVictory(id: string, difficulty: number, previousStars: number): EquipInst | null {
  if (id !== '1-3' || difficulty !== 0) return null;
  const sv = loadSave(), j = sv.thirdJourney!;
  j.battleDone = true;
  if (previousStars || j.rewardClaimed) return null;
  let uid = 'third_journey_v1_staff', suffix = 0;
  while (sv.equips.some(e => e.uid === uid)) uid = 'third_journey_v1_staff_' + (++suffix);
  const gift = { uid, defId: 'wpn_green_staff', lv: 1 };
  sv.equips.push(gift); j.rewardUid = uid; j.rewardClaimed = true;
  return gift;
}
