/** Pure progress accounting for overlapping floors; a later clear cannot bypass an earlier survivor. */
export function clearedEndlessFloor(currentFloor: number, queueEmpty: boolean,
  enemies: readonly { dead: boolean; endlessFloor: number }[]): number {
  let firstLiving = currentFloor + 1;
  for (const enemy of enemies) if (!enemy.dead)
    firstLiving = Math.min(firstLiving, enemy.endlessFloor || currentFloor);
  return Math.max(0, Math.min(currentFloor - (queueEmpty ? 0 : 1), firstLiving - 1));
}
