/** Normal 1-6: modest HP pressure and fodder density; preserve wave arc, special counts and line damage. */
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
  { groups: [workers(44, 460, 0.72)] },
  { groups: [workers(50, 490, 0.63), riders(3, 580, 8)] },
  { groups: [workers(54, 520, 0.56), slingers(2, 360, 12), elite(3600, 8)] },
  { groups: [workers(36, 490, 0.9), riders(3, 600, 10)] },
  { groups: [workers(60, 540, 0.5), riders(4, 630, 8)], surge: true },
  // Lighter middle wave separates the raids while maintaining a steady stream of targets.
  { groups: [workers(34, 490, 0.94), slingers(2, 380, 14)] },
  { groups: [workers(60, 540, 0.5), riders(4, 630, 8), shaman(420, 20)], surge: true },
  { groups: [workers(54, 560, 0.56), slingers(4, 380, 8), elite(3800, 8)] },
  { groups: [workers(60, 560, 0.5), riders(4, 650, 8), shaman(450, 18)], surge: true },
  // An ordinary elite arrives early in the final wave; no second boss climax after 1-5.
  { groups: [elite(4500, 0), workers(54, 560, 0.53, 1), riders(4, 650, 6),
    slingers(4, 400, 10)], surge: true },
];
