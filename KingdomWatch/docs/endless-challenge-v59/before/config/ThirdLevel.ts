/** Normal 1-3: crowd clearing with the newly earned pyro; 1x combat target 4–5 minutes. */
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
  { groups: [workers(20, 340, 1.8)] },
  { groups: [workers(24, 360, 1.4), slingers(2, 280, 5, 13)] },
  { groups: [workers(30, 380, 1), slingers(2, 300, 5, 12), elite(1, 2800, 15)], surge: true },
  { groups: [workers(14, 360, 2.2)] },
  { groups: [workers(32, 400, .95), riders(480, 14)], surge: true },
  { groups: [workers(28, 420, 1.1), slingers(4, 320, 5, 10), riders(500, 16)] },
  { groups: [workers(32, 440, .9), elite(1, 3000, 10), riders(520, 17)], surge: true },
  { groups: [workers(24, 440, 1.1, 3), slingers(4, 340, 5, 8),
    elite(2, 3200, 5), riders(540, 17)], surge: true },
];
