/** One piercing laser quad and bounded per-contact sparks, all driven by battle dt. */
import { Color, Graphics, Node } from 'cc';
import { SIPHON_LASER } from '../config/NewHeroConfig';
import { N } from '../ui/UIKit';
import { HeroFxShader } from './HeroFxShader';

interface Contact { x: number; y: number; age: number; seed: number; }
const tint = new Color();
export class SiphonLaserVFX {
  private beam: HeroFxShader;
  private ink: Graphics;
  private contacts: Contact[] = [];
  private cursor = 0;
  constructor(field: Node) {
    const parent = field.getChildByName('FxLayer')!;
    this.beam = new HeroFxShader(parent, 'siphonPiercingFlood', 1, 'emission');
    this.ink = N('siphonLaserContacts', parent).addComponent(Graphics);
  }
  tick(dt: number): void { for (const c of this.contacts) c.age += dt; }
  hit(x: number, y: number, lifeId: number): void {
    const at = this.cursor++ % 64, c = this.contacts[at] || (this.contacts[at] = {} as Contact);
    c.x = x; c.y = y; c.seed = lifeId; c.age = 0;
  }
  render(x: number, y: number, angle: number, length: number, halfWidth: number, age: number, duration: number): void {
    this.beam.begin(); this.ink.clear();
    const g = this.ink, dx = Math.cos(angle), dy = Math.sin(angle);
    if (age >= 0) {
      const tail = Math.max(0, age - SIPHON_LASER.windup - duration);
      const gain = Math.max(0, 1 - tail / SIPHON_LASER.tail);
      const painted = this.beam.draw(x + dx * length * .5, y + dy * length * .5,
        length + 80, halfWidth * 4.4 + 32, angle * 180 / Math.PI, age, .73, gain, 3, length, halfWidth);
      if (!painted) {
        for (let k = 0; k < 3; k++) {
          tint.set(k === 2 ? 255 : 188, k === 2 ? 240 : 83, 255, Math.round(gain * (k === 0 ? 45 : 210)));
          g.strokeColor = tint; g.lineWidth = halfWidth * (k === 0 ? 2.5 : k === 1 ? 1.7 : .2);
          if (age < SIPHON_LASER.windup) {
            g.circle(x, y, 4 + age / SIPHON_LASER.windup * 13); g.stroke();
          } else { g.moveTo(x, y); g.lineTo(x + dx * length, y + dy * length); g.stroke(); }
        }
      }
    }
    this.beam.end();
    for (const c of this.contacts) {
      if (c.age >= .18) continue;
      const fade = 1 - c.age / .18;
      for (let k = 0; k < 3; k++) {
        const a = c.seed * 1.7 + k * 2.1, reach = (6 + c.age * 50) * fade;
        tint.set(244, 192 + fade * 40, 255, Math.round(fade * 200)); g.strokeColor = tint; g.lineWidth = 1.4 * fade + .5;
        g.moveTo(c.x, c.y); g.lineTo(c.x + Math.cos(a) * reach, c.y + Math.sin(a) * reach); g.stroke();
      }
    }
  }
}
