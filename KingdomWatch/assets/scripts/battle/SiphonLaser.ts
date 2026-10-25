/** Pure bounded-ray geometry. No random numbers, game state or rendering. */
import { targetY } from '../config/Targeting';
export interface LaserBody { x: number; y: number; hitY?: number; dead: boolean; isBoss: boolean; def: { radius: number; elite?: boolean }; }
export interface LaserBounds { left: number; right: number; top: number; }
/** Overscan is only for rendering past the viewport; damage uses the unpadded bounds. */
export function laserLength(x: number, y: number, angle: number, bounds: LaserBounds, overscan = 0): number {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  if (dy <= 0) return 0;
  const top = (bounds.top + overscan - y) / dy;
  const side = dx > 1e-6 ? (bounds.right + overscan - x) / dx : dx < -1e-6 ? (bounds.left - overscan - x) / dx : Infinity;
  return Math.max(0, Math.min(top, side));
}
export function laserTouches(x: number, y: number, angle: number, length: number, halfWidth: number,
  tx: number, ty: number, radius: number): boolean {
  const dx = Math.cos(angle), dy = Math.sin(angle), rx = tx - x, ry = ty - y;
  const along = Math.max(0, Math.min(length, rx * dx + ry * dy));
  return (rx - along * dx) ** 2 + (ry - along * dy) ** 2 <= (halfWidth + radius) ** 2;
}
export function bestLaserAngle(x: number, y: number, halfWidth: number, bodies: readonly LaserBody[],
  bounds: LaserBounds, fallback = Math.PI / 2): number | null {
  let best: number | null = null, bestScore = -1, bestTurn = Infinity;
  for (const target of bodies) {
    const ty = targetY(target);
    if (target.dead || ty <= y + 24 || ty > bounds.top || target.x < bounds.left || target.x > bounds.right) continue;
    const angle = Math.max(.12, Math.min(Math.PI - .12, Math.atan2(ty - y, target.x - x)));
    const length = laserLength(x, y, angle, bounds);
    let score = 0;
    for (const m of bodies) {
      const my = targetY(m);
      if (m.dead || my <= y + 24 || my > bounds.top || m.x < bounds.left || m.x > bounds.right) continue;
      if (laserTouches(x, y, angle, length, halfWidth, m.x, my, m.def.radius))
        score += 1 + (m.isBoss ? .7 : m.def.elite ? .3 : 0);
    }
    const turn = Math.abs(angle - fallback);
    if (score > bestScore || score === bestScore && turn < bestTurn) { best = angle; bestScore = score; bestTurn = turn; }
  }
  return best;
}
export function turnLaser(angle: number, target: number, dt: number, radiansPerSecond = .45): number {
  const limit = Math.max(0, dt) * radiansPerSecond;
  return angle + Math.max(-limit, Math.min(limit, target - angle));
}
export function laserExposure(before: number, after: number, windup: number, duration: number): number {
  return Math.max(0, Math.min(after, windup + duration) - Math.max(before, windup));
}
