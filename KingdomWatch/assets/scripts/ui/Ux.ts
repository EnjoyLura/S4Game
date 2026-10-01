/**
 * Ux —— 美术资源运行时 assetMap（§UX 清单：线稿 ID ↔ assets/resources/ 同名落图 ↔ 零代码换肤）
 * 约定：assets/resources/ux/<id>.png 与 assets/resources/scenes/<id>.png；
 * 加载失败一律回退程序绘制（调用方先画程序版，美术加载成功后覆盖/隐藏）。
 */
import { Graphics, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
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
  if (hit) {
    // 缓存命中也走微任务：同步回调会在 artSprite 返回前触发，回调里引用
    // `this.x = artSprite(...)` 的接收变量还是 undefined（闲时预载后的必现竞态）
    Promise.resolve().then(() => cb(hit));
    return;
  }
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
 * 九宫格参数表：canon=合成基准尺寸（compose_9slice.py 输出）、inset=基准纹理像素边距、scale=基准→设计换算
 * 运行时按实际加载文件尺寸自动换算 insets 与节点缩放 —— 换任何分辨率的同名文件都自适应，
 * 边框始终渲染为设计像素（inset × scale），端头圆弧不再被拉尖。
 * 约束：inset×scale×2 ≤ 该素材最小渲染宽/高。
 */
interface Slice9Def { canon: [number, number]; inset: [number, number, number, number]; scale: number; }
const SLICE9: Record<string, Slice9Def> = {
  ui_panel_dark_gold: { canon: [1436, 140], inset: [31, 31, 8, 8], scale: 0.5 },
  ui_panel_dark_white: { canon: [1436, 140], inset: [31, 31, 8, 8], scale: 0.5 },
  ui_btn_primary: { canon: [600, 176], inset: [48, 48, 16, 16], scale: 0.5 },
  ui_btn_primary_press: { canon: [600, 176], inset: [48, 48, 16, 16], scale: 0.5 },
  ui_btn_primary_disabled: { canon: [600, 176], inset: [48, 48, 16, 16], scale: 0.5 },
  ui_btn_green: { canon: [600, 176], inset: [48, 48, 16, 16], scale: 0.5 },
  ui_btn_green_press: { canon: [600, 176], inset: [48, 48, 16, 16], scale: 0.5 },
  ui_btn_green_disabled: { canon: [600, 176], inset: [48, 48, 16, 16], scale: 0.5 },
  ui_banner_warn: { canon: [1040, 144], inset: [43, 43, 10, 10], scale: 0.5 },
  ui_banner_title: { canon: [1040, 176], inset: [87, 87, 28, 28], scale: 0.5 },
  ui_banner_hazard: { canon: [1180, 200], inset: [65, 65, 24, 24], scale: 0.5 },
  ui_wave_pill: { canon: [300, 120], inset: [60, 60, 19, 19], scale: 0.5 },
  ui_tab_item: { canon: [660, 144], inset: [47, 47, 10, 10], scale: 0.5 },
  ui_tab_item_active: { canon: [660, 144], inset: [47, 47, 10, 10], scale: 0.5 },
  ui_bar_track: { canon: [1280, 44], inset: [22, 22, 4, 4], scale: 0.5 },
  ui_card_frame_white: { canon: [369, 501], inset: [40, 40, 44, 44], scale: 1 },
  ui_card_frame_blue: { canon: [369, 501], inset: [40, 40, 44, 44], scale: 1 },
  ui_card_frame_purple: { canon: [369, 501], inset: [40, 40, 44, 44], scale: 1 },
  ui_card_header_white: { canon: [400, 104], inset: [65, 65, 11, 11], scale: 0.5 },
  ui_card_header_blue: { canon: [400, 104], inset: [65, 65, 11, 11], scale: 0.5 },
  ui_card_header_purple: { canon: [400, 104], inset: [65, 65, 11, 11], scale: 0.5 },
};

/** 按实际文件尺寸换算并写入九宫格 insets（换分辨率文件自适应的关键） */
export function applySlice9(id: string, sf: SpriteFrame): void {
  const c = SLICE9[id];
  if (!c) return;
  sf.insetLeft = Math.max(0, Math.round(c.inset[0] * sf.width / c.canon[0]));
  sf.insetRight = Math.max(0, Math.round(c.inset[1] * sf.width / c.canon[0]));
  sf.insetTop = Math.max(0, Math.round(c.inset[2] * sf.height / c.canon[1]));
  sf.insetBottom = Math.max(0, Math.round(c.inset[3] * sf.height / c.canon[1]));
}

export interface ArtOpts {
  /** true=九宫格拉伸（SLICE9 表内 ID 默认 true） */
  sliced?: boolean;
  /** 非九宫格等比缩放（contain，默认开）：源宽高比≠盒子时按比例适配，杜绝拉伸变形 */
  fit?: boolean;
  /** 等比放大盖满盒子（cover，溢出裁切）：全屏背景防变形用 */
  cover?: boolean;
  /** 渲染序：插到第 idx 个子节点之前（面板类=0：垫在既有文字下，并关闭父节点程序描边） */
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
      const c = SLICE9[id];
      sp.type = Sprite.Type.SLICED;
      applySlice9(id, sf);
      // 文件分辨率 ≠ 基准时按比例缩放节点：边框渲染像素 = inset×scale 恒定（设计像素）
      const sx = c.scale * c.canon[0] / sf.width;
      const sy = c.scale * c.canon[1] / sf.height;
      if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
        n.setScale(sx, sy, 1);
        n.getComponent(UITransform)!.setContentSize(w / sx, h / sy);
      }
    } else if (o.fit !== false || o.cover) {
      // 等比适配：contain 装进盒子 / cover 盖满盒子（源比例失真是"拉伸变形"的主因）
      const r = sf.rect;
      const k = o.cover ? Math.max(w / r.width, h / r.height) : Math.min(w / r.width, h / r.height);
      n.getComponent(UITransform)!.setContentSize(Math.max(r.width * k, 1), Math.max(r.height * k, 1));
    }
    if (o.belowIdx !== undefined) {
      n.setSiblingIndex(Math.min(o.belowIdx, n.parent!.children.length - 1));
      // 美术已盖住程序面板：关掉父节点 Graphics，避免兜底描边从美术边缘露出
      const pg = n.parent ? n.parent.getComponent(Graphics) : null;
      if (pg) pg.enabled = false;
    }
    (o.hideOnLoad || []).forEach(v => { if (v.isValid) v.active = false; });
    if (o.onLoaded) o.onLoaded(n);
  });
  return n;
}

/** 给已有 Sprite 换帧（按钮态/开关态）；失败不动；九宫格 ID 换态帧同步落 insets */
export function artSetFrame(sp: Sprite, id: string): void {
  uxFrame(id, sf => {
    if (!sf || !sp.isValid) return;
    sp.spriteFrame = sf;
    if (SLICE9[id]) applySlice9(id, sf);
  });
}

/** 图标铺满座：A2 图标盖在圆形座上（覆盖程序 emoji 兜底） */
export function artIcon(parent: Node, id: string, w: number, h = w): Node {
  return artSprite(parent, 0, 0, w, h, id, { sliced: false });
}

/* ---------- 闲时预载：弹窗美术不再"当面加载" ---------- */

/** 预载清单 = 代码引用的全部 ux ID + 场景图；新美术落盘后把 ID 加进这里 */
export const UX_PRELOAD_IDS: string[] = [
  // 组件
  'ui_panel_dark_gold', 'ui_panel_dark_white',
  'ui_btn_primary', 'ui_btn_primary_press', 'ui_btn_primary_disabled',
  'ui_btn_green', 'ui_btn_green_press', 'ui_btn_green_disabled',
  'ui_banner_warn', 'ui_banner_title', 'ui_banner_hazard',
  'ui_wave_pill', 'ui_tab_item', 'ui_tab_item_active',
  'ui_bar_track', 'ui_bar_fill_white', 'ui_bar_shield',
  'ui_card_frame_white', 'ui_card_frame_blue', 'ui_card_frame_purple',
  'ui_card_header_white', 'ui_card_header_blue', 'ui_card_header_purple',
  'ui_circ_icon_gold', 'ui_circ_icon_gold_active',
  'ui_circ_icon_blue', 'ui_circ_icon_blue_active',
  'ui_circ_icon_gray', 'ui_circ_icon_gray_active',
  'ui_circ_btn_green', 'ui_star', 'ui_star_gray',
  'ui_badge_new', 'ui_gear_ring',
  'ui_switch_on', 'ui_switch_off', 'ui_switch_disabled',
  // 图标
  'ui_icon_coin', 'ui_icon_exp', 'ui_icon_diamond', 'ui_icon_chest', 'ui_icon_equip',
  'ui_icon_pause', 'ui_icon_stats', 'ui_icon_speed',
  'ui_icon_refresh_ad', 'ui_icon_refresh_diamond',
  'ui_icon_heart', 'ui_icon_skull', 'ui_icon_eye', 'ui_icon_chat', 'icon_alert',
  // 英雄头像
  'ui_avatar_archer', 'ui_avatar_sniper',
  // 场景
  'scenes/scene_1_1',
];

let preloadStarted = false;

/** 闲时逐张预载：每张间隔约一帧串行调度，不与当下渲染争抢；重复调用安全（进程内只跑一次）。
 *  uxFrame 自带缓存与去重——与战斗 HUD 的首屏加载天然合并，不会双份请求 */
export function uxPreloadIdle(delayMs = 0): void {
  if (preloadStarted) return;
  preloadStarted = true;
  let i = 0;
  const step = (): void => {
    if (i >= UX_PRELOAD_IDS.length) return;
    uxFrame(UX_PRELOAD_IDS[i++], () => {});
    setTimeout(step, 16);
  };
  if (delayMs > 0) setTimeout(step, delayMs);
  else step();
}
