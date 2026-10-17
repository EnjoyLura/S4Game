/** A few drifting points of light; timing only, no gameplay state. */
import { Graphics } from 'cc';
import { CA } from './UIKit';
const clamp = (v: number): number => Math.max(0, Math.min(1, v));

export function celebrationConfetti(g: Graphics, age: number, originY: number, width = 600, count = 32): void {
  for (let i = 0; i < Math.min(12, count); i++) {
    const t = age - .18 - (i % 4) * .065, p = clamp(t / .95);
    if (t <= 0 || p >= 1) continue;
    const side = i % 2 ? 1 : -1;
    const x = side * width * (.22 + (i % 5) * .045) + side * p * 9;
    const y = originY - 45 - (i % 3) * 24 + p * (28 + i % 4 * 7);
    const s = (i % 3 === 0 ? 4 : 1.8) * Math.sin(p * Math.PI);
    g.fillColor = CA(i % 2 ? '#FFE1A0' : '#FFF6DC', Math.sin(p * Math.PI) * .65);
    if (i % 3) g.circle(x, y, s);
    else {
      g.moveTo(x, y + s); g.quadraticCurveTo(x + s * .15, y + s * .15, x + s * .7, y);
      g.quadraticCurveTo(x + s * .15, y - s * .15, x, y - s);
      g.quadraticCurveTo(x - s * .15, y - s * .15, x - s * .7, y);
      g.quadraticCurveTo(x - s * .15, y + s * .15, x, y + s); g.close();
    }
    g.fill();
  }
}
