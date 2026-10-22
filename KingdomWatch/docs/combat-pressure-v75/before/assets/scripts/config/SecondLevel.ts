/** Normal 1-2: modest HP pressure and fodder density; preserve wave arc, special counts and line damage. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_slinger', count, interval, delay, actual: { hp, dmg: 8 } });
export const SECOND_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(20, 350, 1.45)] },
  { groups: [workers(26, 370, 1.2), slingers(2, 300, 5, 13)] },
  { groups: [workers(30, 400, 1.02), slingers(2, 320, 5, 15)] },
  { groups: [workers(20, 390, 1.55)] },
  { groups: [workers(38, 450, 0.83), slingers(4, 350, 6, 9)], surge: true },
  { groups: [workers(30, 470, 0.98), slingers(4, 370, 6, 7)], surge: true },
  { groups: [workers(22, 500, 1.22, 3),
    { mob: 'goblin_brute', count: 2, interval: 12, delay: 2, actual: { hp: 2850, dmg: 24 } }] },
];
