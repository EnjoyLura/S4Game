/** 商店：满幅商店场景 → 图标分类页签 → 羊皮货架与三列商品卡。 */
import { Graphics, Node, Rect, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { LO } from '../../config/GameConfig';
import { CA, gpanel, N, WY } from '../UIKit';
import { artSprite, uxFrame } from '../Ux';
import { mainLabel, PageCtx, confirmModal, fmt, toast, MAIN_NAV_H, MAIN_RESOURCE_H, mainResourceTop, pageScroll } from '../PageKit';
import { EQUIPS, SHOP, SHOP_TABS, ShopDef, ShopTab, lvReached, shopBuy } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';

const INK = '#482D15';
const CARD_W = 218, CARD_H = 300, STEP_X = 234, STEP_Y = 318;
const TAB_ICONS = ['ui_item_wpn_bow', 'ui_avatar_archer', 'ui_icon_equip', 'ui_item_mat_stone'];
const CATEGORY_TITLES = ['远征武器', '英雄招募', '冒险装备', '强化材料'];
const KIND_ICON: Record<string, string> = { weapon: '🏹', hero: '🦸', equip: '🛡️', mat: '🧱' };
const ITEM_ART: Record<string, string> = {
  wpn_bow: 'ui_item_wpn_bow', wpn_crossbow: 'ui_item_wpn_crossbow',
  helm_falcon: 'ui_item_helm_falcon', acc_moon: 'ui_item_acc_moon',
  glove_wind: 'ui_item_glove_wind', armor_forest: 'ui_item_armor_forest',
  mat_stone: 'ui_item_mat_stone', mat_iron: 'ui_item_mat_iron',
  mat_dust: 'ui_item_mat_dust', mat_rune: 'ui_item_mat_rune',
};
const itemArt = (g: ShopDef): string =>
  g.give.kind === 'hero' && g.give.id ? 'ui_avatar_' + g.give.id : ITEM_ART[g.give.id] || '';

// Purchases retain the chosen category.
const st: { tab: ShopTab } = { tab: 'weapon' };

export function buildShop(ctx: PageCtx): void {
  const root = ctx.screens;
  const screenH = LO.half * 2 - LO.safeTop - LO.safeBottom;
  const splashH = Math.min(430, screenH * 0.27);
  const tabTop = splashH - 8;
  const goodsTop = tabTop + 94;
  const goodsBottom = screenH - MAIN_NAV_H;

  buildShopSplash(root, splashH);
  const content = N('shopCatalog', root);
  render();

  function render(): void {
    content.destroyAllChildren();
    const selected = SHOP_TABS.findIndex(t => t.key === st.tab);
    buildShopTabs(content, tabTop, selected, index => { st.tab = SHOP_TABS[index].key; render(); });

    // The shelf joins the tabs and reaches the navigation, rather than floating on the scene.
    const shelfH = goodsBottom - goodsTop;
    gpanel(content, 0, WY(goodsTop + 6, shelfH - 6), 730, shelfH - 6, '#BDA37A', undefined, 0, 22);
    gpanel(content, 0, WY(goodsTop, shelfH), 730, shelfH, '#F2E6CB', undefined, 0, 22);

    const items = SHOP.filter(s => s.tab === st.tab);
    const rows = Math.ceil(items.length / 3);
    const viewTop = goodsTop + 14;
    const contentH = 66 + rows * STEP_Y + 12;
    const shelf = pageScroll(content, 'shopShelf', viewTop, goodsBottom - 12, contentH, 706);

    // A category strip belongs to the merchandise panel, like a shelf label in the references.
    const ribbon = gpanel(shelf, 0, -23, 686, 46, '#8B643B', undefined, 0, 9);
    ribbon.name = 'shopCategory';
    artSprite(ribbon, -311, 0, 30, 30, TAB_ICONS[selected], { sliced: false });
    mainLabel(ribbon, -113, 0, CATEGORY_TITLES[selected], { size: 25, color: '#FFF1D0', bold: true, align: 'left', w: 340, h: 36 });
    items.forEach((g, i) => {
      drawCard(shelf, ctx, g, (i % 3 - 1) * STEP_X, -(66 + Math.floor(i / 3) * STEP_Y + CARD_H / 2));
    });
  }
}

/** Crop the existing shop illustration to its lit shelves; keep the shared source frame intact. */
function buildShopSplash(parent: Node, height: number): void {
  const scene = gpanel(parent, 0, WY(0, height), 750, height, '#3E2718', undefined, 0, 0);
  scene.name = 'shopSplash';
  const image = N('shopSceneArt', scene, 0, 0, 750, height);
  const sprite = image.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.trim = false;
  uxFrame('scenes/bg_shop', source => {
    if (!source || !image.isValid) return;
    const r = source.rect;
    const h = Math.min(r.height, r.width * height / 750);
    const w = Math.min(r.width, h * 750 / height);
    const frame = new SpriteFrame();
    frame.reset({ texture: source.texture, rect: new Rect(r.x + (r.width - w) / 2, r.y + Math.min(r.height * 0.10, r.height - h), w, h),
      originalSize: new Size(w, h), offset: new Vec2() });
    frame.packable = false;
    sprite.spriteFrame = frame;
    image.getComponent(UITransform)!.setContentSize(750, height);
    image.once(Node.EventType.NODE_DESTROYED, () => frame.destroy());
  });

  // Gentle shade behind the floating currencies and at the counter edge.
  const shade = N('shopSceneShade', scene).addComponent(Graphics);
  for (let i = 0; i < 16; i++) {
    shade.fillColor = CA('#1F130C', 0.44 * (1 - i / 16));
    shade.rect(-375, height / 2 - (i + 1) * 9, 750, 9.5); shade.fill();
    shade.fillColor = CA('#28190F', 0.50 * (1 - i / 16));
    shade.rect(-375, -height / 2 + i * 6, 750, 6.5); shade.fill();
  }
  const signTop = mainResourceTop() + MAIN_RESOURCE_H + 24;
  const sign = N('shopSign', scene, 0, height / 2 - signTop - 42, 300, 84);   // 标题横幅居中（用户调整）
  artSprite(sign, 0, 0, 300, 84, 'ui_banner_shop');
  mainLabel(sign, 0, 2, '商 店', { size: 45, font: 'title', color: '#4A2B12', align: 'center', w: 250, h: 60, outline: '#FFE5A3', outlineW: 1.2 });
  // Two shallow timber strips form the bottom of the storefront illustration.
  gpanel(scene, 0, -height / 2 + 7, 750, 14, '#412714', undefined, 0, 0);
  gpanel(scene, 0, -height / 2 + 13, 750, 3, '#B8874C', undefined, 0, 0);
}

/** Raised game tabs: icon beside label, bright gold selection seated against the merchandise. */
function buildShopTabs(parent: Node, top: number, selected: number, select: (index: number) => void): void {
  const bar = gpanel(parent, 0, WY(top, 108), 750, 108, '#412B1D', undefined, 0, 0);
  bar.name = 'shopTabs';
  SHOP_TABS.forEach((tab, i) => {
    const active = i === selected;
    const h = active ? 94 : 84;
    const cy = active ? 4 : -1;
    const x = (i - 1.5) * 178;
    const slot = gpanel(bar, x, cy - 4, 174, h, '#2D1D14', undefined, 0, 16);
    const face = gpanel(slot, 0, 4, 174, h, active ? '#FFC952' : '#705039', undefined, 0, 16);
    if (active) gpanel(face, 0, h / 2 - 5, 148, 3, '#FFEBA4', undefined, 0, 1);
    artSprite(face, -47, 0, 40, 40, TAB_ICONS[i], { sliced: false });
    mainLabel(face, 22, 0, tab.name, { size: 25, color: active ? '#4A2B12' : '#F2DFC1', bold: true,
      align: 'left', w: 78, h: 34, outline: active ? undefined : '#402715', outlineW: 1 });
    slot.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: boolean };
      if (ev) ev.propagationStopped = true;
      select(i);
    });
  });
}

function drawCard(parent: Node, ctx: PageCtx, g: ShopDef, x: number, y: number): void {
  const sv = loadSave();
  const unlocked = lvReached(g.unlock);
  const owned = g.give.kind === 'hero' && g.give.id ? !!sv.heroes[g.give.id]?.owned : false;
  const shown = unlocked || owned;
  const q = g.give.kind === 'equip' ? EQUIPS[g.give.id]?.quality ?? 0 : g.give.kind === 'hero' ? 3 : 1;
  gpanel(parent, x, y - 4, CARD_W, CARD_H, '#B39A70', undefined, 0, 10);
  const card = gpanel(parent, x, y, CARD_W, CARD_H, '#FFDD77', undefined, 0, 10);
  card.name = 'shopItem:' + g.id;
  artSprite(card, 0, 0, CARD_W, CARD_H, 'ui_card_shop', { belowIdx: 0 });

  // Radial light highlights the item without adding another large panel to the page.
  const rays = N('shopItemRays', card).addComponent(Graphics);
  rays.fillColor = CA('#FFF9D4', 0.28);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    rays.moveTo(0, 66);
    rays.lineTo(Math.cos(a - 0.055) * 92, 66 + Math.sin(a - 0.055) * 68);
    rays.lineTo(Math.cos(a + 0.055) * 92, 66 + Math.sin(a + 0.055) * 68);
    rays.close(); rays.fill();
  }
  const seat = gpanel(card, 0, 64, 110, 110, '#735E42', undefined, 0, 10);
  artSprite(seat, 0, 0, 110, 110, 'ui_seat_q' + q, { belowIdx: 0 });
  const fb = mainLabel(seat, 0, 0, g.price ? KIND_ICON[g.tab] : '?', { size: 46 });
  const art = itemArt(g);
  if (art) artSprite(seat, 0, 0, 102, 102, art, { sliced: false, hideOnLoad: [fb] });
  if (g.give.kind !== 'hero') {
    const amount = g.give.n || 1;
    const quantity = gpanel(seat, 33, -43, 44, 24, CA('#281D17', 0.92), undefined, 0, 5);
    mainLabel(quantity, 0, 0, `×${amount}`, { size: 18, color: '#FFF5D8', bold: true, w: 42, h: 22 });
  }
  if (g.give.kind === 'equip') {
    const tier = gpanel(card, -78, 131, 44, 22, CA('#674324', 0.84), undefined, 0, 5);
    mainLabel(tier, 0, 0, `${EQUIPS[g.give.id].tier}阶`, { size: 15, color: '#FFF1CD', w: 40, h: 22 });
  }
  mainLabel(card, 0, -14, g.name, { size: 23, color: shown ? INK : '#866A44', bold: true, w: 194, h: 34 });
  mainLabel(card, 0, -49, g.sub, { size: 16, color: shown ? '#795531' : '#957A52', w: 194, h: 28 });

  const available = !!g.price && unlocked && !owned;
  const purchase = gpanel(card, 0, -110, 192, 48, available ? '#609E25' : '#A3946B', undefined, 0, 24);
  if (available) artSprite(purchase, 0, 0, 192, 48, 'ui_btn_buy', { belowIdx: 0 });
  if (available) {
    const price = fmt(g.price);
    const textW = Math.min(124, price.length * 16);
    const groupW = 30 + 7 + textW;
    artSprite(purchase, -groupW / 2 + 15, 0, 30, 30, g.currency === 'gold' ? 'ui_icon_coin' : 'ui_icon_diamond', { sliced: false });
    mainLabel(purchase, -groupW / 2 + 37 + textW / 2, 0, price, { size: 27, font: 'number', color: '#FFF4D6',
      align: 'left', w: textW, h: 36, outline: '#3E5F17', outlineW: 1.4 });
  } else {
    mainLabel(purchase, 0, 0, owned ? '已拥有' : !g.price ? '敬请期待' : `通关 ${g.unlock} 解锁`,
      { size: owned || !g.price ? 21 : 17, color: '#FFF3D5', bold: true, w: 178, h: 32 });
  }
  purchase.on(Node.EventType.TOUCH_START, () => { if (available) purchase.setScale(0.96, 0.96, 1); });
  purchase.on(Node.EventType.TOUCH_CANCEL, () => purchase.setScale(1, 1, 1));
  purchase.on(Node.EventType.TOUCH_END, (e: unknown) => {
    purchase.setScale(1, 1, 1);
    const ev = e as { propagationStopped?: boolean };
    if (ev) ev.propagationStopped = true;
    if (owned || !g.price) return;
    if (!unlocked) { toast(`通关 ${g.unlock} 后解锁`); return; }
    const cur = g.currency === 'gold' ? '金币' : '钻石';
    confirmModal(ctx, g.name, [g.sub,
      g.give.kind === 'hero' ? '购买后解锁该英雄' : g.give.kind === 'equip' ? '购买后自动穿戴（槽位已占用则入仓库）' : `获得 ${g.give.n || 1} 个`,
      `价格：${fmt(g.price)} ${cur}`], '购 买', () => {
      const r = shopBuy(g);
      return r.ok ? null : r.msg;
    }, KIND_ICON[g.tab] || '🎁', art);
  });
}
