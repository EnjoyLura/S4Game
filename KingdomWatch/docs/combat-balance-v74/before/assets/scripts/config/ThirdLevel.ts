/** Normal 1-3: denser fodder for open abilities; preserve authored stats, encounter order and duration. */
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
  { groups: [workers(28, 340, 1.2)] },
  { groups: [workers(36, 360, 0.95), slingers(2, 280, 5, 13)] },
  { groups: [workers(46, 380, 0.66), slingers(2, 300, 5, 12), elite(1, 2800, 15)], surge: true },
  { groups: [workers(22, 360, 1.4)] },
  { groups: [workers(48, 400, 0.63), riders(480, 14)], surge: true },
  { groups: [workers(42, 420, 0.74), slingers(4, 320, 5, 10), riders(500, 16)] },
  { groups: [workers(50, 440, 0.6), elite(1, 3000, 10), riders(520, 17)], surge: true },
  { groups: [workers(36, 440, 0.74, 2), slingers(4, 340, 5, 8),
    elite(2, 3200, 5), riders(540, 17)], surge: true },
];
