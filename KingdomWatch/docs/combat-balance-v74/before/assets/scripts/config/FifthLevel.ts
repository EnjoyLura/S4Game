/** Normal 1-5: denser fodder for open abilities; preserve authored stats, encounter order and duration. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, delay: number) =>
  ({ mob: 'goblin_slinger', count, interval: 5, delay, actual: { hp, dmg: 8 } });
const riders = (hp: number, delay: number) =>
  ({ mob: 'wolf_rider', count: 2, interval: 6, delay, actual: { hp, dmg: 12 } });
const elite = (hp: number, delay: number, dmg = 24) =>
  ({ mob: 'goblin_brute', count: 1, interval: 1, delay, actual: { hp, dmg } });
const shaman = (delay: number) =>
  ({ mob: 'goblin_shaman', count: 1, interval: 1, delay, actual: { hp: 380, dmg: 0 } });
const king = () =>
  ({ mob: 'goblin_king', count: 1, interval: 1, delay: 0, actual: { hp: 7000, dmg: 30 } });

export const FIFTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(40, 380, 0.85)] },
  { groups: [workers(48, 400, 0.7), slingers(2, 300, 13)] },
  { groups: [workers(58, 420, 0.53), slingers(2, 320, 12), elite(3200, 12)], surge: true },
  { groups: [workers(30, 400, 0.96)] },
  { groups: [workers(64, 440, 0.46), riders(520, 14)], surge: true },
  { groups: [workers(54, 460, 0.56), slingers(4, 340, 10), riders(540, 16), shaman(18)] },
  { groups: [workers(64, 480, 0.45), elite(3400, 8), riders(560, 17)], surge: true },
  // Replace the final elite with the king, preserving this encounter's authored HP and line damage.
  { groups: [king(), workers(54, 480, 0.5, 1), slingers(4, 360, 8),
    riders(580, 17), shaman(12)], surge: true },
];
