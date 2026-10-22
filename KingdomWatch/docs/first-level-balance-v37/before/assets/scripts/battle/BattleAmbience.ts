/** Quiet edge-only environmental motion keeps the central combat lane readable. */
import { Color, Graphics, Layers, Node } from 'cc';
import { LO } from '../config/GameConfig';

export class BattleAmbience {
  private g: Graphics;
  private clock = 0;
  private redraw = 0;
  private tint = new Color();
  constructor(parent: Node) {
    const node = new Node('environmentMotion');
    node.layer = Layers.Enum.UI_2D;
    node.setParent(parent);
    node.setSiblingIndex(0);
    this.g = node.addComponent(Graphics);
  }
  tick(dt: number): void {
    this.clock += dt; this.redraw += dt;
    if (this.redraw < 1 / 20) return;
    this.redraw = 0;
    const g = this.g; g.clear();
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (285 + Math.sin(this.clock * 0.45 + i * 2.7) * 38);
      const span = LO.half * 2 - 260;
      const y = -LO.half + 220 + ((i * 107 + this.clock * (10 + i % 3 * 3)) % span);
      const a = Math.round(36 + 28 * Math.sin(this.clock * 1.2 + i));
      this.tint.set(247, 223, 139, a); g.fillColor = this.tint;
      g.circle(x, y, 1.2 + i % 3 * 0.4); g.fill();
    }
  }
}
