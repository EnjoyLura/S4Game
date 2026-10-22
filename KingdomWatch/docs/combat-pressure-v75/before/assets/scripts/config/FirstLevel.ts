/** Normal 1-1: modest HP pressure and fodder density; preserve wave arc, special counts and line damage. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
export const FIRST_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(16, 300, 1.65)] },
  { groups: [workers(24, 320, 1.4)] },
  { groups: [workers(30, 350, 1.16)] },
  { groups: [workers(18, 350, 1.65)] },
  { groups: [workers(36, 400, 0.92)], surge: true },
  { groups: [{ mob: 'goblin_brute', count: 1, interval: 1, actual: { hp: 2400, dmg: 20 } },
    workers(20, 420, 1.25, 4)] },
];
