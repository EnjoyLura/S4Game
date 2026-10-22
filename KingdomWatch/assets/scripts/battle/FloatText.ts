/** Battle lettering: hard impact, opaque hold, fast collapse; no drifting fade.
 * One reusable Label per number; data-driven motion freezes with battle pause.
 */
import { Color, Label, Layers, Node, UIOpacity, Vec2 } from 'cc';
import { Pool } from '../core/ObjectPool';
import { LO } from '../config/GameConfig';
import { applyFont } from '../ui/Fonts';

const MAX_ACTIVE = 30;
const MERGE_WINDOW = 0.075;
type Kind = 'normal' | 'crit' | 'periodic';
interface Motion { attack: number; settle: number; hold: number; life: number; peak: number; rest: number; kick: number; opacity: number; }
const MOTION: Record<Kind, Motion> = {
  // hold/exit 已按用户反馈加长（2026-10-08）：停留久一点、收尾慢一点，数字更可读
  normal: { attack: 0.035, settle: 0.095, hold: 0.42, life: 0.62, peak: 1.2, rest: 1, kick: 6, opacity: 255 },
  crit: { attack: 0.032, settle: 0.105, hold: 0.50, life: 0.74, peak: 1.42, rest: 1.06, kick: 9, opacity: 255 },
  periodic: { attack: 0.025, settle: 0.07, hold: 0.24, life: 0.42, peak: 1.04, rest: 1, kick: 3, opacity: 220 },
};
export interface FloatEvent { target?: object; amount?: number; periodic?: boolean; }
interface FText {
  node: Node; label: Label; opacity: UIOpacity;
  kind: Kind; target?: object; amount: number; hits: number;
  age: number; life: number; x: number; y: number; baseX: number; baseY: number;
  pulseT: number; width: number; height: number;
}

export class FloatText {
  private pool: Pool<FText>;
  private live: FText[] = [];
  private colorCache = new Map<string, Color>();

  constructor(private parent: Node) {
    this.pool = new Pool<FText>(() => {
      const node = new Node('ft');
      node.layer = Layers.Enum.UI_2D;
      node.setParent(this.parent);
      const label = node.addComponent(Label);
      label.string = '';
      label.enableWrapText = false;
      label.isBold = false;
      label.enableOutline = true;
      label.enableShadow = true;
      label.shadowColor = new Color(16, 12, 8, 220);
      label.shadowOffset = new Vec2(1.5, -2.5);
      label.shadowBlur = 0;
      // Whole-label caching preserves outline and shadow; the pool bounds texture churn.
      label.cacheMode = Label.CacheMode.BITMAP;
      applyFont(label, 'combat');
      const opacity = node.addComponent(UIOpacity);
      return { node, label, opacity, kind: 'normal', amount: 0, hits: 0, age: 0, life: 1, x: 0, y: 0, baseX: 0, baseY: 0, pulseT: 0, width: 0, height: 0 };
    }, t => {
      t.node.active = false;
      t.node.angle = 0;
      t.target = undefined;
      t.opacity.opacity = 255;
    });
    const warm: FText[] = [];
    for (let i = 0; i < 24; i++) warm.push(this.pool.get());
    warm.forEach(t => this.pool.put(t));
  }

  spawn(x: number, y: number, text: string, _color: string, big = false, event: FloatEvent = {}): void {
    const kind: Kind = event.periodic ? 'periodic' : big ? 'crit' : 'normal';
    const amount = event.amount ?? Number(text);
    if (event.target && Number.isFinite(amount)) {
      const old = this.live.find(t => t.target === event.target && t.kind === kind && t.age <= MERGE_WINDOW);
      if (old) {
        old.amount += amount; old.hits++;
        old.label.string = String(Math.round(old.amount));
        old.width = this.measure(old.label.string, old.label.fontSize) * MOTION[kind].peak;
        old.pulseT = 0.055; // A small contact accent, without extending lifetime or moving the label.
        return;
      }
    }
    if (this.live.length >= MAX_ACTIVE || kind !== 'crit' && this.live.length >= MAX_ACTIVE - 6) return;
    if (kind === 'periodic') {
      let periodic = 0;
      for (const t of this.live) if (t.kind === 'periodic' && ++periodic >= 6) return;
    }
    const ft = this.pool.get();
    ft.kind = kind; ft.target = event.target; ft.amount = amount; ft.hits = 1;
    const motion = MOTION[kind];
    ft.age = 0; ft.life = motion.life; ft.pulseT = 0;
    ft.node.active = true;
    ft.label.string = text;
    ft.label.fontSize = kind === 'crit' ? 40 : kind === 'periodic' ? 21 : 27;
    ft.label.lineHeight = ft.label.fontSize * 1.35;
    ft.label.color = this.col(kind === 'crit' ? '#FF3030' : '#FFFFFF');
    ft.label.outlineColor = this.col(kind === 'crit' ? '#281311' : '#221D19');
    ft.label.outlineWidth = kind === 'crit' ? 3.2 : kind === 'periodic' ? 1.8 : 2.2;
    // Reserve the punch silhouette so the peak cannot crash into its neighbours.
    ft.width = this.measure(text, ft.label.fontSize) * motion.peak;
    ft.height = ft.label.fontSize * 1.25 * motion.peak;
    if (!this.place(ft, x, y + (kind === 'crit' ? 9 : 0))) { this.pool.put(ft); return; }
    ft.node.angle = 0;
    ft.node.setScale(0.72, 0.55, 1);
    ft.opacity.opacity = motion.opacity;
    this.live.push(ft);
  }

  private measure(text: string, size: number): number { return Math.max(24, text.length * size * 0.55 + 10); }

  private place(ft: FText, x: number, y: number): boolean {
    const top = LO.half - LO.notchTop - 132;
    const bottom = -LO.half + LO.safeBottom + 190;
    let best = Infinity, bestX = x, bestY = y;
    // Try nearby lanes instead of random offsets. Prefer proximity to the hit point.
    for (let lane = 0; lane < 9; lane++) {
      const row = Math.floor(lane / 3);
      const column = lane % 3;
      const offset = column === 0 ? 0 : (column === 1 ? -1 : 1) * Math.min(108, ft.width * 0.8 + 14);
      const px = Math.max(-348 + ft.width / 2, Math.min(330 - ft.width / 2, x + offset));
      const py = Math.max(bottom, Math.min(top, y + row * 36));
      let score = row * 1.1 + Math.abs(offset) * 0.003;
      for (const other of this.live) {
        if (other.age > other.life * 0.8) continue;
        const overlapX = (ft.width + other.width) * 0.55 - Math.abs(px - other.x);
        const overlapY = (ft.height + other.height) * 0.55 + 12 - Math.abs(py - other.y);
        if (overlapX > 0 && overlapY > 0) score += overlapX * overlapY;
      }
      if (score < best) { best = score; bestX = px; bestY = py; }
      if (score < 1) break;
    }
    if (best > 180 && ft.kind !== 'crit') return false;
    ft.baseX = ft.x = bestX; ft.baseY = ft.y = bestY;
    ft.node.setPosition(bestX, bestY, 0);
    return true;
  }

  tick(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const ft = this.live[i]; ft.age += dt;
      if (ft.age >= ft.life) { this.live.splice(i, 1); this.pool.put(ft); continue; }
      const m = MOTION[ft.kind];
      let sx = m.rest, sy = m.rest, lift = 1;
      if (ft.age < m.attack) {
        const k = 1 - Math.pow(1 - ft.age / m.attack, 3);
        sx = 0.72 + (m.peak - 0.72) * k;
        sy = 0.55 + (m.peak - 0.55) * k;
        lift = m.kick * k;
      } else if (ft.age < m.settle) {
        const k = 1 - Math.pow(1 - (ft.age - m.attack) / (m.settle - m.attack), 2);
        sx = sy = m.peak + (m.rest - m.peak) * k;
        lift = m.kick + (1 - m.kick) * k;
      }
      ft.pulseT = Math.max(0, ft.pulseT - dt);
      const pulse = ft.pulseT > 0 ? Math.sin(Math.PI * (1 - ft.pulseT / 0.055)) * 0.055 : 0;
      sx += pulse; sy += pulse;
      const exit = Math.max(0, (ft.age - m.hold) / (m.life - m.hold));
      if (exit > 0) { sx *= 1 - exit * exit * 0.18; sy *= 1 - exit * exit * 0.35; lift -= exit * exit * 5; }
      // An opaque, motionless middle gives weight; exit is a short downward collapse.
      ft.x = ft.baseX; ft.y = ft.baseY + lift;
      ft.node.setPosition(ft.x, ft.y, 0);
      ft.node.setScale(sx, sy, 1);
      ft.opacity.opacity = Math.round(m.opacity * (1 - exit * exit));
    }
  }

  private col(hex: string): Color {
    let color = this.colorCache.get(hex);
    if (!color) { color = new Color(); Color.fromHEX(color, hex); this.colorCache.set(hex, color); }
    return color;
  }
}
