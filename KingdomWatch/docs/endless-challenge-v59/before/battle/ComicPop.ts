/**
 * Event-bound comic lettering. Preserve skill/ultimate kill chances and wall-hit
 * rules; a small spatial budget keeps simultaneous words readable.
 */
import { Color, Label, Layers, Node, UIOpacity, Vec2 } from 'cc';
import { Pool } from '../core/ObjectPool';
import { PAL, LO } from '../config/GameConfig';
import { applyFont } from '../ui/Fonts';

export const POP_DEFS: Record<string, { words: string[]; color: string; size: number; chance: number }> = {
  skillKillArrow: { words: ['OOF!', 'SHUNT!'], color: PAL.gold, size: 32, chance: 0.6 },
  skillKillSnipe: { words: ['AACK!'], color: '#91C8F4', size: 32, chance: 0.6 },
  ultKill: { words: ['KAPOW!'], color: '#C8E6FF', size: 40, chance: 0.6 },
  meleeHit: { words: ['POW!', 'SOK!'], color: PAL.red, size: 28, chance: 0.3 },
  stoneHit: { words: ['咚!'], color: '#D0BDA0', size: 26, chance: 0.35 },
};
const MAX_ACTIVE = 6;
interface Pop { node: Node; label: Label; opacity: UIOpacity; x: number; y: number; age: number; }

export class ComicPop {
  private pool: Pool<Pop>;
  private live: Pop[] = [];
  private colorCache = new Map<string, Color>();
  private sequence = 0;

  constructor(private parent: Node) {
    this.pool = new Pool<Pop>(() => {
      const node = new Node('pop');
      node.layer = Layers.Enum.UI_2D;
      node.setParent(this.parent);
      const label = node.addComponent(Label);
      label.string = '';
      label.enableWrapText = false;
      label.enableOutline = true;
      label.outlineColor = new Color(39, 26, 14, 255);
      label.outlineWidth = 3;
      label.enableShadow = true;
      label.shadowColor = new Color(18, 13, 8, 180);
      label.shadowOffset = new Vec2(1.5, -2);
      label.shadowBlur = 0;
      label.cacheMode = Label.CacheMode.BITMAP;
      applyFont(label, 'comic');
      return { node, label, opacity: node.addComponent(UIOpacity), x: 0, y: 0, age: 0 };
    }, p => { p.node.active = false; p.node.angle = 0; p.opacity.opacity = 255; });
    const warm: Pop[] = [];
    for (let i = 0; i < MAX_ACTIVE; i++) warm.push(this.pool.get());
    warm.forEach(p => this.pool.put(p));
  }

  pop(x: number, y: number, kind: string): void {
    const def = POP_DEFS[kind];
    if (!def || this.live.length >= MAX_ACTIVE || Math.random() > def.chance) return;
    // No stack of repeated exclamations over a single tightly packed kill group.
    if (this.live.some(p => p.age < 0.18 && Math.abs(p.x - x) < 86 && Math.abs(p.y - (y + 72)) < 70)) return;
    const word = def.words[Math.floor(Math.random() * def.words.length)];
    const p = this.pool.get();
    p.label.string = word;
    p.label.fontSize = def.size;
    p.label.lineHeight = def.size * 1.4;
    p.label.isBold = /[\u3400-\u9FFF]/.test(word);
    applyFont(p.label, p.label.isBold ? 'body' : 'comic');
    p.label.color = this.col(def.color);
    const halfW = word.length * def.size * 0.31 + 12;
    p.x = Math.max(-345 + halfW, Math.min(330 - halfW, x));
    p.y = Math.min(LO.half - LO.notchTop - 142, y + 72);
    p.age = 0;
    p.node.active = true;
    p.node.setPosition(p.x, p.y, 0);
    p.node.angle = this.sequence++ % 2 ? 3 : -3;
    p.node.setScale(0.72, 0.72, 1);
    p.opacity.opacity = 255;
    this.live.push(p);
  }

  tick(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.age += dt;
      if (p.age >= 0.54) { this.live.splice(i, 1); this.pool.put(p); continue; }
      const scale = p.age < 0.065 ? 0.72 + 0.4 * (1 - Math.pow(1 - p.age / 0.065, 3))
        : p.age < 0.15 ? 1.12 - 0.12 * (p.age - 0.065) / 0.085 : 1;
      const fade = Math.min(1, (0.54 - p.age) / 0.22);
      p.node.setScale(scale, scale, 1);
      p.node.setPosition(p.x, p.y + Math.max(0, p.age - 0.15) * 33, 0);
      p.opacity.opacity = Math.round(255 * fade);
    }
  }

  private col(hex: string): Color {
    let c = this.colorCache.get(hex);
    if (!c) { c = new Color(); Color.fromHEX(c, hex); this.colorCache.set(hex, c); }
    return c;
  }
}
