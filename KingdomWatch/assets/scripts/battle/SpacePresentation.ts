/** Pure presentation timing. No engine, damage, or wall-clock dependencies. */
const PORTAL_END=.85, RELEASE_DELAY=1.5;
export const SPACE_TRANSIT = { vanish: .35, portalEnd: PORTAL_END, releaseDelay: RELEASE_DELAY,
  hiddenUntil: PORTAL_END+RELEASE_DELAY, end: PORTAL_END+RELEASE_DELAY+.5,
  arrivalEnd: PORTAL_END+RELEASE_DELAY+.85 };
export function spaceTransitOpacity(age:number):number {
  if(age<SPACE_TRANSIT.vanish)return 1-Math.min(1,Math.max(0,age/SPACE_TRANSIT.vanish));
  if(age<SPACE_TRANSIT.hiddenUntil)return 0;
  return Math.min(1,Math.max(0,(age-SPACE_TRANSIT.hiddenUntil)/(SPACE_TRANSIT.end-SPACE_TRANSIT.hiddenUntil)));
}
