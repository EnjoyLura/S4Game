/** Normal 1-6: denser fodder for open abilities; preserve authored stats, encounter order and duration. */
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

export const SIXTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(44, 400, 0.72)] },
  { groups: [workers(48, 420, 0.66), riders(3, 520, 8)] },
  { groups: [workers(52, 440, 0.58), slingers(2, 320, 12), elite(3200, 8)] },
  { groups: [workers(36, 420, 0.9), riders(3, 540, 10)] },
  { groups: [workers(58, 460, 0.52), riders(4, 560, 8)], surge: true },
  // Lighter middle wave separates the raids while maintaining a steady stream of targets.
  { groups: [workers(34, 420, 0.94), slingers(2, 340, 14)] },
  { groups: [workers(58, 460, 0.52), riders(4, 560, 8), shaman(380, 20)], surge: true },
  { groups: [workers(52, 480, 0.58), slingers(4, 340, 8), elite(3400, 8)] },
  { groups: [workers(58, 480, 0.52), riders(4, 580, 8), shaman(400, 18)], surge: true },
  // An ordinary elite arrives early in the final wave; no repeat of the 7000-HP climax from 1-5.
  { groups: [elite(4000, 0), workers(52, 480, 0.55, 1), riders(4, 580, 6),
    slingers(4, 360, 10)], surge: true },
];
