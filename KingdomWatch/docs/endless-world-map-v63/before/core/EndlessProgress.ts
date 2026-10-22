import { loadSave, saveSave } from './SaveData';

export function endlessBest(chapter: number): number {
  const value = loadSave().endless?.best[String(chapter)];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Called after a cleared floor, never when a new floor merely starts. */
export function recordEndlessFloor(chapter: number, floor: number): void {
  if (floor <= endlessBest(chapter)) return;
  const sv = loadSave();
  if (!sv.endless) sv.endless = { version: 1, best: {} };
  sv.endless.best[String(chapter)] = Math.floor(floor);
  saveSave();
}
