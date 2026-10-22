/** Normal 1-3: pressure from the opening, with denser and tougher middle/final waves. */
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
  { groups: [workers(36, 520, 0.93)] },
  { groups: [workers(52, 620, 0.65), slingers(2, 400, 5, 13)] },
  { groups: [workers(72, 740, 0.42), slingers(2, 500, 5, 12), elite(1, 4600, 15)], surge: true },
  { groups: [workers(30, 640, 1.01)] },
  { groups: [workers(80, 860, 0.37), riders(800, 14)], surge: true },
  { groups: [workers(72, 980, 0.43), slingers(4, 650, 5, 10), riders(950, 16)] },
  { groups: [workers(86, 1100, 0.35), elite(1, 5600, 10), riders(1100, 17)], surge: true },
  { groups: [workers(64, 1180, 0.41, 2), slingers(4, 750, 5, 8),
    elite(2, 6400, 5), riders(1250, 17)], surge: true },
];
