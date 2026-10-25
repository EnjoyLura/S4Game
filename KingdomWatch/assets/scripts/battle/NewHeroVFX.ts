/** Shared missile silhouette; advanced impacts/extraction live in AdvancedHeroVFX. */
import { Color, Graphics } from 'cc';
import { C } from '../ui/UIKit';

const TAU = Math.PI * 2;
const paint = {
  soot: C('#302A30'), smokeLight: C('#A99A91'),
  orange: C('#EF782E'), gold: C('#FFC35E'), hot: C('#FFF1B8'),
  steel: C('#3E4650'), steelLight: C('#93A6B0'), brass: C('#D5A641'),
};
// Graphics copies assigned colors; reuse palette objects instead of allocating colors per path.
function fill(g: Graphics, color: Color, alpha = 1): void {
  color.a = Math.round(255 * Math.max(0, Math.min(1, alpha))); g.fillColor = color;
}
function stroke(g: Graphics, color: Color, width: number, alpha = 1): void {
  color.a = Math.round(255 * Math.max(0, Math.min(1, alpha))); g.strokeColor = color; g.lineWidth = width;
}
function ellipse(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry); g.fill();
}

export { CannonBlastVFX, SiphonBeamVFX } from './AdvancedHeroVFX';

/** Shared projectile batch, with its actual velocity and recorded trail; no extra missile sprites. */
export function drawCannonMissile(g: Graphics, x: number, y: number, vx: number, vy: number,
  size: number, age: number, seed: number, trail: readonly number[] = []): void {
  const len = Math.hypot(vx, vy) || 1, dx = vx / len, dy = vy / len, nx = -dy, ny = dx;
  const length = size * 2.9, width = size * .53, tailX = x - dx * length * .5, tailY = y - dy * length * .5;
  // Smoky wake follows stored flight positions, rather than being a fixed vertical sticker.
  for (let i = 0; i < trail.length; i += 2) {
    const t = (i + 2) / trail.length, r = size * (1.15 - t * .45);
    fill(g, paint.smokeLight, .18 * t);
    ellipse(g, trail[i] - dx * length, trail[i + 1] - dy * length, r, r * .85);
  }
  const flame = size * (2.3 + .2 * Math.sin(age * 23 + seed * TAU));
  fill(g, paint.orange, .75);
  g.moveTo(tailX + nx * width * .9, tailY + ny * width * .9);
  g.lineTo(tailX - dx * flame, tailY - dy * flame);
  g.lineTo(tailX - nx * width * .9, tailY - ny * width * .9); g.close(); g.fill();
  fill(g, paint.hot, .95);
  g.moveTo(tailX + nx * width * .45, tailY + ny * width * .45);
  g.lineTo(tailX - dx * flame * .7, tailY - dy * flame * .7);
  g.lineTo(tailX - nx * width * .45, tailY - ny * width * .45); g.close(); g.fill();
  // Gunmetal fins, brass nose and one clean highlight match the engineer's fantasy machinery.
  fill(g, paint.steel); stroke(g, paint.soot, 1.8);
  for (const side of [-1, 1]) {
    g.moveTo(x - dx * length * .12 + nx * width * side, y - dy * length * .12 + ny * width * side);
    g.lineTo(tailX - dx * 4 + nx * width * 1.9 * side, tailY - dy * 4 + ny * width * 1.9 * side);
    g.lineTo(tailX + nx * width * .6 * side, tailY + ny * width * .6 * side); g.close(); g.fill(); g.stroke();
  }
  fill(g, paint.steel); stroke(g, paint.soot, 2);
  g.moveTo(x + dx * length * .6, y + dy * length * .6);
  g.lineTo(x + dx * length * .18 + nx * width, y + dy * length * .18 + ny * width);
  g.lineTo(tailX + nx * width * .78, tailY + ny * width * .78);
  g.lineTo(tailX - nx * width * .78, tailY - ny * width * .78);
  g.lineTo(x + dx * length * .18 - nx * width, y + dy * length * .18 - ny * width); g.close(); g.fill(); g.stroke();
  fill(g, paint.brass);
  g.moveTo(x + dx * length * .6, y + dy * length * .6);
  g.lineTo(x + dx * length * .18 + nx * width * .9, y + dy * length * .18 + ny * width * .9);
  g.lineTo(x + dx * length * .18 - nx * width * .9, y + dy * length * .18 - ny * width * .9); g.close(); g.fill();
  stroke(g, paint.gold, 3.2);
  g.moveTo(x + nx * width * .92, y + ny * width * .92); g.lineTo(x - nx * width * .92, y - ny * width * .92); g.stroke();
  stroke(g, paint.steelLight, 1.5, .95);
  g.moveTo(tailX + dx * 3 + nx * width * .36, tailY + dy * 3 + ny * width * .36);
  g.lineTo(x + dx * length * .16 + nx * width * .5, y + dy * length * .16 + ny * width * .5); g.stroke();
}
