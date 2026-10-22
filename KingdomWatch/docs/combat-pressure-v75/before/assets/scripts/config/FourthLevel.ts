/** Normal 1-4: modest HP pressure and fodder density; preserve wave arc, special counts and line damage. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_slinger', count, interval, delay, actual: { hp, dmg: 8 } });
const riders = (hp: number, delay: number) =>
  ({ mob: 'wolf_rider', count: 2, interval: 6, delay, actual: { hp, dmg: 12 } });
const elite = (count: number, hp: number, delay: number) =>
  ({ mob: 'goblin_brute', count, interval: 12, delay, actual: { hp, dmg: 24 } });
const shaman = (count: number, delay: number) =>
  ({ mob: 'goblin_shaman', count, interval: 10, delay, actual: { hp: 400, dmg: 0 } });

export const FOURTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(34, 410, 1)] },
  { groups: [workers(44, 430, 0.76), slingers(2, 310, 5, 13)] },
  { groups: [workers(56, 460, 0.56), slingers(2, 330, 5, 12), elite(1, 3100, 15)], surge: true },
  { groups: [workers(26, 430, 1.15)] },
  { groups: [workers(60, 490, 0.5), riders(530, 14)], surge: true },
  { groups: [workers(52, 510, 0.61), slingers(4, 350, 5, 10), riders(550, 16), shaman(1, 18)] },
  { groups: [workers(62, 540, 0.46), elite(1, 3350, 10), riders(580, 17)], surge: true },
  { groups: [workers(52, 540, 0.56, 2), slingers(4, 380, 5, 8),
    elite(2, 3550, 5), riders(600, 17), shaman(2, 12)], surge: true },
];
