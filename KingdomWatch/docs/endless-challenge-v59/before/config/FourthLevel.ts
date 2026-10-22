/** Normal 1-4: a small step above 1-3, tuned around three Lv.3 heroes / Lv.2 weapons. */
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
  ({ mob: 'goblin_shaman', count, interval: 10, delay, actual: { hp: 360, dmg: 0 } });

export const FOURTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(24, 360, 1.5)] },
  { groups: [workers(28, 380, 1.2), slingers(2, 280, 5, 13)] },
  { groups: [workers(34, 400, .9), slingers(2, 300, 5, 12), elite(1, 2800, 15)], surge: true },
  { groups: [workers(16, 380, 1.9)] },
  { groups: [workers(38, 420, .8), riders(480, 14)], surge: true },
  { groups: [workers(32, 440, 1), slingers(4, 320, 5, 10), riders(500, 16), shaman(1, 18)] },
  { groups: [workers(38, 460, .75), elite(1, 3000, 10), riders(520, 17)], surge: true },
  { groups: [workers(32, 460, .9, 3), slingers(4, 340, 5, 8),
    elite(2, 3200, 5), riders(540, 17), shaman(2, 12)], surge: true },
];
