/** Normal 1-5: pressure from the opening, with denser and tougher middle/final waves. */
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
  ({ mob: 'goblin_shaman', count: 1, interval: 1, delay, actual: { hp: 2200, dmg: 0 } });
const king = () =>
  ({ mob: 'goblin_king', count: 1, interval: 1, delay: 0, actual: { hp: 12000, dmg: 30 } });

export const FIFTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(52, 600, 0.65)] },
  { groups: [workers(74, 720, 0.45), slingers(2, 480, 13)] },
  { groups: [workers(94, 860, 0.32), slingers(2, 600, 12), elite(5800, 12)], surge: true },
  { groups: [workers(40, 760, 0.71)] },
  { groups: [workers(110, 1000, 0.27), riders(1000, 14)], surge: true },
  { groups: [workers(95, 1140, 0.31), slingers(4, 760, 10), elite(6400, 11), riders(1180, 16), shaman(18)], formation: 'escort' },
  { groups: [workers(114, 1280, 0.25), elite(7200, 8), riders(1360, 17)], surge: true },
  // One king anchors the final wave; retain its authored identity and line damage.
  { groups: [king(), workers(100, 1360, 0.27, 1), slingers(4, 860, 8),
    riders(1500, 17), shaman(12)], surge: true, formation: 'escort' },
];
