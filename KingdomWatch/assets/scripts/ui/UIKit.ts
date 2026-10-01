/**
 * 程序化 UI 组件库（占位渲染：色块+描边+文字，视觉对齐 UX 线稿 token）
 * 美术资源已接入：btn/gbar/gswitch 内部优先加载 assets/resources/ux 同名贴图，
 * 加载失败保持程序绘制兜底 —— 见 UX/wireframe.html 资源清单与 ui/Ux.ts
 */
import { Color, Graphics, Label, Layers, Node, Sprite, UITransform, UIOpacity, tween, Vec3, BlockInputEvents } from 'cc';
import { LO, PAL } from '../config/GameConfig';
import { artSetFrame, artSprite, uxFrame } from './Ux';

export function C(hex: string): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  return c;
}

/** 带透明度的颜色（hex + 0~1 alpha） */
export function CA(hex: string, alpha: number): Color {
  const c = C(hex);
  c.a = Math.round(255 * Math.max(0, Math.min(1, alpha)));
  return c;
}

type FillLike = string | Color;

function toColor(v: FillLike): Color {
  return typeof v === 'string' ? C(v) : v;
}

/** 线稿顶基坐标(设计px,左上) → 画布中心坐标；t 从可视区顶（刘海下）起算 */
export function WX(l: number, w: number): number { return l + w / 2 - 375; }
export function WY(t: number, h = 0): number { return (LO.half - LO.safeTop) - t - h / 2; }
/** 底基坐标：b 从可视区底（手势条上）起算，用于贴底的耐久条/图标/大招列 */
export function WYB(b: number, h = 0): number { return -(LO.half - LO.safeBottom) + b + h / 2; }

export function N(name: string, parent: Node | null, x = 0, y = 0, w = 0, h = 0): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D; // 相机只渲染 UI_2D 层（§12.3），动态节点必须显式设层
  if (parent) n.setParent(parent);
  n.setPosition(x, y, 0);
  if (w > 0 || h > 0) n.addComponent(UITransform).setContentSize(w, h);
  return n;
}

export interface LabelOpts {
  size?: number; color?: string; align?: 'left' | 'center' | 'right'; bold?: boolean;
  w?: number; h?: number; lineHeight?: number;
  /** SHRINK：文本在 w×h 框内自动缩字号换行，绝不超框（长描述/双列 Tips 用） */
  shrink?: boolean;
  /** 描边（亮底大图上的说明文字用，如关卡场景图内的波次信息） */
  outline?: string; outlineW?: number;
}

export function label(parent: Node, x: number, y: number, text: string, o: LabelOpts = {}): Node {
  const n = N('lbl', parent, x, y, o.w || 0, o.h || 0);
  const l = n.addComponent(Label);
  l.string = text;
  l.fontSize = o.size || 20;
  l.lineHeight = o.lineHeight || (o.size || 20) * 1.25;
  l.color = C(o.color || '#FFFFFF');
  l.isBold = !!o.bold;
  if (o.shrink && (o.w || 0) > 0 && (o.h || 0) > 0) {
    l.overflow = Label.Overflow.SHRINK;
  }
  if (o.outline) {
    l.enableOutline = true;
    l.outlineColor = C(o.outline);
    l.outlineWidth = o.outlineW ?? 2;
  }
  if (o.align === 'left') l.horizontalAlign = Label.HorizontalAlign.LEFT;
  else if (o.align === 'right') l.horizontalAlign = Label.HorizontalAlign.RIGHT;
  else l.horizontalAlign = Label.HorizontalAlign.CENTER;
  l.verticalAlign = Label.VerticalAlign.CENTER;
  return n;
}

export function setText(n: Node, text: string): void {
  const l = n.getComponent(Label);
  if (l) l.string = text;
}

export function gpanel(parent: Node, x: number, y: number, w: number, h: number,
  fill: FillLike, stroke?: FillLike, strokeW = 2, radius = 12): Node {
  const n = N('panel', parent, x, y, w, h);
  const g = n.addComponent(Graphics);
  g.fillColor = toColor(fill);
  if (stroke) { g.strokeColor = toColor(stroke); g.lineWidth = strokeW; }
  g.roundRect(-w / 2, -h / 2, w, h, radius);
  g.fill();
  if (stroke) g.stroke();
  return n;
}

export function gcircle(parent: Node, x: number, y: number, r: number, fill: FillLike, stroke?: FillLike, lw = 2): Node {
  const n = N('circ', parent, x, y, r * 2, r * 2);
  const g = n.addComponent(Graphics);
  g.fillColor = toColor(fill);
  if (stroke) { g.strokeColor = toColor(stroke); g.lineWidth = lw; }
  g.circle(0, 0, r);
  g.fill();
  if (stroke) g.stroke();
  return n;
}

/** 圆环进度（大招充能/技能CD），set(pct) 重绘 */
export interface Ring { node: Node; set: (pct: number, color?: string) => void; }

export function gring(parent: Node, x: number, y: number, r: number, track: FillLike): Ring {
  const n = N('ring', parent, x, y, r * 2, r * 2);
  const g = n.addComponent(Graphics);
  const trackC = toColor(track);
  const draw = (pct: number, color: FillLike) => {
    g.clear();
    g.lineWidth = 5;
    g.strokeColor = trackC;
    g.circle(0, 0, r);
    g.stroke();
    if (pct > 0.01) {
      g.strokeColor = toColor(color);
      g.arc(0, 0, r, Math.PI / 2, Math.PI / 2 - pct * Math.PI * 2, true);
      g.stroke();
    }
  };
  draw(0, track);
  return { node: n, set: draw };
}

/** 进度条，set(pct) 重绘填充 */
export interface Bar { node: Node; set: (pct: number, color?: string) => void; }

export function gbar(parent: Node, x: number, y: number, w: number, h: number, fill: FillLike): Bar {
  const bg = gpanel(parent, x, y, w, h, CA('#14181E', 0.85), CA('#FFFFFF', 0.33), 1.5, h / 2);
  const fn = N('fill', bg, 0, 0, w, h);
  const g = fn.addComponent(Graphics);
  const base = toColor(fill);
  /* 美术条：轨道垫底 + 白填充染色（金/绿/蓝/红全靠 tint）；加载失败保持程序绘制 */
  let artFillSp: Sprite | null = null;
  let artFillNode: Node | null = null;
  let lastPct = 1;
  const applyArt = (pct: number): void => {
    if (!artFillNode || !artFillSp) return;
    const fw = Math.max(0, Math.min(1, pct)) * (w - 4);
    artFillNode.getComponent(UITransform)!.setContentSize(Math.max(fw, 0.01), h - 4);
    artFillNode.active = fw > 0.5;
  };
  artSprite(bg, 0, 0, w, h, 'ui_bar_track', { belowIdx: 0, onLoaded: () => {
    const bgG = bg.getComponent(Graphics);
    if (bgG) bgG.enabled = false;
  }});
  artSprite(bg, 0, 0, w, h, 'ui_bar_fill_white', { fit: false, onLoaded: n => {
    n.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    n.setPosition(-w / 2 + 2, 0, 0);
    artFillNode = n;
    artFillSp = n.getComponent(Sprite);
    g.enabled = false;
    applyArt(lastPct);
  }});
  const draw = (pct: number, color?: FillLike) => {
    g.clear();
    const fw = Math.max(0, Math.min(1, pct)) * (w - 4);
    if (fw > 0.5) {
      g.fillColor = color ? toColor(color) : base;
      g.roundRect(-w / 2 + 2, -h / 2 + 2, fw, h - 4, (h - 4) / 2);
      g.fill();
    }
    if (artFillSp) {
      artFillSp.color = color ? toColor(color) : base;
      lastPct = pct;
      applyArt(pct);
    }
  };
  draw(1);
  return { node: bg, set: draw };
}

export function btn(parent: Node, x: number, y: number, w: number, h: number, text: string,
  color: FillLike, cb: () => void, size = 22): Node {
  const n = gpanel(parent, x, y, w, h, color, '#FFFFFF66', 2, 14);
  n.name = 'btn_' + text;
  const lbl = label(n, 0, 0, text, { size, color: '#241C12', bold: true, w, h });
  /* 美术按钮三态：金/绿（含按下/禁用帧）；#5A6472 视为禁用态用灰帧；失败保持程序绘制 */
  const isColor = (v: string) => typeof color === 'string' && color === v;
  const style = isColor(PAL.gold) ? 'ui_btn_primary' : isColor(PAL.green) ? 'ui_btn_green'
    : isColor('#5A6472') ? 'ui_btn_primary_disabled' : null;
  if (style) {
    const isDisabled = style.endsWith('_disabled');
    const normalId = style;
    const pressId = style.replace('_disabled', '_press');
    let sp: Sprite | null = null;
    artSprite(n, 0, 0, w, h, normalId, { belowIdx: 0, onLoaded: () => {
      sp = (n.getChildByName('art:' + normalId) as Node | null)?.getComponent(Sprite) || null;
      const l = lbl.getComponent(Label);
      if (l) l.color = C(isDisabled ? '#AAB2BD' : '#FFF3D6');
    }});
    if (!isDisabled) uxFrame(pressId, () => {}); // 预热按下帧，首次按下即换
    n.on(Node.EventType.TOUCH_START, () => { if (sp) artSetFrame(sp, pressId); });
    const restore = () => { if (sp) artSetFrame(sp, normalId); };
    n.on(Node.EventType.TOUCH_CANCEL, restore);
    n.on(Node.EventType.TOUCH_END, restore);
  }
  n.on(Node.EventType.TOUCH_END, (e: unknown) => {
    const ev = e as { propagationStopped?: boolean };
    if (ev && 'propagationStopped' in ev) ev.propagationStopped = true;
    cb();
  });
  return n;
}

/** 左右旋钮开关（线稿④-2）：开=绿轨旋钮居右 / 关=灰轨旋钮居左；disabled 置灰不可点
 *  美术开关 ui_switch_on/off/disabled 三帧切换，加载失败保持程序绘制 */
export function gswitch(parent: Node, x: number, y: number, w: number, h: number, on: boolean,
  onChange?: (v: boolean) => void, disabled = false): Node {
  const n = N('switch', parent, x, y, w, h);
  const g = n.addComponent(Graphics);
  const draw = (v: boolean) => {
    g.clear();
    g.fillColor = disabled ? CA('#3A4250', 0.9) : v ? CA(PAL.green, 0.95) : CA('#5A6472', 0.9);
    g.roundRect(-w / 2, -h / 2, w, h, h / 2);
    g.fill();
    const kx = v ? w / 2 - h / 2 : -w / 2 + h / 2;
    g.fillColor = disabled ? C('#889099') : C('#FFFFFF');
    g.circle(kx, 0, h / 2 - 3);
    g.fill();
  };
  draw(on);
  const artId = () => disabled ? 'ui_switch_disabled' : on ? 'ui_switch_on' : 'ui_switch_off';
  let sp: Sprite | null = null;
  let artOk = false;
  artSprite(n, 0, 0, w, h, artId(), { onLoaded: node => {
    sp = node.getComponent(Sprite);
    artOk = true;
    g.enabled = false;
  }});
  ['ui_switch_on', 'ui_switch_off'].forEach(id => uxFrame(id, () => {})); // 预热
  if (!disabled && onChange) {
    n.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: () => void };
      if (ev && ev.propagationStopped) ev.propagationStopped();
      on = !on;
      if (artOk && sp) artSetFrame(sp, artId());
      else draw(on);
      onChange(on);
    });
  }
  return n;
}

/** 全屏遮罩（吞点击）：覆盖整个可视区（Fit-Width 高度动态），不能用 Widget 对 0 尺寸父级对齐 */
export function dimLayer(parent: Node, alpha = 0.68, red = false): Node {
  const H = LO.half * 2 + 240;
  const n = N('dim', parent, 0, 0, 750, H);
  const g = n.addComponent(Graphics);
  g.fillColor = red ? new Color(80, 10, 12, Math.round(255 * alpha)) : new Color(6, 8, 12, Math.round(255 * alpha));
  g.roundRect(-375, -H / 2, 750, H, 0);
  g.fill();
  n.addComponent(BlockInputEvents);
  return n;
}

export function fadeOut(node: Node, dur: number, done?: () => void): void {
  const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
  tween(op).to(dur, { opacity: 0 }).call(() => { if (done) done(); }).start();
}

export function setLayerDeep(node: Node, layer: number): void {
  node.layer = layer;
  node.children.forEach(ch => setLayerDeep(ch, layer));
}
