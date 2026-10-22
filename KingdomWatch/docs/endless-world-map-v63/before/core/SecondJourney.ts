/** Independent 1-2 receipts. Reading eligibility never spends currency or edits a squad. */
import { loadSave, saveSave } from './SaveData';

export function secondTeachingBattle(id: string, difficulty: number): boolean {
  const j = loadSave().secondJourney!;
  return id === '1-2' && difficulty === 0 && j.enabled && !j.skipped && !j.battleDone;
}
export function skipSecondBattleTeaching(): void {
  loadSave().secondJourney!.skipped = true; saveSave();
}
export function pendingUpgradeLesson(): boolean {
  const sv = loadSave(), j = sv.secondJourney!;
  if (sv.heroes.archer.lv > 1 && !j.upgradeDone) { j.upgradeDone = true; saveSave(); }
  return j.enabled && !j.skipped && !!sv.stars['1-1'] && !sv.stars['1-2'] && !j.upgradeDone && !j.upgradeSkipped;
}
export function finishUpgradeLesson(skipped = false): void {
  const sv = loadSave(), j = sv.secondJourney!;
  if (skipped) j.upgradeSkipped = true;
  else if (sv.heroes.archer.lv > 1) j.upgradeDone = true;
  saveSave();
}
/** Follow the earned bow, not any unrelated equipment transaction. Old non-teaching saves stay out. */
export function postBowCampTab(): 2 | 3 | null {
  const sv = loadSave(), first = sv.firstJourney!, j = sv.secondJourney!;
  const bow = sv.equips.find(e => e.uid === first.rewardUid && e.defId === 'wpn_bow');
  if (!first.enabled || first.skipped || first.equipSkipped || !j.enabled || j.skipped
    || !sv.stars['1-1'] || sv.stars['1-2'] || j.entryDone || j.entrySkipped
    || !bow || sv.heroes.archer.worn.weapon !== bow.uid) return null;
  if (pendingUpgradeLesson()) return 3;
  return j.upgradeDone || j.upgradeSkipped ? 2 : null;
}
export function pendingSecondEntryLesson(): boolean { return postBowCampTab() === 2; }
export function finishSecondEntryLesson(skipped = false): void {
  const j = loadSave().secondJourney!;
  if (skipped) j.entrySkipped = true;
  else j.entryDone = true;
  saveSave();
}
export function pyroRewardAvailable(id: string, difficulty: number): boolean {
  const sv = loadSave();
  return id === '1-2' && difficulty === 0 && !sv.heroes.pyro.owned && !sv.secondJourney!.rewardClaimed;
}
/** Caller commits the hero receipt and stars together; never reset existing cultivation. */
export function secondLevelVictory(id: string, difficulty: number): boolean {
  if (id !== '1-2' || difficulty !== 0) return false;
  const sv = loadSave(), j = sv.secondJourney!;
  j.battleDone = true;
  const grant = !j.rewardClaimed && !sv.heroes.pyro.owned;
  if (grant) sv.heroes.pyro.owned = true;
  j.rewardClaimed = true;
  return grant;
}
export function pendingPyroSquadLesson(): boolean {
  const sv = loadSave(), j = sv.secondJourney!;
  if (sv.squad.includes('pyro') && !j.squadDone) { j.squadDone = true; saveSave(); }
  return j.enabled && !j.skipped && !!sv.stars['1-2'] && sv.heroes.pyro.owned && !j.squadDone && !j.squadSkipped;
}
export function finishPyroSquadLesson(skipped = false): void {
  const sv = loadSave(), j = sv.secondJourney!;
  if (skipped) j.squadSkipped = true;
  else if (sv.squad.includes('pyro')) j.squadDone = true;
  saveSave();
}
