/** Normal 1-6: similar pressure to 1-5, longer 5–6 minute target, with short wolf-rider raids. */
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
  { groups: [workers(28, 400, 1.15)] },
  { groups: [workers(30, 420, 1.05), riders(3, 520, 8)] },
  { groups: [workers(32, 440, .95), slingers(2, 320, 12), elite(3200, 8)] },
  { groups: [workers(22, 420, 1.45), riders(3, 540, 10)] },
  { groups: [workers(36, 460, .85), riders(4, 560, 8)], surge: true },
  // A sparse middle wave separates the raids; the next wave still starts without waiting for a clear.
  { groups: [workers(20, 420, 1.55), slingers(2, 340, 14)] },
  { groups: [workers(36, 460, .84), riders(4, 560, 8), shaman(380, 20)], surge: true },
  { groups: [workers(32, 480, .95), slingers(4, 340, 8), elite(3400, 8)] },
  { groups: [workers(36, 480, .84), riders(4, 580, 8), shaman(400, 18)], surge: true },
  // An ordinary elite arrives early in the final wave; no repeat of the 7000-HP climax from 1-5.
  { groups: [elite(4000, 0), workers(32, 480, .9, 2), riders(4, 580, 6),
    slingers(4, 360, 10)], surge: true },
];
