/** Normal 1-5: the first five-stage climax; three Lv.5 heroes / Lv.3 weapons, 4–5 minutes at 1x. */
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

export const FIFTH_LEVEL_WAVES: WaveDef[] = [
  { groups: [workers(26, 380, 1.35)] },
  { groups: [workers(30, 400, 1.1), slingers(2, 300, 13)] },
  { groups: [workers(36, 420, .85), slingers(2, 320, 12), elite(3200, 12)], surge: true },
  { groups: [workers(18, 400, 1.6)] },
  { groups: [workers(40, 440, .75), riders(520, 14)], surge: true },
  { groups: [workers(34, 460, .9), slingers(4, 340, 10), riders(540, 16), shaman(18)] },
  { groups: [workers(40, 480, .72), elite(3400, 8), riders(560, 17)], surge: true },
  // The stronger elite starts with the final wave so it can walk into range before the queue ends.
  { groups: [elite(7000, 0, 30), workers(34, 480, .8, 2), slingers(4, 360, 8),
    riders(580, 17), shaman(12)], surge: true },
];
