/**
 * Ux —— 美术资源运行时 assetMap（§UX 清单：线稿 ID ↔ assets/resources/ 同名落图 ↔ 零代码换肤）
 * 约定：assets/resources/ux/<id>.png 与 assets/resources/scenes/<id>.png；
 * 加载失败一律回退程序绘制（调用方先画程序版，美术加载成功后覆盖/隐藏）。
 */
import { Graphics, isValid, JsonAsset, Mask, Node, Rect, resources, ScrollView, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { N } from './UIKit';
import { trackUIArt, uiArtInView } from './UIArtReady';
import { NEW_HERO_FRAMES } from './NewHeroArt';

/** id → 资源路径：'scenes/x' 原样，其余视为 ux/ 下的清单 ID */
function resPath(id: string): string {
  return (id.startsWith('scenes/') || id.startsWith('fx/') ? id : 'ux/' + id) + '/spriteFrame';
}

const cache = new Map<string, SpriteFrame>();
export type ArtPriority = 'visible' | 'next' | 'idle';
const rank: Record<ArtPriority, number> = { visible: 0, next: 1, idle: 2 };
export function higherArtPriority(a: ArtPriority, b: ArtPriority): ArtPriority { return rank[a] < rank[b] ? a : b; }
interface ArtRequest {
  id: string; priority: ArtPriority; callbacks: ((sf: SpriteFrame | null) => void)[];
  started: boolean; retries: number; retryTimer?: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, ArtRequest>();
const active = new Set<ArtRequest>();
let pumpQueued = false;
let offlineTimer: ReturnType<typeof setTimeout> | undefined;
type ArtNetworkHost = { __KW_NETWORK_FAILURE?: (error: unknown) => boolean; __KW_NETWORK_RECOVERED?: () => void };

function offline(): boolean { return typeof navigator !== 'undefined' && navigator.onLine === false; }
function finishArt(request: ArtRequest, frame: SpriteFrame | null): void {
  if (pending.get(request.id) !== request) return;
  if (request.retryTimer !== undefined) clearTimeout(request.retryTimer);
  active.delete(request); pending.delete(request.id);
  if (frame) cache.set(request.id, frame);
  // Each consumer settles independently, including ones whose page has closed.
  request.callbacks.forEach(callback => { void Promise.resolve().then(() => callback(frame)); });
  if (frame && request.retries && !Array.from(pending.values()).some(item => item.retries)) {
    (globalThis as ArtNetworkHost).__KW_NETWORK_RECOVERED?.();
  }
}

function downloadFailure(error: Error): boolean {
  // Cocos' image/download errors only. Missing asset IDs and programming errors
  // must keep their normal error path instead of being treated as a lost network.
  return /download failed:|load image \(|(?:Error\s*#?\s*4930\b)|failed to fetch|networkerror|load failed/i.test(String(error));
}

/** Four image loads at most. Predictions use two slots; optional large atlases use only one. */
function queuePump(): void {
  if (pumpQueued) return;
  pumpQueued = true;
  Promise.resolve().then(() => {
    pumpQueued = false;
    if (offline()) {
      // Preserve queued consumers through a short disconnection, but keep a
      // permanent outage from retaining closed pages and their listeners forever.
      if (offlineTimer === undefined) offlineTimer = setTimeout(() => {
        offlineTimer = undefined;
        if (offline()) pending.forEach(request => { if (!active.has(request)) finishArt(request, null); });
      }, 30000);
      return;
    }
    while (active.size < 4) {
      let next: ArtRequest | undefined;
      pending.forEach(request => {
        if (!request.started && (!next || rank[request.priority] < rank[next.priority])) next = request;
      });
      if (!next) return;
      if (next.priority !== 'visible') {
        if (typeof document !== 'undefined' && document.hidden) return;
        const running = Array.from(active), foreground = running.filter(request => request.priority === 'visible').length;
        if (next.priority === 'idle' ? active.size >= 1
          : running.length - foreground >= (foreground ? 1 : 2)) return;
      }
      const request = next; request.started = true; active.add(request);
      resources.load(resPath(request.id), SpriteFrame, (error, frame) => {
        active.delete(request);
        if (error && downloadFailure(error) && request.retries < 2) {
          (globalThis as ArtNetworkHost).__KW_NETWORK_FAILURE?.(error);
          request.retries++;
          request.retryTimer = setTimeout(() => {
            request.retryTimer = undefined; request.started = false; queuePump();
          }, 1000 * request.retries);
        } else finishArt(request, !error && frame ? frame : null);
        queuePump();
      });
    }
  });
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', queuePump);
if (typeof window !== 'undefined') window.addEventListener('online', () => {
  if (offlineTimer !== undefined) { clearTimeout(offlineTimer); offlineTimer = undefined; }
  pending.forEach(request => {
    if (request.retryTimer !== undefined) {
      clearTimeout(request.retryTimer); request.retryTimer = undefined; request.started = false;
    }
  });
  queuePump();
});

/** Promote a queued prediction when it becomes visible; never issue a duplicate download. */
export function promoteUXArt(id: string, priority: ArtPriority = 'visible'): void {
  const alias = NEW_HERO_FRAMES[id];
  if (alias) { promoteUXArt(alias.source, priority); return; }
  const request = pending.get(id);
  if (request && rank[priority] < rank[request.priority]) { request.priority = priority; queuePump(); }
}

export function warmUXArt(ids: readonly string[], priority: ArtPriority = 'next'): Promise<void> {
  return Promise.all(Array.from(new Set(ids)).filter(Boolean).map(id =>
    new Promise<void>(resolve => uxFrame(id, () => resolve(), priority)))).then(() => {});
}

/** Distant large art downloads without creating Texture2D/GPU resources. */
const prefetched = new Set<string>();
const prefetching = new Map<string, (() => void)[]>();
let prefetchActive = false, prefetchTimer: ReturnType<typeof setTimeout> | undefined;
function pumpPrefetch(): void {
  if (prefetchActive || prefetchTimer !== undefined || !prefetching.size) return;
  if (offline() || (typeof document !== 'undefined' && document.hidden) || active.size || pending.size) {
    prefetchTimer = setTimeout(() => { prefetchTimer = undefined; pumpPrefetch(); }, 250); return;
  }
  const id = prefetching.keys().next().value as string;
  prefetchActive = true;
  const complete = (error: Error | null): void => {
    if (!error) prefetched.add(id);
    const callbacks = prefetching.get(id) || []; prefetching.delete(id);
    prefetchActive = false; callbacks.forEach(done => done()); pumpPrefetch();
  };
  if (id.endsWith('.frames')) resources.preload(id.startsWith('fx/') ? id : 'ux/' + id, JsonAsset, complete);
  else resources.preload(resPath(id), SpriteFrame, complete);
}
export function prefetchUXArt(ids: readonly string[]): Promise<void> {
  return Promise.all(Array.from(new Set(ids.filter(Boolean).map(id => NEW_HERO_FRAMES[id]?.source || id))).map(id => {
    if (prefetched.has(id) || cache.has(id)) return Promise.resolve();
    return new Promise<void>(resolve => {
      const prior = prefetching.get(id);
      if (prior) prior.push(resolve); else prefetching.set(id, [resolve]);
      pumpPrefetch();
    });
  })).then(() => {});
}

/** 异步取 SpriteFrame（带缓存与去重）；失败回调 null，调用方保持程序绘制 */
export function uxFrame(id: string, cb: (sf: SpriteFrame | null) => void, priority: ArtPriority = 'visible'): void {
  const alias = NEW_HERO_FRAMES[id];
  if (alias && !cache.has(id)) {
    uxFrame(alias.source, source => {
      if (!source) { cb(null); return; }
      const hit = cache.get(id);
      if (hit) { cb(hit); return; }
      source.packable = false;
      const [x, y, w, h] = alias.rect;
      if (x + w > source.rect.width || y + h > source.rect.height) { cb(null); return; }
      const frame = new SpriteFrame();
      frame.reset({ texture: source.texture, rect: new Rect(source.rect.x + x, source.rect.y + y, w, h),
        originalSize: new Size(w, h), offset: new Vec2() });
      frame.packable = false; cache.set(id, frame); cb(frame);
    }, priority);
    return;
  }
  const hit = cache.get(id);
  if (hit) {
    // 缓存命中也走微任务：同步回调会在 artSprite 返回前触发，回调里引用
    // `this.x = artSprite(...)` 的接收变量还是 undefined（闲时预载后的必现竞态）
    Promise.resolve().then(() => cb(hit));
    return;
  }
  const q = pending.get(id);
  if (q) { q.callbacks.push(cb); promoteUXArt(id, priority); return; }
  pending.set(id, { id, priority, callbacks: [cb], started: false, retries: 0 });
  queuePump();
}

/** Masked scroll content can warm in the background without delaying page handoff. */
function watchArtVisibility(node: Node, id: string): () => void {
  const scrolls: Node[] = [];
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.getComponent(ScrollView)) scrolls.push(parent);
  let watching = true;
  const promote = (): void => { if (watching && isValid(node, true) && uiArtInView(node, 160)) promoteUXArt(id); };
  const cleanup = (destroyed = false): void => {
    // Destruction and a late image callback can both arrive. Cocos clears a
    // destroyed node's event processor, so never detach from it a second time.
    if (!watching) return;
    watching = false;
    scrolls.forEach(scroll => { if (isValid(scroll, true)) scroll.off('scrolling', promote); });
    scrolls.length = 0;
    if (!destroyed && isValid(node, true)) node.off(Node.EventType.NODE_DESTROYED, onDestroyed);
  };
  const onDestroyed = (): void => cleanup(true);
  scrolls.forEach(scroll => scroll.on('scrolling', promote));
  node.once(Node.EventType.NODE_DESTROYED, onDestroyed);
  // The page restores its remembered scroll position after constructing its children.
  Promise.resolve().then(promote);
  return () => cleanup();
}

/**
 * 九宫格参数表：canon=合成基准尺寸（compose_9slice.py 输出）、inset=基准纹理像素边距、scale=基准→设计换算
 * 运行时按实际加载文件尺寸自动换算 insets 与节点缩放 —— 换任何分辨率的同名文件都自适应，
 * 边框始终渲染为设计像素（inset × scale），端头圆弧不再被拉尖。
 * 约束：inset×scale×2 ≤ 该素材最小渲染宽/高。
 */
interface Slice9Def { canon: [number, number]; inset: [number, number, number, number]; scale: number; }
const SLICE9: Record<string, Slice9Def> = {
  'pick_comic_v1/card_base': { canon: [883, 1477], inset: [140, 140, 80, 180], scale: .25 },
  'pick_comic_v1/title_plate': { canon: [1940, 247], inset: [240, 240, 80, 80], scale: .25 },
  'pick_comic_v1/header_strip': { canon: [2093, 312], inset: [220, 220, 98, 60], scale: 1 / 6 },
  'settlement_comic_v1/panel_win': { canon: [597, 264], inset: [70, 70, 58, 58], scale: .4 },
  'settlement_comic_v1/panel_lose': { canon: [597, 263], inset: [70, 70, 58, 58], scale: .4 },
  'settlement_comic_v1/card_win': { canon: [507, 134], inset: [50, 50, 32, 32], scale: .5 },
  'settlement_comic_v1/card_lose': { canon: [508, 134], inset: [50, 50, 32, 32], scale: .5 },
  'settlement_comic_v1/button_teal': { canon: [582, 130], inset: [48, 48, 28, 28], scale: .5 },
  'settlement_comic_v1/button_muted': { canon: [582, 130], inset: [48, 48, 28, 28], scale: .5 },
  'pause_comic_v1/title_ribbon': { canon: [1014, 150], inset: [140, 140, 48, 48], scale: .45 },
  'pause_comic_v1/button_gold': { canon: [572, 178], inset: [60, 60, 40, 40], scale: .5 },
  'pause_comic_v1/button_green': { canon: [571, 175], inset: [60, 60, 40, 40], scale: .5 },
  'pause_comic_v1/button_muted': { canon: [384, 122], inset: [44, 44, 28, 28], scale: .5 },
  'pause_comic_v1/tab_neutral': { canon: [1178, 121], inset: [70, 70, 24, 24], scale: 58 / 121 },
  'pause_comic_v1/tab_gold': { canon: [1180, 124], inset: [70, 70, 24, 24], scale: 58 / 124 },
  'pause_comic_v1/settings_row': { canon: [1172, 120], inset: [60, 60, 24, 24], scale: .5 },
  'battle_skin_v2/banner_title': { canon: [1040, 176], inset: [28, 28, 28, 28], scale: .5 },
  'battle_skin_v2/banner_fail': { canon: [1180, 200], inset: [28, 28, 28, 28], scale: .5 },
  'battle_skin_v2/card_base': { canon: [446, 720], inset: [24, 24, 24, 24], scale: .5 },
  'battle_skin_v2/button_green': { canon: [600, 176], inset: [28, 28, 28, 28], scale: .5 },
  'battle_skin_v2/button_gold': { canon: [600, 176], inset: [28, 28, 28, 28], scale: .5 },
  'battle_skin_v2/button_muted': { canon: [600, 176], inset: [28, 28, 28, 28], scale: .5 },
  'battle_skin_v2/tab_l': { canon: [520, 116], inset: [28, 2, 28, 28], scale: .5 },
  'battle_skin_v2/tab_m': { canon: [520, 116], inset: [2, 2, 28, 28], scale: .5 },
  'battle_skin_v2/tab_r': { canon: [520, 116], inset: [2, 28, 28, 28], scale: .5 },
  'battle_skin_v2/bar_track': { canon: [450, 32], inset: [16, 16, 4, 4], scale: .5 },
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
  /* 三选一卡背板（撕边羊皮纸，生图 2×2 图集左下变体）：九宫格保撕边与折角，中段拉伸纸纹 */
  ui_card_plate_base: { canon: [446, 669], inset: [40, 40, 40, 40], scale: 0.5 },
  /* 通用弹窗三件套（生图 Kingdom Rush 风）：九宫格保撕边/折角/雕刻边，中段拉伸 */
  ui_panel_dialog: { canon: [962, 511], inset: [40, 40, 36, 36], scale: 0.5 },
  ui_banner_notice: { canon: [1810, 363], inset: [580, 580, 45, 60], scale: 0.22 },
  /* 平漆面+深轮廓（用户选定方向）：无凸框，仅细轮廓+顶光带+底唇 */
  ui_btn_confirm: { canon: [633, 261], inset: [62, 62, 62, 38], scale: 0.24 },
  ui_btn_cancel: { canon: [633, 260], inset: [62, 62, 62, 38], scale: 0.24 },
  ui_btn_exit: { canon: [632, 260], inset: [62, 62, 62, 38], scale: 0.24 },
  ui_btn_close: { canon: [600, 600], inset: [100, 100, 100, 48], scale: 0.088 },
  ui_tab_l: { canon: [543, 349], inset: [112, 20, 62, 42], scale: 0.166 },
  ui_tab_m: { canon: [535, 349], inset: [20, 20, 62, 42], scale: 0.166 },
  ui_tab_r: { canon: [543, 349], inset: [20, 112, 62, 42], scale: 0.166 },
  /* 主城一级背板（PageKit.artPanel）：程序暗板打底，同名美术落图后自动九宫格覆盖 */
  ui_panel_tabs: { canon: [1436, 140], inset: [31, 31, 8, 8], scale: 0.5 },
  ui_panel_bag: { canon: [1436, 140], inset: [31, 31, 8, 8], scale: 0.5 },
  ui_panel_zone: { canon: [1436, 140], inset: [31, 31, 8, 8], scale: 0.5 },
  ui_panel_hero: { canon: [1436, 140], inset: [31, 31, 8, 8], scale: 0.5 },  // 英雄页上半区全宽大背板
  /* 商店三件（浅蓝灰底板/金色锯齿卡/羊皮标题横幅）+ 购买钮 */
  ui_panel_shop: { canon: [1500, 2148], inset: [114, 114, 57, 57], scale: 0.5 },
  ui_card_shop: { canon: [660, 600], inset: [51, 51, 25, 25], scale: 0.5 },
  ui_btn_buy: { canon: [480, 108], inset: [35, 35, 21, 21], scale: 0.5 },
  ui_banner_shop: { canon: [1040, 176], inset: [45, 45, 38, 32], scale: 0.5 },
};

/** 按实际文件尺寸换算并写入九宫格 insets（换分辨率文件自适应的关键）
 *  必须用 sf.rect：纹理被动态合图打包进图集后 width/height 漂移成图集尺寸（2048），
 *  rect 恒为源图区域 —— 用 width 重算会把 insets/节点缩放全部算炸（重渲染后边框消失的元凶） */
export function applySlice9(id: string, sf: SpriteFrame): void {
  const c = SLICE9[id];
  if (!c) return;
  sf.insetLeft = Math.max(0, Math.round(c.inset[0] * sf.rect.width / c.canon[0]));
  sf.insetRight = Math.max(0, Math.round(c.inset[1] * sf.rect.width / c.canon[0]));
  sf.insetTop = Math.max(0, Math.round(c.inset[2] * sf.rect.height / c.canon[1]));
  sf.insetBottom = Math.max(0, Math.round(c.inset[3] * sf.rect.height / c.canon[1]));
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
  onFailed?: () => void;
}

/** 创建美术 Sprite 节点：立即可用（加载完成前透明），失败则保持透明、由程序绘制兜底 */
export function artSprite(parent: Node, x: number, y: number, w: number, h: number,
  id: string, o: ArtOpts = {}): Node {
  /* cover 用独立裁剪壳包住溢出（Mask 只作用于自己的子树，不牵连面板兄弟节点） */
  let host: Node = parent;
  let clip: Node | null = null;
  if (o.cover) {
    clip = N('artClip:' + id, parent, x, y, w, h);
    clip.addComponent(Mask);
    host = clip;
    x = 0; y = 0;
  }
  const n = N('art:' + id, host, x, y, w, h);
  const sp = n.addComponent(Sprite);
  sp.sizeMode = Sprite.SizeMode.CUSTOM;
  sp.trim = false;
  const artReady = trackUIArt(n);
  const unwatch = watchArtVisibility(n, id);
  uxFrame(id, sf => {
    try {
      if (!isValid(n, true)) return;
      if (!sf) { o.onFailed?.(); return; }
      sp.spriteFrame = sf;
      if (SLICE9[id]) {
        const c = SLICE9[id];
        sp.type = Sprite.Type.SLICED;
        applySlice9(id, sf);
        // 文件分辨率 ≠ 基准时按比例缩放节点：边框渲染像素 = inset×scale 恒定（设计像素）
        // 用 rect（源图区域）而非 width/height —— 动态合图打包后后者漂移成图集尺寸
        const sx = c.scale * c.canon[0] / sf.rect.width;
        const sy = c.scale * c.canon[1] / sf.rect.height;
        if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
          n.setScale(sx, sy, 1);
          n.getComponent(UITransform)!.setContentSize(w / sx, h / sy);
        }
      } else if (o.fit !== false || o.cover) {
        // 等比适配：contain 装进盒子 / cover 盖满盒子并裁掉溢出（源比例失真是"拉伸变形"的主因）
        const r = sf.rect;
        const k = o.cover ? Math.max(w / r.width, h / r.height) : Math.min(w / r.width, h / r.height);
        n.getComponent(UITransform)!.setContentSize(Math.max(r.width * k, 1), Math.max(r.height * k, 1));
      }
      if (o.belowIdx !== undefined) {
        (clip || n).setSiblingIndex(Math.min(o.belowIdx, (clip || n).parent!.children.length - 1));
        // 美术已盖住程序面板：关掉父节点 Graphics，避免兜底描边从美术边缘露出
        const pg = parent.getComponent(Graphics);
        if (pg) pg.enabled = false;
      }
      (o.hideOnLoad || []).forEach(v => { if (v.isValid) v.active = false; });
      if (o.onLoaded) o.onLoaded(n);
    } finally { unwatch(); artReady(); }
  }, uiArtInView(n, 160) ? 'visible' : 'idle');
  return n;
}

/** 给已有 Sprite 换帧（按钮态/开关态）；失败不动；九宫格 ID 换态帧同步落 insets */
export function artSetFrame(sp: Sprite, id: string): void {
  uxFrame(id, sf => {
    if (!sf || !isValid(sp, true)) return;
    sp.spriteFrame = sf;
    if (SLICE9[id]) applySlice9(id, sf);
  });
}

/** 图标铺满座：A2 图标盖在圆形座上（覆盖程序 emoji 兜底） */
export function artIcon(parent: Node, id: string, w: number, h = w): Node {
  return artSprite(parent, 0, 0, w, h, id, { sliced: false });
}

interface LobbyAtlasManifest { frames: Record<string, [number, number, number, number]>; }
type LobbyAtlas = Map<string, SpriteFrame>;
const lobbyAtlases = new Map<string, LobbyAtlas>();
const lobbyAtlasPending = new Map<string, ((atlas: LobbyAtlas | null) => void)[]>();

/** UI atlases retain their source pixels; the manifest supplies isolated sprite rectangles. */
function lobbyAtlas(id: string, cb: (atlas: LobbyAtlas | null) => void): void {
  const cached = lobbyAtlases.get(id);
  if (cached) { Promise.resolve().then(() => cb(cached)); return; }
  const waiting = lobbyAtlasPending.get(id);
  if (waiting) { waiting.push(cb); return; }
  lobbyAtlasPending.set(id, [cb]);
  const finish = (atlas: LobbyAtlas | null): void => {
    if (atlas) lobbyAtlases.set(id, atlas);
    const callbacks = lobbyAtlasPending.get(id) || [];
    lobbyAtlasPending.delete(id);
    callbacks.forEach(f => f(atlas));
  };
  resources.load('ux/' + id + '.frames', JsonAsset, (err, asset) => {
    if (err || !asset) { finish(null); return; }
    uxFrame(id, source => {
      if (!source) { finish(null); return; }
      const frames: LobbyAtlas = new Map();
      const manifest = asset.json as LobbyAtlasManifest;
      for (const key of Object.keys(manifest.frames)) {
        const [x, y, w, h] = manifest.frames[key];
        const frame = new SpriteFrame();
        frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
        frame.packable = false;
        frames.set(key, frame);
      }
      finish(frames);
    });
  });
}

/** Centered or foot-anchored lobby art, with the same loading behavior as artSprite. */
export function artAtlasSprite(parent: Node, x: number, y: number, w: number, h: number,
  id: string, key: string, opts: ArtOpts & { anchorBottom?: boolean; sliceBorder?: number; sliceScale?: number } = {}): Node {
  const node = N('atlas:' + id + ':' + key, parent, x, y, w, h);
  const transform = node.getComponent(UITransform)!;
  if (opts.anchorBottom) transform.setAnchorPoint(0.5, 0);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.trim = false;
  const artReady = trackUIArt(node);
  lobbyAtlas(id, atlas => {
    try {
      const frame = atlas?.get(key);
      if (!frame || !isValid(node, true)) return;
      sprite.spriteFrame = frame;
      if (opts.sliceBorder) {
        const border = Math.min(0.45, Math.max(0.01, opts.sliceBorder));
        frame.insetLeft = frame.insetRight = Math.round(frame.rect.width * border);
        frame.insetTop = frame.insetBottom = Math.round(frame.rect.height * border);
        sprite.type = Sprite.Type.SLICED;
        const scale = opts.sliceScale ?? 1;
        node.setScale(scale, scale, 1);
        transform.setContentSize(w / scale, h / scale);
      } else if (opts.fit !== false) {
        const scale = Math.min(w / frame.rect.width, h / frame.rect.height);
        transform.setContentSize(frame.rect.width * scale, frame.rect.height * scale);
      }
      (opts.hideOnLoad || []).forEach(fallback => { if (fallback.isValid) fallback.active = false; });
      opts.onLoaded?.(node);
    } finally { artReady(); }
  });
  return node;
}

/* ---------- 闲时预载：弹窗美术不再"当面加载" ---------- */

/** Small shared set only. Pages, hero atlases and picker cards have their own targeted loaders. */
export const UX_PRELOAD_IDS: string[] = [
  'shop_comic_v1/comic_coin_v1',
  'shop_comic_v1/comic_diamond_v1',
  'shop_comic_v1/comic_helm_falcon_v1',
  'shop_comic_v1/comic_nav_shop_v1',
  'shop_comic_v1/comic_nav_map_v1',
  'shop_comic_v1/comic_nav_castle_v1',
  'upgrade_comic_v1/comic_training_hammer_v1',
  'pick_comic_v1/card_base', 'pick_comic_v1/title_plate',
  'pause_comic_v1/title_ribbon',
  'settlement_comic_v1/badge_win', 'settlement_comic_v1/badge_lose',
];

let preloadStarted = false;

/** Actually serialize background downloads; the former 16ms dispatch flooded the downloader.
 * Visible art always gets to settle before another optional image is requested. */
export function uxPreloadIdle(delayMs = 0): void {
  if (preloadStarted) return;
  preloadStarted = true;
  let i = 0;
  const step = (): void => {
    if (i >= UX_PRELOAD_IDS.length) return;
    if ((typeof document !== 'undefined' && document.hidden) || pending.size) {
      setTimeout(step, 250); return;
    }
    uxFrame(UX_PRELOAD_IDS[i++], () => { setTimeout(step, 150); }, 'idle');
  };
  if (delayMs > 0) setTimeout(step, delayMs);
  else step();
}
