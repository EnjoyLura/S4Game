/** Normal 1-2: denser fodder for open abilities; preserve authored stats, encounter order and duration. */
import { WaveDef } from './Mobs';

const workers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_worker', count, interval, delay, actual: { hp, dmg: 10 } });
const slingers = (count: number, hp: number, interval: number, delay = 0) =>
  ({ mob: 'goblin_slinger', count, interval, delay, actual: { hp, dmg: 8 } });
export const SECOND_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(20, 320, 1.45)] },
  { groups: [workers(26, 340, 1.2), slingers(2, 280, 5, 13)] },
  { groups: [workers(28, 360, 1.1), slingers(2, 300, 5, 15)] },
  { groups: [workers(20, 360, 1.55)] },
  { groups: [workers(36, 400, 0.88), slingers(4, 320, 6, 9)], surge: true },
  { groups: [workers(28, 420, 1.05), slingers(4, 340, 6, 7)], surge: true },
  { groups: [workers(20, 440, 1.35, 3),
    { mob: 'goblin_brute', count: 2, interval: 12, delay: 2, actual: { hp: 2600, dmg: 24 } }] },
];
