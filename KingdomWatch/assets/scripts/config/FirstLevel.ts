/** Normal 1-1: pressure from the opening, with denser and tougher middle/final waves. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
export const FIRST_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(20, 400, 1.3)] },
  { groups: [workers(32, 480, 1.04)] },
  { groups: [workers(44, 600, 0.78)] },
  { groups: [workers(24, 520, 1.22)] },
  { groups: [workers(58, 800, 0.56)], surge: true },
  { groups: [{ mob: 'goblin_brute', count: 1, interval: 1, actual: { hp: 4000, dmg: 20 } },
    workers(32, 900, 0.77, 4)] },
];
