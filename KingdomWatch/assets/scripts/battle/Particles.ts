/**
 * 轻量粒子（纯数据 + 单 Graphics 重绘，无 Node/tween）：贯穿金色迸溅等高频小特效。
 * 池化上限 90；满了偷最旧的，绝不无界增长。
 */
import { Color, Graphics, Layers, Node } from 'cc';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: Color; }

export class Particles {
  private node = new Node('particles');
  private g!: Graphics;
  private free: P[] = [];
  private act: P[] = [];
  private tmp = new Color();
  private dirty = false;

  constructor(parent: Node, private cap = 90) {
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.g = this.node.addComponent(Graphics);
    for (let i = 0; i < this.cap; i++) {
      this.free.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: new Color() });
    }
  }

  /** Short impact fragments follow the incoming direction; muzzle sparks retain the upward bias. */
  burst(x: number, y: number, hex: string, n: number, spd = 170, angle?: number): void {
    this.dirty = true;
    for (let i = 0; i < n; i++) {
      const p = this.free.pop() || this.act.shift();
      if (!p) return;
      const a = (Math.random() * 1.6 - 0.8) + (angle ?? Math.PI / 2);
      const s = spd * (0.5 + Math.random() * 0.7);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = angle === undefined ? 0.24 + Math.random() * 0.1 : 0.14 + Math.random() * 0.1;
      p.size = 1.8 + Math.random() * 1.6;
      Color.fromHEX(p.color, hex);
      this.act.push(p);
    }
  }

  tick(dt: number, renderNow = true): void {
    if (this.act.length === 0) {
      if (renderNow && this.dirty) { this.g.clear(); this.dirty = false; }
      return;
    }
    this.dirty = true;
    for (let i = this.act.length - 1; i >= 0; i--) {
      const p = this.act[i];
      p.life -= dt;
      if (p.life <= 0) { this.act.splice(i, 1); this.free.push(p); continue; }
      p.vy -= 460 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (!renderNow) return;
    const g = this.g;
    g.clear();
    for (const p of this.act) {
      const k = p.life / p.max;
      this.tmp.set(p.color);
      this.tmp.a = Math.floor(230 * k);
      g.fillColor = this.tmp;
      g.circle(p.x, p.y, p.size * (0.5 + k * 0.5));
      g.fill();
    }
    this.dirty = false;
  }
}
