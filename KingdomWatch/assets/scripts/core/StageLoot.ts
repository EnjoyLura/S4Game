/** Durable pickup and settlement accounting. Visual callbacks never roll or grant twice. */
import { ChallengeDef, challengeEquipmentDropChance, MaterialReward } from '../config/LevelDifficulty';
import { MobDef } from '../config/Mobs';
import { newEquipInst } from './GameData';
import { EquipInst, loadSave, saveSave } from './SaveData';

export interface StageLootSummary { equipment: EquipInst[]; materials: MaterialReward[]; heroes?: string[]; }
export function rollEquipment(level: ChallengeDef, mob: MobDef): EquipInst | null {
  if (!level.gearPool.length || Math.random() >= challengeEquipmentDropChance(level, mob)) return null;
  const total = level.gearPool.reduce((sum, row) => sum + row.weight, 0);
  let roll = Math.random() * total;
  for (const row of level.gearPool) {
    roll -= row.weight;
    if (roll < 0) return newEquipInst(row.id);
  }
  return newEquipInst(level.gearPool[level.gearPool.length - 1].id);
}
export function storeEquipment(inst: EquipInst): boolean {
  const sv = loadSave();
  if (sv.equips.some(e => e.uid === inst.uid)) return false;
  sv.equips.push(inst); // Always into the backpack; do not replace or auto-wear a slot.
  saveSave();
  return true;
}
export function grantStageMaterials(level: ChallengeDef): MaterialReward[] {
  const sv = loadSave(), result = level.materials.map(row => ({ ...row }));
  for (const row of result) sv.bag[row.id] = (sv.bag[row.id] || 0) + row.n;
  saveSave();
  return result;
}
