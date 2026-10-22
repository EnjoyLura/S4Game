/** Normal 1-1 only. Absolute arrival stats; no chapter or per-wave multiplication. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
export const FIRST_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(12, 280, 2.4)] },
  { groups: [workers(18, 300, 1.95)] },
  { groups: [workers(20, 320, 1.8)] },
  { groups: [workers(12, 320, 2.9)] },
  { groups: [workers(26, 360, 1.3)], surge: true },
  { groups: [{ mob: 'goblin_brute', count: 1, interval: 1, actual: { hp: 2200, dmg: 20 } },
    workers(12, 380, 2.15, 5)] },
];
