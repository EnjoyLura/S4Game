/** Normal 1-5: modest HP pressure and fodder density; preserve wave arc, special counts and line damage. */
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
  ({ mob: 'goblin_shaman', count: 1, interval: 1, delay, actual: { hp: 420, dmg: 0 } });
const king = () =>
  ({ mob: 'goblin_king', count: 1, interval: 1, delay: 0, actual: { hp: 7800, dmg: 30 } });

export const FIFTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(40, 440, 0.85)] },
  { groups: [workers(50, 460, 0.67), slingers(2, 340, 13)] },
  { groups: [workers(60, 490, 0.51), slingers(2, 360, 12), elite(3600, 12)], surge: true },
  { groups: [workers(30, 460, 0.96)] },
  { groups: [workers(66, 520, 0.45), riders(580, 14)], surge: true },
  { groups: [workers(56, 540, 0.54), slingers(4, 380, 10), riders(600, 16), shaman(18)] },
  { groups: [workers(66, 570, 0.44), elite(3800, 8), riders(630, 17)], surge: true },
  // One king anchors the final wave; retain its authored identity and line damage.
  { groups: [king(), workers(56, 570, 0.48, 1), slingers(4, 400, 8),
    riders(650, 17), shaman(12)], surge: true },
];
