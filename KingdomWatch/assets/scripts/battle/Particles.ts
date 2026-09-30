/**
 * 轻量粒子（纯数据 + 单 Graphics 重绘，无 Node/tween）：贯穿金色迸溅等高频小特效。
 * 池化上限 90；满了偷最旧的，绝不无界增长。
 */
import { Color, Graphics, Layers, Node } from 'cc';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hex: string; }

export class Particles {
  private node = new Node('particles');
  private g!: Graphics;
  private free: P[] = [];
  private act: P[] = [];
  private tmp = new Color();

  constructor(parent: Node, private cap = 90) {
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.g = this.node.addComponent(Graphics);
    for (let i = 0; i < this.cap; i++) {
      this.free.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, hex: '#FFFFFF' });
    }
  }

  /** 命中点迸溅：n 粒向上偏置随机散开，带重力下坠与淡出 */
  burst(x: number, y: number, hex: string, n: number, spd = 170): void {
    for (let i = 0; i < n; i++) {
      const p = this.free.pop() || this.act.shift();
      if (!p) return;
      const a = (Math.random() * 1.6 - 0.8) + Math.PI / 2;
      const s = spd * (0.5 + Math.random() * 0.7);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = 0.3 + Math.random() * 0.18;
      p.size = 2.5 + Math.random() * 2;
      p.hex = hex;
      this.act.push(p);
    }
  }

  tick(dt: number): void {
    if (this.act.length === 0) return;
    for (let i = this.act.length - 1; i >= 0; i--) {
      const p = this.act[i];
      p.life -= dt;
      if (p.life <= 0) { this.act.splice(i, 1); this.free.push(p); continue; }
      p.vy -= 460 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    const g = this.g;
    g.clear();
    for (const p of this.act) {
      const k = p.life / p.max;
      Color.fromHEX(this.tmp, p.hex);
      this.tmp.a = Math.floor(230 * k);
      g.fillColor = this.tmp;
      g.circle(p.x, p.y, p.size * (0.5 + k * 0.5));
      g.fill();
    }
  }
}
