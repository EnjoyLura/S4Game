/** Normal 1-4: pressure from the opening, with denser and tougher middle/final waves. */
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
  ({ mob: 'goblin_shaman', count, interval: 10, delay, actual: { hp: 700, dmg: 0 } });

export const FOURTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(44, 560, 0.77)] },
  { groups: [workers(64, 680, 0.52), slingers(2, 430, 5, 13)] },
  { groups: [workers(86, 800, 0.36), slingers(2, 540, 5, 12), elite(1, 5000, 15)], surge: true },
  { groups: [workers(36, 700, 0.82)] },
  { groups: [workers(98, 940, 0.3), riders(900, 14)], surge: true },
  { groups: [workers(88, 1060, 0.36), slingers(4, 700, 5, 10), riders(1050, 16), shaman(1, 18)] },
  { groups: [workers(104, 1180, 0.27), elite(1, 6200, 10), riders(1200, 17)], surge: true },
  { groups: [workers(88, 1260, 0.33, 2), slingers(4, 800, 5, 8),
    elite(2, 7000, 5), riders(1360, 17), shaman(2, 12)], surge: true },
];
