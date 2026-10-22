/** Normal 1-1 only. Absolute arrival stats; no chapter or per-wave multiplication. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
export const FIRST_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(8, 280, 3.8)] },
  { groups: [workers(12, 300, 3)] },
  { groups: [workers(14, 320, 2.6)] },
  { groups: [workers(9, 320, 4)] },
  { groups: [workers(18, 360, 1.9)], surge: true },
  { groups: [{ mob: 'goblin_brute', count: 1, interval: 1, actual: { hp: 2200, dmg: 20 } },
    workers(8, 380, 3.4, 5)] },
];
