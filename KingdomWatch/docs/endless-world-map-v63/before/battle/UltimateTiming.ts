/** One battle-clock contract for cast queues, presentation and panel protection. */
export const ULT_TIMING: Record<string, { windup: number; duration: number }> = {
  archer: { windup: .55, duration: 3.4 },
  sniper: { windup: 1.1, duration: 3 },
  pyro: { windup: .7, duration: 5 },
  volt: { windup: .65, duration: 4.5 },
  mora: { windup: .5, duration: 4.2 },
};
export const ARCHER_ULT_ROW_GAP = .52, ARCHER_ULT_ROUND_GAP = 1.35;
export const METEOR_ULT_GAP = .48;
/** Three field contacts fit inside the existing continuous frost rain (0.5 / 1.7 / 2.9s). */
export const FROST_ULT_HIT_GAP = 1.2;
export interface UltimateCue { hero: string; x: number; y: number; windup: number; duration: number; }
export interface UltimateBeat { hero: string; x: number; y: number; energy: number; contact?: boolean; }
