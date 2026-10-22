/** Normal 1-7: a small step above 1-6 for three Lv.6 heroes / Lv.3 weapons, 5–6 minute target. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, delay: number) =>
  ({ mob: 'goblin_slinger', count, interval: 5, delay, actual: { hp, dmg: 8 } });
const riders = (count: number, hp: number, delay: number) =>
  ({ mob: 'wolf_rider', count, interval: 3, delay, actual: { hp, dmg: 12 } });
const elite = (hp: number, delay: number) =>
  ({ mob: 'goblin_brute', count: 1, interval: 1, delay, actual: { hp, dmg: 24 } });
const shaman = (hp: number, delay: number) =>
  ({ mob: 'goblin_shaman', count: 1, interval: 1, delay, actual: { hp, dmg: 0 } });

export const SEVENTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(30, 420, 1.05)] },
  { groups: [workers(32, 440, .98), slingers(2, 340, 12)] },
  { groups: [workers(34, 460, .9), slingers(2, 340, 12), elite(3400, 8)] },
  { groups: [workers(24, 440, 1.32), slingers(4, 350, 10)] },
  { groups: [workers(36, 480, .86), slingers(4, 360, 8), riders(3, 560, 12)], surge: true },
  // The first healer arrives in a sparse wave before joining elite formations later.
  { groups: [workers(22, 460, 1.45), shaman(400, 16)] },
  { groups: [workers(38, 500, .8), slingers(4, 370, 8), elite(3600, 8), shaman(420, 20)], surge: true },
  { groups: [workers(30, 500, 1.02), slingers(2, 380, 12), riders(3, 580, 10)] },
  { groups: [workers(36, 520, .84), slingers(4, 380, 8), elite(3800, 8), shaman(420, 20)], surge: true },
  // Keep the final elite early in the queue; the closing pressure comes from ranged/healing support.
  { groups: [elite(4400, 0), workers(32, 520, .9, 2), slingers(4, 400, 8), shaman(440, 18)], surge: true },
];
