/** Pure body-space geometry; no engine, combat, assets or wall-clock dependency. */
export interface BodyPoint { x: number; hitY: number; dead?: boolean; }
export interface FieldPoint { x: number; y: number; }
export interface BodyBounds { left: number; right: number; bottom: number; top: number; }
export interface BodyMotion {
  state: string; immobilized: boolean; slowT: number; slowAmp: number; def: { speed: number };
}

/** The same straight downward motion contract as HeroBase, independent of its launch origin. */
export function bodyDownSpeed(body: BodyMotion): number {
  if (body.state !== 'move' || body.immobilized) return 0;
  return Math.max(0, body.def.speed) * (body.slowT > 0 ? 1 - Math.max(0, Math.min(1, body.slowAmp)) : 1);
}

/** Solve |target + (0,-downSpeed)t - hand| = bulletSpeed*t from the ACTUAL hand.
 * Stable quadratic roots avoid cancellation for almost equal speeds. Unreachable targets use
 * the present-point direction with a finite estimated flight time, rather than NaN or reversal.
 */
export function interceptDirection(x: number, y: number, targetX: number, targetY: number,
  downSpeed: number, bulletSpeed: number) {
  const dx = targetX - x, dy = targetY - y, v = Math.max(0, downSpeed), speed = Math.max(1e-6, bulletSpeed);
  const c = dx * dx + dy * dy;
  if (c <= 1e-12) return { dirX: 0, dirY: 1, flightTime: 0, impactX: targetX, impactY: targetY, reachable: true };
  const a = v * v - speed * speed, b = -2 * dy * v;
  let time = Infinity;
  if (Math.abs(a) <= 1e-10 * Math.max(1, v * v, speed * speed)) {
    if (Math.abs(b) > 1e-10) {
      const root = -c / b;
      if (root >= 0) time = root;
    }
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const q = -.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
      const first = q / a, second = q !== 0 ? c / q : Infinity;
      if (first >= 0) time = first;
      if (second >= 0) time = Math.min(time, second);
    }
  }
  const reachable = Number.isFinite(time);
  if (!reachable) time = Math.sqrt(c) / speed;
  const impactX = targetX, impactY = reachable ? targetY - v * time : targetY;
  const ax = impactX - x, ay = impactY - y, length = Math.hypot(ax, ay);
  return { dirX: length > 1e-10 ? ax / length : 0, dirY: length > 1e-10 ? ay / length : 1,
    flightTime: time, impactX, impactY, reachable };
}

/** Count the real circular footprint, then refine each seed with its local centroid. */
export function densestBodyArea(bodies: readonly BodyPoint[], x: number, y: number,
  castRange: number, radius: number, bounds: BodyBounds): FieldPoint | null {
  const r2 = radius * radius, range2 = castRange * castRange;
  let best: FieldPoint | null = null, score = 0, nearest = Infinity;
  const visible = (m: BodyPoint): boolean => !m.dead && Number.isFinite(m.x) && Number.isFinite(m.hitY)
    && m.x >= bounds.left && m.x <= bounds.right && m.hitY >= bounds.bottom && m.hitY <= bounds.top;
  const consider = (cx: number, cy: number): void => {
    if (cx < bounds.left || cx > bounds.right || cy < bounds.bottom || cy > bounds.top) return;
    const distance = (cx - x) ** 2 + (cy - y) ** 2;
    if (distance > range2) return;
    let count = 0;
    for (const m of bodies) if (visible(m) && (m.x - cx) ** 2 + (m.hitY - cy) ** 2 <= r2) count++;
    if (count > score || count > 0 && count === score && distance < nearest) {
      score = count; nearest = distance; best = { x: cx, y: cy };
    }
  };
  for (const m of bodies) {
    if (!visible(m) || (m.x - x) ** 2 + (m.hitY - y) ** 2 > range2) continue;
    consider(m.x, m.hitY);
    let sx = 0, sy = 0, n = 0;
    for (const o of bodies) if (visible(o) && (o.x - m.x) ** 2 + (o.hitY - m.hitY) ** 2 <= r2) {
      sx += o.x; sy += o.hitY; n++;
    }
    if (n > 1) consider(sx / n, sy / n);
  }
  return best;
}

/** Mutate only the independent effect position. An arbitrarily long step cannot overshoot. */
export function moveFieldToward(point: FieldPoint, target: FieldPoint, speed: number, dt: number, forwardOnly = false): number {
  const dx = target.x - point.x, dy = forwardOnly ? Math.max(0, target.y - point.y) : target.y - point.y;
  const distance = Math.hypot(dx, dy);
  const travel = Math.min(distance, Math.max(0, speed) * Math.max(0, dt));
  if (distance > 0 && travel > 0) {
    point.x += dx / distance * travel; point.y += dy / distance * travel;
  }
  return travel;
}

/** Earliest circle contact with a transverse blade translated along its forward axis.
 * The two rounded tips and the full span are swept continuously, including zero-length steps.
 */
export function sweptBladeEntry(along: number, across: number, travel: number, halfLength: number, radius: number): number {
  const gap = Math.max(0, Math.abs(across) - Math.max(0, halfLength));
  if (gap > radius) return Infinity;
  const extent = Math.sqrt(Math.max(0, radius * radius - gap * gap));
  if (along < -extent || along > Math.max(0, travel) + extent) return Infinity;
  if (along <= extent) return 0;
  return travel > 0 ? (along - extent) / travel : Infinity;
}

/** endPoint owns clipping; TTL is only a generous safety bound, never the return destination. */
export function finiteReturnPath(x: number, y: number, launchX: number, launchY: number, speed: number) {
  const dx = launchX - x, dy = launchY - y, distance = Math.hypot(dx, dy);
  return { dirX: distance > 0 ? dx / distance : 0, dirY: distance > 0 ? dy / distance : 1,
    endPoint: { x: launchX, y: launchY }, distance, ttl: distance / Math.max(1, speed) + .25 };
}
