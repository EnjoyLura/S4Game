/** Normal 1-2: authored arrival stats, 1x combat target 3–4 minutes. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_slinger', count, interval, delay, actual: { hp, dmg: 8 } });
export const SECOND_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(14, 320, 2.1)] },
  { groups: [workers(18, 340, 1.7), slingers(2, 280, 5, 13)] },
  { groups: [workers(20, 360, 1.6), slingers(2, 300, 5, 15)] },
  { groups: [workers(12, 360, 2.7)] },
  { groups: [workers(26, 400, 1.25), slingers(4, 320, 6, 9)], surge: true },
  { groups: [workers(20, 420, 1.5), slingers(4, 340, 6, 7)], surge: true },
  { groups: [workers(12, 440, 2, 4),
    { mob: 'goblin_brute', count: 2, interval: 12, delay: 2, actual: { hp: 2600, dmg: 24 } }] },
];
