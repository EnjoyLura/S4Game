/** Normal 1-3: modest HP pressure and fodder density; preserve wave arc, special counts and line damage. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_slinger', count, interval, delay, actual: { hp, dmg: 8 } });
const riders = (hp: number, delay: number) =>
  ({ mob: 'wolf_rider', count: 2, interval: 6, delay, actual: { hp, dmg: 12 } });
const elite = (count: number, hp: number, delay: number) =>
  ({ mob: 'goblin_brute', count, interval: 12, delay, actual: { hp, dmg: 24 } });

export const THIRD_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(28, 380, 1.2)] },
  { groups: [workers(38, 400, 0.9), slingers(2, 300, 5, 13)] },
  { groups: [workers(48, 430, 0.63), slingers(2, 320, 5, 12), elite(1, 3050, 15)], surge: true },
  { groups: [workers(22, 400, 1.4)] },
  { groups: [workers(50, 460, 0.6), riders(520, 14)], surge: true },
  { groups: [workers(44, 480, 0.71), slingers(4, 350, 5, 10), riders(550, 16)] },
  { groups: [workers(52, 500, 0.58), elite(1, 3300, 10), riders(570, 17)], surge: true },
  { groups: [workers(38, 500, 0.7, 2), slingers(4, 370, 5, 8),
    elite(2, 3500, 5), riders(600, 17)], surge: true },
];
