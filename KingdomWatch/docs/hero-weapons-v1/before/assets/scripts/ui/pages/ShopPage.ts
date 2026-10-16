/** Shop: illustrated storefront, horizontal categories and a compact three-column shelf. */
import { Graphics, Label, Mask, Node, ScrollView, Tween, tween, UITransform, UIOpacity, Vec3 } from 'cc';
import { LO } from '../../config/GameConfig';
import { C, CA, N, setText, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicDialog, comicMark, comicPlate, comicPortrait } from '../ComicUI';
import { mainLabel, PageCtx, fmt, toast, MAIN_NAV_H, MAIN_RESOURCE_H, mainResourceTop, pageScroll } from '../PageKit';
import { EQUIPS, HERO_DEFS, KIND_NAME, MATS, SHOP, SHOP_TABS, ShopDef, ShopTab, STAT_NAME, StatKey, equipStat, lvReached, shopBuy, statFmt } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { dismissUI, reducedMotion, refreshUI } from '../UIMotion';
import { bindButton } from '../ButtonFeedback';

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
const QUALITY_NAMES = ['普通', '优秀', '稀有', '史诗'];
const EQUIP_INTRO: Record<string, string> = {
  wpn_bow: '轻巧的远征长弓，提升攻击与技能伤害，并提供额外攻速。',
  wpn_crossbow: '以重击见长的重弩，提升攻击与技能伤害，并提供额外暴击率。',
  helm_falcon: '为远征守卫打造的头盔，同时提供固定攻击与攻击加成。',
  acc_moon: '镌刻月纹的坠饰，同时提升暴击率与暴击伤害。',
  glove_wind: '轻便灵活的手套，提升攻速并扩大攻击范围。',
  armor_forest: '林间守卫使用的护甲，提升技能伤害与充能效率。',
};
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
    refreshUI(content, () => {
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
    });
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
      { tone: i === selected ? 'gold' : 'dark', name: 'shopTab:' + tab.key, sound: 'select' });
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
  const icon = N('shopItemInfo:' + g.id, card, 0, 65, 158, 158);
  if (g.give.kind === 'hero') {
    const picture = comicPortrait(icon, 0, 0, 154, art, HALO[q]);
    if (!shown) picture.addComponent(UIOpacity).opacity = 200;
    if (!art) comicMark(picture, 0, 0, 'lock', 44, '#93998E');
  } else {
    const halo = N('itemHalo', icon, 0, -2).addComponent(Graphics);
    halo.fillColor = CA(HALO[q], .9); halo.ellipse(0, 0, 78, 69); halo.fill();
    if (art) {
      const picture = comicArt(icon, 0, 0, 146, 144, art);
      if (!shown) picture.addComponent(UIOpacity).opacity = 200;
    } else comicMark(icon, 0, 2, 'lock', 44, '#93998E');
  }
  bindButton(icon, () => openProductDetails(ctx, g), { sound: 'open' });
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
    openProductDetails(ctx, g);
  }, { name: 'shopBuy:' + g.id, tone: available ? 'green' : 'muted',
    size: owned || !g.price ? 21 : 16, color: available ? COMIC.cream : '#344139', enabled: !owned && !!g.price });
  if (available) {
    const price = fmt(g.price), textW = Math.min(122, price.length * 16), groupW = 29 + 6 + textW;
    const face = purchase.getChildByName('buttonFace')!;
    comicArt(face, -groupW / 2 + 14.5, 0, 29, 29, g.currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1');
    mainLabel(face, -groupW / 2 + 35 + textW / 2, 0, price, { size: 26, font: 'number', color: COMIC.cream,
      align: 'left', w: textW, h: 35, outline: '#376C29', outlineW: 1 });
  }
}

interface ProductInfo { meta: string; description: string; rows: [string, string][]; delivery: string; }

/** Shop previews share the actual level-one equipment formulas and canonical item/hero definitions. */
function productInfo(g: ShopDef): ProductInfo {
  const sv = loadSave(), amount = g.give.n || 1;
  if (g.give.kind === 'equip') {
    const d = EQUIPS[g.give.id], preview = { uid: 'shop-preview', defId: d.id, lv: 1 };
    const rows: [string, string][] = (Object.keys(d.stats) as StatKey[])
      .filter(key => (d.stats[key] || 0) > 0)
      .map((key): [string, string] => [STAT_NAME[key], '+' + statFmt(key, equipStat(preview, key))]);
    rows.push(['持有（含已穿戴）', sv.equips.filter(e => e.defId === d.id).length + ' 件']);
    return { meta: QUALITY_NAMES[d.quality] + ' · ' + KIND_NAME[d.kind] + ' · ' + d.tier + '阶 · Lv.1',
      description: EQUIP_INTRO[d.id] || g.sub, rows,
      delivery: '当前英雄对应槽位为空时自动穿戴；否则收入背包，可在英雄页穿戴。' };
  }
  if (g.give.kind === 'hero' && HERO_DEFS[g.give.id]) {
    const hero = HERO_DEFS[g.give.id];
    return { meta: hero.job, description: hero.story,
      rows: [['初始攻击', String(hero.baseAtk)], ['初始技能伤害', String(hero.baseSkillDmg)], ['初始攻速', hero.atkSpd + ' 次/秒'], ['技能', hero.skillName], ['大招', hero.ultName]],
      delivery: '购买后解锁英雄，可在英雄页培养与编队。技能和大招需在每局三选一中学习。' };
  }
  if (g.give.kind === 'mat') {
    return { meta: '材料 · 每次获得 ×' + amount, description: MATS[g.give.id]?.desc || g.sub,
      rows: [['当前持有', fmt(sv.bag[g.give.id] || 0) + ' 个'], ['购买获得', amount + ' 个']],
      delivery: '购买后收入材料背包，可在“英雄 → 我的背包 → 材料”中查看。' };
  }
  return { meta: '英雄招募 · 敬请期待', description: '更多英雄即将加入王国防线，敬请期待。', rows: [],
    delivery: '该商品尚未开放购买。' };
}

function openProductDetails(ctx: PageCtx, g: ShopDef): void {
  const sv = loadSave(), info = productInfo(g), owned = g.give.kind === 'hero' && !!sv.heroes[g.give.id]?.owned;
  const unlocked = lvReached(g.unlock), available = !!g.price && unlocked && !owned;
  const height = Math.min(780, LO.half * 2 - LO.notchTop * 2 - 48), top = height / 2, bottom = -top;
  const panel = comicDialog(ctx.screens.parent || ctx.screens, 620, height, '商品详情');
  panel.name = 'shopProductDetails:' + g.id;
  const art = itemArt(g);
  if (art) {
    if (g.give.kind === 'hero') comicPortrait(panel, -214, top - 147, 112, art);
    else comicArt(panel, -214, top - 147, 112, 112, art);
  } else comicMark(panel, -214, top - 147, 'lock', 44, COMIC.sub);
  mainLabel(panel, 68, top - 128, g.name, { size: 28, font: 'body', color: COMIC.text, bold: true, align: 'left', w: 350, h: 40 });
  mainLabel(panel, 68, top - 174, info.meta, { size: 19, color: COMIC.sub, align: 'left', w: 350, h: 34 });

  // Keep the price/actions fixed; longer hero introductions scroll inside the paper panel.
  const bodyH = height - 410, bodyTop = top - 226;
  const view = N('shopProductInfoView', panel, 0, bodyTop - bodyH / 2, 552, bodyH);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const contentH = 96 + (info.rows.length ? 40 + info.rows.length * 44 : 0) + 96;
  const content = N('shopProductInfoContent', view, 0, bodyH / 2, 552, Math.max(bodyH, contentH));
  content.getComponent(UITransform)!.setAnchorPoint(.5, 1);
  scroll.content = content; scroll.horizontal = false; scroll.vertical = contentH > bodyH;
  mainLabel(content, 0, -42, info.description, { size: 21, color: COMIC.text, align: 'left', w: 536, h: 84, lineHeight: 29 });
  let cursor = 96;
  if (info.rows.length) {
    mainLabel(content, 0, -cursor - 15, g.give.kind === 'equip' ? '初始装备属性' : g.give.kind === 'hero' ? '英雄能力' : '数量信息',
      { size: 21, color: COMIC.text, bold: true, align: 'left', w: 536, h: 30 });
    cursor += 40;
    info.rows.forEach(([name, value], i) => {
      const row = comicPlate(content, 0, -cursor - 20, 544, 38, i % 2 ? 'paper' : 'card', { cut: 5, edge: false });
      mainLabel(row, -130, 0, name, { size: 20, color: COMIC.sub, align: 'left', w: 250, h: 30 });
      mainLabel(row, 130, 0, value, { size: 22, color: COMIC.text, bold: true, align: 'right', w: 250, h: 32 });
      cursor += 44;
    });
  }
  mainLabel(content, 0, -cursor - 48, info.delivery, { size: 19, color: COMIC.sub, align: 'left', w: 536, h: 80, lineHeight: 27 });
  const divider = N('shopProductFooterRule', panel, 0, bottom + 182).addComponent(Graphics);
  divider.strokeColor = CA(COMIC.sub, .25); divider.lineWidth = 1;
  divider.moveTo(-276, 0); divider.lineTo(276, 0); divider.stroke();
  const status = owned ? '已拥有该英雄' : !g.price ? '敬请期待' : !unlocked ? '通关 ' + g.unlock + ' 解锁购买'
    : '每次购买获得 ' + (g.give.n || 1) + (g.give.kind === 'hero' ? ' 名英雄' : g.give.kind === 'equip' ? ' 件装备' : ' 个材料');
  const feedback = N('shopPurchaseFeedback', panel);
  const statusLabel = mainLabel(feedback, 0, bottom + 164, status, { size: 18, color: available ? COMIC.greenShade : COMIC.sub, w: 552, h: 28 });
  let walletLabel: Node | null = null, shake: Tween<Node> | null = null, purchasing = false;
  panel.once(Node.EventType.NODE_DESTROYED, () => { shake?.stop(); shake = null; });
  const warn = (message: string): void => {
    setText(statusLabel, message); statusLabel.getComponent(Label)!.color = C('#B34338');
    shake?.stop(); feedback.setPosition(0, 0, 0);
    if (!reducedMotion()) shake = tween(feedback)
      .to(.045, { position: new Vec3(4, 0, 0) }, { easing: 'quadOut' })
      .to(.07, { position: new Vec3(-4, 0, 0) }, { easing: 'sineInOut' })
      .to(.06, { position: new Vec3(2, 0, 0) }, { easing: 'sineInOut' })
      .to(.075, { position: new Vec3() }, { easing: 'quadOut' }).start();
    toast(message, { kind: 'warning', title: '购买未完成', key: 'purchase:' + g.id,
      icon: 'shop_comic_v1/' + (g.currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1') });
  };
  if (g.price) {
    const price = fmt(g.price), textW = Math.min(150, price.length * 19), groupW = 35 + 8 + textW;
    comicArt(feedback, -groupW / 2 + 17.5, bottom + 125, 35, 35, g.currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1');
    mainLabel(feedback, -groupW / 2 + 43 + textW / 2, bottom + 125, price, { size: 30, font: 'number', color: COMIC.text,
      align: 'left', w: textW, h: 39 });
    const wallet = g.currency === 'gold' ? sv.gold : sv.diamonds;
    walletLabel = mainLabel(feedback, 0, bottom + 87, '持有 ' + fmt(wallet) + (g.currency === 'gold' ? ' 金币' : ' 钻石'),
      { size: 18, color: wallet >= g.price ? COMIC.sub : '#B34338', w: 552, h: 27 });
  }
  comicButton(panel, -139, bottom + 39, 248, 58, '关闭', () => dismissUI(panel.parent), { tone: 'dark', name: 'shopDetailsClose', sound: 'close' });
  const attemptPurchase = (): void => {
    if (!g.price || purchasing) return;
    if (!lvReached(g.unlock)) { toast('通关 ' + g.unlock + ' 后解锁'); return; }
    const latest = loadSave(), wallet = g.currency === 'gold' ? latest.gold : latest.diamonds;
    const currency = g.currency === 'gold' ? '金币' : '钻石';
    if (wallet < g.price) {
      if (walletLabel) { setText(walletLabel, '持有 ' + fmt(wallet) + ' ' + currency); walletLabel.getComponent(Label)!.color = C('#B34338'); }
      warn(currency + '不足，还差 ' + fmt(g.price - wallet) + ' ' + currency); return;
    }
    purchasing = true;
    const result = shopBuy(g);
    if (!result.ok) { purchasing = false; warn(result.msg); return; }
    toast(g.name + (g.give.kind === 'mat' ? ' ×' + (g.give.n || 1) : ''),
      { kind: 'success', title: g.give.kind === 'hero' ? '招募成功' : '购买成功',
        key: 'purchase:' + g.id, heroId: g.give.kind === 'hero' ? g.give.id : undefined,
        icon: g.give.kind !== 'hero' ? 'shop_comic_v1/' + itemArt(g) : undefined });
    dismissUI(panel.parent, ctx.refresh, false);
  };
  const purchase = comicButton(panel, 139, bottom + 39, 248, 58, available ? '购买' : owned ? '已拥有' : !g.price ? '敬请期待' : '尚未解锁',
    attemptPurchase, { tone: 'green', name: 'shopPurchaseConfirm', enabled: available });
  // The semantic result owns its sound, including a failed purchase; no success click first.
  bindButton(purchase, attemptPurchase, { sound: false });
}
