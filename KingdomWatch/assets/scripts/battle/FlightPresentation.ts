/** Cosmetic height only. Call once per actor tick; hit queries read the cached result. */
export function flightLiftFor(airborne: boolean | undefined, id: string, radius: number, walkClock: number): number {
  if (!airborne) return 0;
  const base = id.includes('eagle') ? 72 : id.includes('bat') ? 62 : id.includes('wasp') ? 68
    : Math.max(60, Math.min(90, radius * 3));
  return base + Math.sin(walkClock * 1.4) * 5;
}

/** A soft projection at the footprint, shared by living and dying flyers. */
export const FLIGHT_SHADOW = { width: .72, height: .13, alpha: 22 } as const;
