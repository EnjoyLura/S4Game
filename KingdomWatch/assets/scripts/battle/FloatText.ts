/** 伤害/金币飘字（池化；暴击大号橙字、普通白色小字 §3.11） */
import { Color, Label, Layers, Node, UIOpacity, tween, Vec3 } from 'cc';
import { Pool } from '../core/ObjectPool';

function col(hex: string): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  return c;
}

interface FText { node: Node; label: Label; }

export class FloatText {
  private pool: Pool<FText>;

  constructor(private parent: Node) {
    this.pool = new Pool<FText>(() => {
      const n = new Node('ft');
      n.layer = Layers.Enum.UI_2D;
      n.setParent(this.parent);
      const l = n.addComponent(Label);
      l.fontSize = 18;
      l.lineHeight = 22;
      return { node: n, label: l };
    }, t => { t.node.setPosition(0, 0, 0); });
  }

  spawn(x: number, y: number, text: string, color: string, big = false): void {
    const ft = this.pool.get();
    ft.label.string = text;
    ft.label.fontSize = big ? 26 : 16;
    ft.label.lineHeight = ft.label.fontSize * 1.2;
    ft.label.color = col(color);
    ft.node.setPosition(x, y, 0);
    ft.node.setScale(big ? 1.15 : 1, big ? 1.15 : 1, 1);
    let op = ft.node.getComponent(UIOpacity) || ft.node.addComponent(UIOpacity);
    op.opacity = 255;
    const target = new Vec3(x, y + 64, 0);
    tween(ft.node)
      .to(0.65, { position: target }, { easing: 'sineOut' })
      .call(() => { this.pool.put(ft); })
      .start();
    tween(op).to(0.55, { opacity: 0 }).start();
  }
}
