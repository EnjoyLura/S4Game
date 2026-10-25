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

