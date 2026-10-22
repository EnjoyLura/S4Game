/** First-session bookkeeping. Rewards and their receipt share one save transaction. */
import { EquipInst, loadSave, saveSave } from './SaveData';

export function firstBowAvailable(id: string, difficulty: number): boolean {
  const sv = loadSave();
  return id === '1-1' && difficulty === 0 && !sv.stars['1-1'] && !sv.firstJourney!.rewardClaimed;
}

export function teachingBattle(id: string, difficulty: number): boolean {
  const j = loadSave().firstJourney!;
  return id === '1-1' && difficulty === 0 && j.enabled && !j.skipped && !j.battleDone;
}
export function skipBattleTeaching(): void {
  loadSave().firstJourney!.skipped = true;
  saveSave();
}
export function pendingBowLesson(): EquipInst | null {
  const sv = loadSave(), j = sv.firstJourney!;
  if (!j.enabled || j.skipped || !j.battleDone || j.equipDone || j.equipSkipped || !j.rewardUid) return null;
  const inst = sv.equips.find(e => e.uid === j.rewardUid);
  if (!inst || inst.defId !== 'wpn_bow') return null;
  if (sv.heroes.archer.worn.weapon === inst.uid) {
    j.equipDone = true; saveSave(); return null;
  }
  return inst;
}
export function finishBowLesson(uid: string, hid: string): void {
  const sv = loadSave(), j = sv.firstJourney!;
  if (hid === 'archer' && uid === j.rewardUid && sv.heroes.archer.worn.weapon === uid) {
    j.equipDone = true; saveSave();
  }
}
export function skipBowLesson(): void {
  loadSave().firstJourney!.equipSkipped = true; saveSave();
}
/** Call before updating the normal stage's stars. Existing cleared accounts get no retroactive gift. */
export function firstLevelVictory(id: string, difficulty: number, previousStars: number): EquipInst | null {
  if (id !== '1-1' || difficulty !== 0) return null;
  const sv = loadSave(), j = sv.firstJourney!;
  j.battleDone = true;
  let gift: EquipInst | null = null;
  if (!previousStars && !j.rewardClaimed) {
    let uid = 'first_journey_v1_bow', suffix = 0;
    while (sv.equips.some(e => e.uid === uid)) uid = 'first_journey_v1_bow_' + (++suffix);
    gift = { uid, defId: 'wpn_bow', lv: 1 };
    sv.equips.push(gift);
    j.rewardUid = uid; j.rewardClaimed = true;
  }
  // Caller commits stars and this receipt together, before showing settlement.
  return gift;
}
