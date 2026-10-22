/** Normal 1-6: pressure from the opening, with denser and tougher middle/final waves. */
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
  { groups: [workers(58, 650, 0.54)] },
  { groups: [workers(72, 760, 0.43), riders(3, 850, 8)] },
  { groups: [workers(84, 880, 0.36), slingers(2, 520, 12), elite(5600, 8)] },
  { groups: [workers(48, 780, 0.67), riders(3, 1000, 10)] },
  { groups: [workers(100, 1040, 0.3), riders(4, 1180, 8)], surge: true },
  // A shorter middle wave separates the raids; it still carries more pressure than the old version.
  { groups: [workers(46, 840, 0.69), slingers(2, 620, 14)] },
  { groups: [workers(103, 1120, 0.29), elite(6400, 13), riders(4, 1280, 8), shaman(2400, 20)], surge: true, formation: 'escort' },
  { groups: [workers(96, 1240, 0.31), slingers(4, 820, 8), elite(7000, 8)] },
  { groups: [workers(107, 1340, 0.28), elite(7800, 11), riders(4, 1450, 8), shaman(2800, 18)], surge: true, formation: 'escort' },
  // An ordinary elite arrives early in the final wave; no second boss climax after 1-5.
  { groups: [elite(8600, 0), workers(102, 1440, 0.28, 1), riders(4, 1600, 6),
    slingers(4, 940, 10)], surge: true, formation: 'crossfire' },
];
