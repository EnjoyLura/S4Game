/** 伤害/金币飘字（池化；暴击大号橙字、普通白色小字 §3.11） */
import { Color, Label, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { Pool } from '../core/ObjectPool';

/** 高峰限流：爆炸/分裂/群伤叠满时飘字过多会成为 GC 与渲染尖峰源 */
const MAX_ACTIVE = 24;

function col(hex: string, cache: Map<string, Color>): Color {
  let c = cache.get(hex);
  if (!c) { c = new Color(); Color.fromHEX(c, hex); cache.set(hex, c); }
  return c;
}

interface FText { node: Node; label: Label; target: Vec3; }

export class FloatText {
  private pool: Pool<FText>;
  private active = 0;
  private colorCache = new Map<string, Color>();

  constructor(private parent: Node) {
    this.pool = new Pool<FText>(() => {
      const n = new Node('ft');
      n.layer = Layers.Enum.UI_2D;
      n.setParent(this.parent);
      const l = n.addComponent(Label);
      l.fontSize = 18;
      l.lineHeight = 22;
      return { node: n, label: l, target: new Vec3() };
    }, t => { t.node.setPosition(0, 0, 0); });
    // 预热，避免开局首波伤害的创建尖峰
    const warm: FText[] = [];
    for (let i = 0; i < 10; i++) warm.push(this.pool.get());
    for (const t of warm) this.pool.put(t);
  }

  spawn(x: number, y: number, text: string, color: string, big = false): void {
    if (this.active >= MAX_ACTIVE) return;
    const ft = this.pool.get();
    this.active++;
    ft.target.set(x, y + 64, 0);
    ft.label.string = text;
    ft.label.fontSize = big ? 26 : 16;
    ft.label.lineHeight = ft.label.fontSize * 1.2;
    ft.label.color = col(color, this.colorCache);
    ft.node.setPosition(x, y, 0);
    ft.node.setScale(big ? 1.15 : 1, big ? 1.15 : 1, 1);
    const op = ft.node.getComponent(UIOpacity) || ft.node.addComponent(UIOpacity);
    op.opacity = 255;
    tween(ft.node)
      .to(0.65, { position: ft.target }, { easing: 'sineOut' })
      .call(() => { this.active--; this.pool.put(ft); })
      .start();
    tween(op).to(0.55, { opacity: 0 }).start();
  }
}
