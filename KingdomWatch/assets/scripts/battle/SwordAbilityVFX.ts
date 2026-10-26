/** Jade sword spell presentation. No collision, damage, movement or wall-clock state. */
import { Graphics } from 'cc';
import { CA } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';
export const SWORD_ABILITY_EFFECT = 'fx/sword-jade-flow';
export const SWORD_FLIGHT_CAP = 24;

/** The point passed by ProjectileManager remains the exact sword tip / landing point. */
export function drawSwordFlight(shader: HeroFxShader | null, x: number, y: number, angle: number,
  size: number, age: number, seed: number, giant: boolean, opacity = 1): boolean {
  if (!shader) return false;
  const length = size * (giant ? 5.6 : 7.8), ux = Math.cos(angle), uy = Math.sin(angle);
  return shader.draw(x - ux * length * .65, y - uy * length * .65, length * .9, length * 2.7,
    angle * 180 / Math.PI - 90, age, seed, opacity, 0, length, giant ? 1 : 0);
}

/** Small grounded debris has weight, an upward impulse and a finite landing, not star confetti. */
export function swordDebris(g: Graphics, x: number, y: number, radius: number, age: number, giant: boolean): void {
  const life = giant ? .78 : .42, t = Math.min(1, age / life);
  if (t >= 1) return;
  const count = giant ? 14 : 5, spread = radius * (giant ? .72 : .45);
  for (let k = 0; k < count; k++) {
    const a = k * 2.399963, speed = .36 + (k % 4) * .16;
    const d = spread * speed * (1 - (1 - t) ** 2);
    const up = Math.max(0, Math.sin(Math.min(1, t * 1.45) * Math.PI)) * radius * (.15 + k % 3 * .045);
    const px = x + Math.cos(a) * d, groundY = y + Math.sin(a) * d * .35;
    const s = (giant ? 3.4 : 1.8) * (1 - t * .55) * (1 + (k % 3) * .25), spin = a + t * (k % 2 ? 4 : -3);
    g.fillColor = CA('#3A3427', (1 - t) * .22); g.ellipse(px, groundY - 1, s * 1.5, s * .5); g.fill();
    g.fillColor = CA(k % 3 ? '#8F8464' : '#A9B8A0', (1 - t) * .86);
    g.moveTo(px + Math.cos(spin) * s, groundY + up + Math.sin(spin) * s);
    g.lineTo(px + Math.cos(spin + 2.1) * s * 1.4, groundY + up + Math.sin(spin + 2.1) * s * 1.4);
    g.lineTo(px + Math.cos(spin + 4.0) * s, groundY + up + Math.sin(spin + 4.0) * s); g.close(); g.fill();
  }
}
