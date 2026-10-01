/**
 * Ux —— 美术资源运行时 assetMap（§UX 清单：线稿 ID ↔ assets/resources/ 同名落图 ↔ 零代码换肤）
 * 约定：assets/resources/ux/<id>.png 与 assets/resources/scenes/<id>.png；
 * 加载失败一律回退程序绘制（调用方先画程序版，美术加载成功后覆盖/隐藏）。
 */
import { Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import { N } from './UIKit';

/** id → 资源路径：'scenes/x' 原样，其余视为 ux/ 下的清单 ID */
function resPath(id: string): string {
  return (id.startsWith('scenes/') ? id : 'ux/' + id) + '/spriteFrame';
}

const cache = new Map<string, SpriteFrame>();
const pending = new Map<string, ((sf: SpriteFrame | null) => void)[]>();

/** 异步取 SpriteFrame（带缓存与去重）；失败回调 null，调用方保持程序绘制 */
export function uxFrame(id: string, cb: (sf: SpriteFrame | null) => void): void {
  const hit = cache.get(id);
  if (hit) { cb(hit); return; }
  const q = pending.get(id);
  if (q) { q.push(cb); return; }
  pending.set(id, [cb]);
  resources.load(resPath(id), SpriteFrame, (err, sf) => {
    const cbs = pending.get(id) || [];
    pending.delete(id);
    if (err || !sf) { cbs.forEach(f => f(null)); return; }
    cache.set(id, sf);
    cbs.forEach(f => f(sf));
  });
}

/**
 * 九宫格内边距（源纹理像素；Cocos SLICED 边框按纹理像素 1:1 渲染）
 * 取值约束：t+b ≤ 最小使用高度、l+r ≤ 最小使用宽度（如按钮最小 100×44 → 边 18），
 * 否则小尺寸下九宫格崩坏。切片源约为设计稿的 1.3~2.9 倍，边值偏小是刻意的。
 */
const SLICE9: Record<string, [number, number, number, number]> = {
  ui_panel_dark_gold: [24, 24, 24, 24],
  ui_panel_dark_white: [24, 24, 24, 24],
  ui_btn_primary: [18, 18, 18, 18],
  ui_btn_primary_press: [18, 18, 18, 18],
  ui_btn_primary_disabled: [18, 18, 18, 18],
  ui_btn_green: [18, 18, 18, 18],
  ui_btn_green_press: [18, 18, 18, 18],
  ui_btn_green_disabled: [18, 18, 18, 18],
  ui_banner_warn: [30, 30, 30, 30],
  ui_banner_title: [100, 100, 40, 40],
  ui_banner_hazard: [44, 44, 44, 44],
  ui_wave_pill: [26, 26, 26, 26],
  ui_tab_item: [30, 30, 30, 30],
  ui_tab_item_active: [30, 30, 30, 30],
  ui_bar_track: [40, 40, 5, 5],
  ui_bar_fill: [40, 40, 5, 5],
  ui_bar_fill_white: [40, 40, 5, 5],
  ui_bar_shield: [40, 40, 5, 5],
  ui_card_frame_white: [40, 40, 44, 44],
  ui_card_frame_blue: [40, 40, 44, 44],
  ui_card_frame_purple: [40, 40, 44, 44],
  ui_card_header_white: [40, 40, 22, 22],
  ui_card_header_blue: [40, 40, 22, 22],
  ui_card_header_purple: [40, 40, 22, 22],
};

export interface ArtOpts {
  /** true=九宫格拉伸（SLICE9 表内 ID 默认 true） */
  sliced?: boolean;
  /** 渲染序：插到第 idx 个子节点之前（面板类=0：垫在既有文字下） */
  belowIdx?: number;
  /** 加载成功后要隐藏的程序绘制节点（整替类：星星/角标/图标钮） */
  hideOnLoad?: Node[];
  /** 加载成功回调（例：切换水位半径） */
  onLoaded?: (n: Node) => void;
}

/** 创建美术 Sprite 节点：立即可用（加载完成前透明），失败则保持透明、由程序绘制兜底 */
export function artSprite(parent: Node, x: number, y: number, w: number, h: number,
  id: string, o: ArtOpts = {}): Node {
  const n = N('art:' + id, parent, x, y, w, h);
  const sp = n.addComponent(Sprite);
  sp.sizeMode = Sprite.SizeMode.CUSTOM;
  sp.trim = false;
  uxFrame(id, sf => {
    if (!sf || !n.isValid) return;
    sp.spriteFrame = sf;
    if (o.sliced !== false && SLICE9[id]) {
      sp.type = Sprite.Type.SLICED;
      sf.insetLeft = SLICE9[id][0];
      sf.insetRight = SLICE9[id][1];
      sf.insetTop = SLICE9[id][2];
      sf.insetBottom = SLICE9[id][3];
    }
    if (o.belowIdx !== undefined) n.setSiblingIndex(Math.min(o.belowIdx, n.parent!.children.length - 1));
    (o.hideOnLoad || []).forEach(v => { if (v.isValid) v.active = false; });
    if (o.onLoaded) o.onLoaded(n);
  });
  return n;
}

/** 给已有 Sprite 换帧（按钮态/开关态）；失败不动 */
export function artSetFrame(sp: Sprite, id: string): void {
  uxFrame(id, sf => { if (sf && sp.isValid) sp.spriteFrame = sf; });
}

/** 图标铺满座：A2 图标盖在圆形座上（覆盖程序 emoji 兜底） */
export function artIcon(parent: Node, id: string, w: number, h = w): Node {
  return artSprite(parent, 0, 0, w, h, id, { sliced: false });
}
