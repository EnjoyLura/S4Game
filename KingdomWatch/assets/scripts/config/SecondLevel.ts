/** Normal 1-2: pressure from the opening, with denser and tougher middle/final waves. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_slinger', count, interval, delay, actual: { hp, dmg: 8 } });
export const SECOND_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(26, 470, 1.1)] },
  { groups: [workers(36, 540, 0.86), slingers(2, 400, 5, 13)] },
  { groups: [workers(46, 660, 0.66), slingers(2, 500, 5, 15)] },
  { groups: [workers(26, 570, 1.18)] },
  { groups: [workers(62, 800, 0.5), slingers(4, 650, 6, 9)], surge: true },
  { groups: [workers(50, 900, 0.58), slingers(4, 750, 6, 7)], surge: true },
  { groups: [workers(36, 1000, 0.73, 3),
    { mob: 'goblin_brute', count: 2, interval: 12, delay: 2, actual: { hp: 4800, dmg: 24 } }] },
];
