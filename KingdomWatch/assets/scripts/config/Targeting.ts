/** Attack reach is independent of damage type/resistance. Pure shared policy for every hit path. */
export type TargetLayer = 'all' | 'ground' | 'air';
export type AttackSlot = 'atk' | 'skill' | 'ult';
export interface TargetBody { y: number; hitY?: number; dead?: boolean; def: { airborne?: boolean }; }
/** Ground fields and low cannon rounds cannot acquire or splash flying enemies. Missiles can burst in air. */
export function attackLayer(hero: string, slot: AttackSlot): TargetLayer {
  if (hero === 'cannon' && slot !== 'ult' || hero === 'mora' && slot === 'skill') return 'ground';
  return 'all';
}
export function acceptsTarget(body: TargetBody, layer: TargetLayer = 'all'): boolean {
  return !body.dead && (layer === 'all' || (layer === 'air') === !!body.def.airborne);
}
/** Ground y remains the movement footprint; aim and airborne contacts follow the raised body. */
export function targetY(body: Pick<TargetBody, 'y' | 'hitY'>): number { return body.hitY ?? body.y; }
export function targetLabel(layer: TargetLayer): string {
  return layer === 'ground' ? '仅地面' : layer === 'air' ? '仅飞行' : '地面·飞行';
}

/** Explain an acquisition failure, never an ordinary missed shot or dead/empty automatic target. */
export function blockedTargetMessage(bodies: readonly (TargetBody & { x: number })[], layer: TargetLayer,
  x: number, y: number, range: number, manual = false): string | null {
  let alive = false, incompatible = false;
  const r2 = range * range;
  for (const body of bodies) {
    if (body.dead) continue;
    alive = true;
    if ((body.x-x)**2 + (targetY(body)-y)**2 > r2) continue;
    if (acceptsTarget(body, layer)) return null;
    incompatible = true;
  }
  if (incompatible) return layer === 'ground' ? '无法对空' : '无法对地';
  return manual ? alive ? '超出射程' : '暂无目标' : null;
}

