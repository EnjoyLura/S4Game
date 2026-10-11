/** Shop: illustrated storefront, horizontal categories and a compact three-column shelf. */
import { Graphics, Node, UIOpacity } from 'cc';
import { LO } from '../../config/GameConfig';
import { CA, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicDialog, comicMark, comicPlate, comicPortrait } from '../ComicUI';
import { mainLabel, PageCtx, fmt, toast, MAIN_NAV_H, MAIN_RESOURCE_H, mainResourceTop, pageScroll } from '../PageKit';
import { EQUIPS, SHOP, SHOP_TABS, ShopDef, ShopTab, lvReached, shopBuy } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';

const CARD_W = 218, CARD_H = 308, STEP_X = 232, STEP_Y = 324;
const TAB_ART = ['comic_wpn_bow_v1', 'comic_helm_falcon_v1', 'comic_armor_forest_v1', 'comic_mat_stone_v1'];
const CATEGORY_TITLES = ['远征武器', '英雄招募', '冒险装备', '强化材料'];
const ITEM_ART: Record<string, string> = {
  wpn_bow: 'comic_wpn_bow_v1', wpn_crossbow: 'comic_wpn_crossbow_v1',
  helm_falcon: 'comic_helm_falcon_v1', acc_moon: 'comic_acc_moon_v1',
  glove_wind: 'comic_glove_wind_v1', armor_forest: 'comic_armor_forest_v1',
  mat_stone: 'comic_mat_stone_v1', mat_iron: 'comic_mat_iron_v1',
  mat_dust: 'comic_mat_dust_v1', mat_rune: 'comic_mat_rune_v1',
};
const HALO = ['#E1E4DE', '#DCEBD0', '#DCEAF3', '#E7DFF0'];
const itemArt = (g: ShopDef): string => g.give.kind === 'hero'
  ? g.give.id ? 'comic_hero_' + g.give.id + '_v1' : '' : ITEM_ART[g.give.id] || '';
const st: { tab: ShopTab } = { tab: 'weapon' };

export function buildShop(ctx: PageCtx): void {
  const screenH = LO.half * 2 - LO.safeTop - LO.safeBottom;
  const splashH = Math.min(430, screenH * .27);
  const tabTop = splashH - 4, goodsTop = tabTop + 82, goodsBottom = screenH - MAIN_NAV_H;
  buildShopSplash(ctx.screens, splashH);
  const content = N('shopCatalog', ctx.screens);
  render();
  function render(): void {
    content.destroyAllChildren();
    const selected = SHOP_TABS.findIndex(t => t.key === st.tab);
    buildShopTabs(content, tabTop, selected, i => { st.tab = SHOP_TABS[i].key; render(); });
    const shelfH = goodsBottom - goodsTop;
    // Fill the full viewport behind the inset shelf, including its clipped corners.
    const backing = N('shopShelfBackdrop', content, 0, WY(goodsTop, shelfH), 750, shelfH).addComponent(Graphics);
    backing.fillColor = CA(COMIC.paper, 1);
    backing.rect(-375, -shelfH / 2, 750, shelfH); backing.fill();
    comicPlate(content, 0, WY(goodsTop, shelfH), 734, shelfH, 'paper', { name: 'shopShelfPanel', cut: 14 });
    const items = SHOP.filter(s => s.tab === st.tab);
    const shelf = pageScroll(content, 'shopShelf', goodsTop + 12, goodsBottom - 12,
      66 + Math.ceil(items.length / 3) * STEP_Y + 8, 706);
    // Plain shelf label, without a textured ribbon or decorative stripes.
    const heading = N('shopCategory', shelf, 0, -25, 684, 42);
    comicArt(heading, -316, 0, 31, 31, TAB_ART[selected]);
    mainLabel(heading, -148, 0, CATEGORY_TITLES[selected], { size: 23, color: COMIC.text, bold: true,
      font: 'body', align: 'left', w: 274, h: 34 });
    mainLabel(heading, 260, 0, items.length + '件商品', { size: 17, color: COMIC.sub, align: 'right', w: 128, h: 28 });
    const rule = N('shelfRule', shelf, 0, -51).addComponent(Graphics);
    rule.strokeColor = CA(COMIC.sub, .25); rule.lineWidth = 1.5;
    rule.moveTo(-334, 0); rule.lineTo(334, 0); rule.stroke();
    items.forEach((g, i) => drawCard(shelf, ctx, g, (i % 3 - 1) * STEP_X,
      -(64 + Math.floor(i / 3) * STEP_Y + CARD_H / 2)));
  }
}

function buildShopSplash(parent: Node, height: number): void {
  const scene = N('shopSplash', parent, 0, WY(0, height), 750, height);
  artSprite(scene, 0, 0, 750, height, 'scenes/bg_shop_comic_v1', { sliced: false, cover: true });
  const shade = N('shopSceneShade', scene).addComponent(Graphics);
  shade.fillColor = CA('#17212C', .24);
  shade.rect(-375, height / 2 - mainResourceTop() - MAIN_RESOURCE_H - 8, 750,
    mainResourceTop() + MAIN_RESOURCE_H + 8); shade.fill();
  // The sign is painted at (22.5%, 35.5%) of the 2:1 illustration.
  // Apply the same centered cover crop so its lettering stays on the wood at any height.
  const imageH = Math.max(height, 750 / 2), imageW = imageH * 2;
  const sign = N('shopSign', scene, (.225 - .5) * imageW, (.5 - .355) * imageH, 254, 96);
  mainLabel(sign, 0, 10, '商店', { size: 54, font: 'body', color: COMIC.cream, bold: true,
    w: 188, h: 66, outline: COMIC.ink, outlineW: 3.5 });
  mainLabel(sign, 0, -34, '远征补给 · 整装出发', { size: 17, font: 'body', color: '#FFE8AB',
    w: 244, h: 27, outline: COMIC.ink, outlineW: 1.4 });
  const edge = N('storeCounterEdge', scene).addComponent(Graphics);
  edge.fillColor = CA(COMIC.ink, 1); edge.rect(-375, -height / 2, 750, 7); edge.fill();
}

function buildShopTabs(parent: Node, top: number, selected: number, select: (index: number) => void): void {
  const bar = comicPlate(parent, 0, WY(top, 90), 750, 90, 'dark', { name: 'shopTabs', cut: 0, edge: false });
  SHOP_TABS.forEach((tab, i) => {
    const node = comicButton(bar, (i - 1.5) * 178, 0, 172, 70, '', () => select(i),
      { tone: i === selected ? 'gold' : 'dark', name: 'shopTab:' + tab.key });
    const face = node.getChildByName('buttonFace')!;
    comicArt(face, -48, 0, 40, 40, TAB_ART[i]);
    mainLabel(face, 23, 0, tab.name, { size: 25, font: 'body', bold: true,
      color: i === selected ? COMIC.text : COMIC.cream, w: 80, h: 37, align: 'left' });
  });
}

function drawCard(parent: Node, ctx: PageCtx, g: ShopDef, x: number, y: number): void {
  const sv = loadSave(), unlocked = lvReached(g.unlock);
  const owned = g.give.kind === 'hero' && g.give.id ? !!sv.heroes[g.give.id]?.owned : false;
  const shown = unlocked || owned;
  const q = g.give.kind === 'equip' ? EQUIPS[g.give.id]?.quality ?? 0 : g.give.kind === 'hero' ? 3 : 1;
  const card = comicPlate(parent, x, y, CARD_W, CARD_H, 'card', { name: 'shopItem:' + g.id, cut: 12 });
  const art = itemArt(g);
  if (g.give.kind === 'hero') {
    const picture = comicPortrait(card, 0, 65, 154, art, HALO[q]);
    if (!shown) picture.addComponent(UIOpacity).opacity = 200;
    if (!art) comicMark(picture, 0, 0, 'lock', 44, '#93998E');
  } else {
    const halo = N('itemHalo', card, 0, 63).addComponent(Graphics);
    halo.fillColor = CA(HALO[q], .9); halo.ellipse(0, 0, 78, 69); halo.fill();
    if (art) {
      const picture = comicArt(card, 0, 65, 146, 144, art);
      if (!shown) picture.addComponent(UIOpacity).opacity = 200;
    } else comicMark(card, 0, 67, 'lock', 44, '#93998E');
  }
  if (g.give.kind === 'equip') {
    const tier = comicPlate(card, -72, 129, 51, 26, 'dark', { cut: 5 });
    mainLabel(tier, 0, 0, EQUIPS[g.give.id].tier + '阶', { size: 16, font: 'body', color: COMIC.cream, bold: true, w: 45, h: 24 });
  }
  if (owned) comicMark(card, 82, 128, 'check', 20, '#458A35');
  else if (!unlocked && g.price) comicMark(card, 82, 128, 'lock', 18, '#879087');
  if (g.give.kind !== 'hero') {
    const amount = comicPlate(card, 68, 8, 47, 24, 'dark', { cut: 5 });
    mainLabel(amount, 0, 0, '×' + (g.give.n || 1), { size: 16, color: COMIC.cream, font: 'number', w: 42, h: 23 });
  }
  mainLabel(card, 0, -35, g.name, { size: 23, color: COMIC.text, font: 'body', bold: true, w: 194, h: 35 });
  mainLabel(card, 0, -68, g.sub, { size: 16, color: COMIC.sub, font: 'body', w: 194, h: 28 });
  const available = !!g.price && unlocked && !owned;
  const text = available ? '' : owned ? '已拥有' : !g.price ? '敬请期待' : '通关 ' + g.unlock + ' 解锁';
  const purchase = comicButton(card, 0, -117, 192, 48, text, () => {
    if (owned || !g.price) return;
    if (!unlocked) { toast('通关 ' + g.unlock + ' 后解锁'); return; }
    openPurchase(ctx, g);
  }, { name: 'shopBuy:' + g.id, tone: available ? 'green' : 'muted',
    size: owned || !g.price ? 21 : 16, color: available ? COMIC.cream : '#344139' });
  if (available) {
    const price = fmt(g.price), textW = Math.min(122, price.length * 16), groupW = 29 + 6 + textW;
    const face = purchase.getChildByName('buttonFace')!;
    comicArt(face, -groupW / 2 + 14.5, 0, 29, 29, g.currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1');
    mainLabel(face, -groupW / 2 + 35 + textW / 2, 0, price, { size: 26, font: 'number', color: COMIC.cream,
      align: 'left', w: textW, h: 35, outline: '#376C29', outlineW: 1 });
  }
}

function openPurchase(ctx: PageCtx, g: ShopDef): void {
  const panel = comicDialog(ctx.screens.parent || ctx.screens, 554, 516, g.name);
  panel.name = 'shopPurchaseDialog';
  const art = itemArt(g);
  if (art) {
    if (g.give.kind === 'hero') comicPortrait(panel, 0, 105, 152, art);
    else comicArt(panel, 0, 105, 152, 148, art);
  }
  mainLabel(panel, 0, 9, g.sub, { size: 23, font: 'body', color: COMIC.text, w: 490, h: 36 });
  const description = g.give.kind === 'hero' ? '购买后解锁该英雄' : g.give.kind === 'equip'
    ? '空闲槽位自动穿戴，其余收入背包' : '获得 ' + (g.give.n || 1) + ' 个，收入材料背包';
  mainLabel(panel, 0, -38, description, { size: 19, font: 'body', color: COMIC.sub, w: 490, h: 36 });
  const price = fmt(g.price), textW = Math.min(130, price.length * 19), groupW = 39 + 8 + textW;
  comicArt(panel, -groupW / 2 + 19.5, -99, 39, 39, g.currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1');
  mainLabel(panel, -groupW / 2 + 47 + textW / 2, -99, price, { size: 32, font: 'number', color: COMIC.text,
    align: 'left', w: textW, h: 43 });
  comicButton(panel, -127, -191, 214, 62, '取消', () => panel.parent?.destroy(), { tone: 'dark', name: 'shopPurchaseCancel' });
  comicButton(panel, 127, -191, 214, 62, '购买', () => {
    if (!lvReached(g.unlock)) { toast('通关 ' + g.unlock + ' 后解锁'); return; }
    const result = shopBuy(g);
    if (!result.ok) { toast(result.msg); return; }
    panel.parent?.destroy(); ctx.refresh();
  }, { tone: 'green', name: 'shopPurchaseConfirm' });
}
