/** Normal 1-1: denser fodder for open abilities; preserve authored HP, damage and six-wave arc. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
export const FIRST_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(16, 280, 1.65)] },
  { groups: [workers(24, 300, 1.4)] },
  { groups: [workers(28, 320, 1.25)] },
  { groups: [workers(18, 320, 1.65)] },
  { groups: [workers(34, 360, 0.98)], surge: true },
  { groups: [{ mob: 'goblin_brute', count: 1, interval: 1, actual: { hp: 2200, dmg: 20 } },
    workers(18, 380, 1.4, 4)] },
];
