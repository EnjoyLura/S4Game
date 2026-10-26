/** Pure presentation timing. No engine, damage, or wall-clock dependencies. */
export const SPACE_TRANSIT = { vanish: .35, hiddenUntil: .80, end: 1.30 };
export function spaceTransitOpacity(age:number):number {
  if(age<SPACE_TRANSIT.vanish)return 1-Math.min(1,Math.max(0,age/SPACE_TRANSIT.vanish));
  if(age<SPACE_TRANSIT.hiddenUntil)return 0;
  return Math.min(1,Math.max(0,(age-SPACE_TRANSIT.hiddenUntil)/(SPACE_TRANSIT.end-SPACE_TRANSIT.hiddenUntil)));
}
