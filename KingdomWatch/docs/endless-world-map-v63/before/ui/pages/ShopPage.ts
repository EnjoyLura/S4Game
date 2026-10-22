/** Shop: illustrated storefront, horizontal categories and a compact three-column shelf. */
import { Graphics, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { LO } from '../../config/GameConfig';
import { WeaponType } from '../../config/Weapons';
import { C, CA, N, setText, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { COMIC, comicArt, comicButton, comicMark, comicPlate, comicPortrait, comicSurface } from '../ComicUI';
import { mainLabel, PageCtx, fmt, toast, MAIN_NAV_H, MAIN_RESOURCE_H, mainResourceTop, pageScroll } from '../PageKit';
import { EQUIPS, EquipKind, HERO_DEFS, KIND_NAME, MATS, SHOP, SHOP_TABS, ShopDef, ShopTab, STAT_NAME, StatKey, equipStat, lvReached, shopBuy, statFmt, WEAPONS, weaponUsers } from '../../core/GameData';
import { GEAR_ART } from '../HeroComic';
import { loadSave } from '../../core/SaveData';
import { dismissUI, reducedMotion, refreshUI } from '../UIMotion';
import { bindButton } from '../ButtonFeedback';
import { gearQuality } from '../GearQuality';
import { paintLobbyStrip, shopProductCard, shopQualitySocket } from '../LobbyChrome';
import { detailBody, detailDialog, detailFooter, detailGroup, detailGroupHeight, detailHeight, detailOverview, detailParagraph } from '../DetailDialog';
import { showRewardPopup } from '../RewardPopup';

const CARD_W = 218, CARD_H = 330, STEP_X = 232, STEP_Y = 346;
const TAB_ART = ['comic_wpn_bow_v1', 'comic_helm_falcon_v1', 'comic_armor_forest_v1', 'comic_mat_stone_v1'];
const CATEGORY_TITLES = ['远征武器', '英雄招募', '冒险装备', '强化材料'];
const HALO = ['#E1E4DE', '#DCEBD0', '#DCEAF3', '#E7DFF0'];
const EQUIP_INTRO: Record<string, string> = {
  wpn_bow: '轻巧的远征长弓，提升攻击与技能伤害，并提供额外攻速。',
  wpn_crossbow: '以重击见长的重弩，提升攻击与技能伤害，并提供额外暴击率。',
  helm_falcon: '为远征守卫打造的头盔，同时提供固定攻击与攻击加成。',
  acc_moon: '镌刻月纹的坠饰，同时提升暴击率与暴击伤害。',
  glove_wind: '轻便灵活的手套，提升攻速并扩大攻击范围。',
  armor_forest: '林间守卫使用的护甲，提升技能伤害与充能效率。',
};
const itemArt = (g: ShopDef): string => g.give.kind === 'hero'
  ? g.give.id ? 'comic_hero_' + g.give.id + '_v1' : '' : GEAR_ART[g.give.id] || '';
type WeaponFilter = 'all' | WeaponType;
const WEAPON_FILTERS: { key: WeaponFilter; name: string }[] = [
  { key: 'all', name: '全部' }, { key: 'bow', name: '弓' }, { key: 'crossbow', name: '弩' },
  { key: 'book', name: '魔法书' }, { key: 'staff', name: '法杖' },
];
type EquipFilter = 'all' | Exclude<EquipKind, 'weapon'>;
const EQUIP_FILTERS: { key: EquipFilter; name: string }[] = [
  { key: 'all', name: '全部' }, { key: 'helm', name: '头盔' }, { key: 'acc', name: '饰品' },
  { key: 'glove', name: '手套' }, { key: 'armor', name: '衣服' },
];
const st: { tab: ShopTab; weapon: WeaponFilter; equip: EquipFilter } = { tab: 'weapon', weapon: 'all', equip: 'all' };

export function buildShop(ctx: PageCtx): void {
  const screenH = LO.half * 2 - LO.safeTop - LO.safeBottom;
  const splashH = Math.min(430, screenH * .27);
  const tabTop = splashH - 4, goodsTop = tabTop + 90, goodsBottom = screenH - MAIN_NAV_H;
  buildShopSplash(ctx.screens, splashH);
  const content = N('shopCatalog', ctx.screens);
  render();
  function render(): void {
    refreshUI(content, () => {
      const selected = SHOP_TABS.findIndex(t => t.key === st.tab);
      buildShopTabs(content, tabTop, selected, i => { st.tab = SHOP_TABS[i].key; render(); });
      const shelfH = goodsBottom - goodsTop;
      comicPlate(content, 0, WY(goodsTop, shelfH), 750, shelfH, 'paper', {
        name: 'shopShelfPanel', cut: 0, edge: false, highlight: false,
      });
      const weapons = st.tab === 'weapon', equipment = st.tab === 'equip', filterH = weapons || equipment ? 64 : 0;
      const items = SHOP.filter(s => s.tab === st.tab
        && (!weapons || st.weapon === 'all' || WEAPONS[s.give.id]?.type === st.weapon)
        && (!equipment || st.equip === 'all' || EQUIPS[s.give.id]?.kind === st.equip));
      if (weapons || equipment) items.sort((a, b) => EQUIPS[a.give.id].quality - EQUIPS[b.give.id].quality);
      const shelf = pageScroll(content, 'shopShelf', goodsTop + 12, goodsBottom - 12,
        66 + filterH + Math.ceil(items.length / 3) * STEP_Y + 8, 706);
      // Plain shelf label, without a textured ribbon or decorative stripes.
      const heading = N('shopCategory', shelf, 0, -25, 684, 42);
      comicArt(heading, -316, 0, 31, 31, TAB_ART[selected]);
      mainLabel(heading, -148, 0, CATEGORY_TITLES[selected], { size: 23, color: COMIC.text, bold: true,
        font: 'body', align: 'left', w: 274, h: 34 });
      mainLabel(heading, 260, 0, items.length + '件商品', { size: 17, color: COMIC.sub, align: 'right', w: 128, h: 28 });
      if (weapons) WEAPON_FILTERS.forEach((filter, i) => {
        comicButton(shelf, (i - 2) * 134, -79, 124, 44, filter.name, () => {
          if (st.weapon === filter.key) return;
          st.weapon = filter.key; render();
        }, { name: 'shopWeaponFilter:' + filter.key, tone: st.weapon === filter.key ? 'gold' : 'dark', size: 20, sound: 'select', quiet: true });
      });
      if (equipment) EQUIP_FILTERS.forEach((filter, i) => {
        comicButton(shelf, (i - 2) * 134, -79, 124, 44, filter.name, () => {
          if (st.equip === filter.key) return;
          st.equip = filter.key; render();
        }, { name: 'shopEquipFilter:' + filter.key, tone: st.equip === filter.key ? 'gold' : 'dark', size: 20, sound: 'select', quiet: true });
      });
      items.forEach((g, i) => drawCard(shelf, ctx, g, (i % 3 - 1) * STEP_X,
        -(64 + filterH + Math.floor(i / 3) * STEP_Y + CARD_H / 2)));
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
}

function buildShopTabs(parent: Node, top: number, selected: number, select: (index: number) => void): void {
  const bar = comicPlate(parent, 0, WY(top, 90), 750, 90, 'dark', {
    name: 'shopTabs', cut: 0, edge: false, highlight: false,
  });
  paintLobbyStrip(bar, 750, 90, [-178, 0, 178]);
  SHOP_TABS.forEach((tab, i) => {
    const node = comicButton(bar, (i - 1.5) * 178, 0, 172, 70, '', () => select(i),
      { tone: i === selected ? 'gold' : 'dark', name: 'shopTab:' + tab.key, sound: 'select', quiet: true });
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
  const equipment = g.give.kind === 'equip';
  const card = shopProductCard(parent, x, y, CARD_W, CARD_H, 'shopItem:' + g.id);
  const art = itemArt(g);
  const icon = N('shopItemInfo:' + g.id, card, 0, 64, 180, 180);
  if (g.give.kind === 'hero') {
    const picture = comicPortrait(icon, 0, 0, 176, art, HALO[q]);
    if (!shown) picture.addComponent(UIOpacity).opacity = 200;
    if (!art) comicMark(picture, 0, 0, 'lock', 44, '#93998E');
  } else {
    shopQualitySocket(icon, 0, 0, 180, q);
    if (art) {
      const picture = comicArt(icon, 0, 0, 154, 154, art);
      if (!shown) picture.addComponent(UIOpacity).opacity = 200;
    } else comicMark(icon, 0, 2, 'lock', 44, '#93998E');
  }
  bindButton(icon, () => openProductDetails(ctx, g), { sound: 'open' });
  if (owned) comicMark(card, 84, 145, 'check', 20, '#458A35');
  else if (!unlocked && g.price) comicMark(card, 84, 145, 'lock', 18, '#879087');
  if (g.give.kind !== 'hero') {
    const amount = comicSurface(card, 76, -17, 47, 24, 'dark', { name: 'shopItemCount', radius: 7 });
    mainLabel(amount, 0, 0, '×' + (g.give.n || 1), { size: 16, color: COMIC.cream, font: 'number', w: 42, h: 23 });
  }
  mainLabel(card, 0, -46, g.name, { size: 23, color: COMIC.text, font: 'body', bold: true, w: 194, h: 32 });
  mainLabel(card, 0, -80, equipment ? g.sub.replace(/^[白绿蓝紫]\d+阶\s*·\s*/, '') : g.sub,
    { size: 16, color: COMIC.sub, font: 'body', w: 194, h: 28 });
  const available = !!g.price && unlocked && !owned;
  const text = available ? '' : owned ? '已拥有' : g.give.id === 'pyro' ? '通关普通1-2免费获得' : !g.price ? '敬请期待' : '通关 ' + g.unlock + ' 解锁';
  if (!available) {
    const status = N('shopBuy:' + g.id, card, 0, -130, 192, 48);
    mainLabel(status, 0, 0, text, { size: g.give.id === 'pyro' && !owned ? 16 : owned || !g.price ? 21 : 16, color: owned ? COMIC.greenShade : COMIC.sub,
      bold: owned, font: 'body', w: 184, h: 38 });
    if (!owned && g.price) bindButton(status, () => toast('通关 ' + g.unlock + ' 后解锁'), { sound: false });
    return;
  }
  const purchase = comicButton(card, 0, -130, 192, 48, text, () => {
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
    const weapon = WEAPONS[d.id];
    if (d.focus) rows.push(['玩法侧重', d.focus]);
    if (weapon) {
      const p = weapon.breakthrough;
      rows.push(['适用英雄', weaponUsers(d.id)], ['每10级 · 攻击 / 技伤', `+${Math.round(p.atk * 100)}% / +${Math.round(p.skill * 100)}%`],
        ['每30级 · ' + STAT_NAME[p.secondary], '+' + statFmt(p.secondary, p.bonus)]);
    } else rows.push(['适用英雄', '所有英雄']);
    return { meta: gearQuality(d.quality).name + ' · ' + KIND_NAME[d.kind] + ' · ' + d.tier + '阶 · Lv.1',
      description: d.description || EQUIP_INTRO[d.id] || (weapon ? weaponUsers(d.id) + '。强化方向与阶段突破随武器特性变化。' : g.sub), rows,
      delivery: weapon ? '购买后收入背包，在英雄页替换。装上即继承该英雄的武器培养等级，初始武器不可卸下，可直接替换。' : '当前英雄对应槽位为空时自动穿戴；否则收入背包，可在英雄页穿戴。' };
  }
  if (g.give.kind === 'hero' && HERO_DEFS[g.give.id]) {
    const hero = HERO_DEFS[g.give.id];
    return { meta: hero.job, description: hero.story,
      rows: [['初始攻击', String(hero.baseAtk)], ['初始技能伤害', String(hero.baseSkillDmg)], ['初始攻速', hero.atkSpd + ' 次/秒'], ['技能', hero.skillName], ['大招', hero.ultName]],
      delivery: g.give.id === 'pyro' ? '首次通关普通1-2免费获得，无需钻石。回营后手动加入编队；技能和大招仍需每局选卡学习。'
        : '购买后解锁英雄，可在英雄页培养与编队。技能和大招需在每局三选一中学习。' };
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
  const groups: { title: string; rows: [string, string][] }[] = [];
  const attributes = info.rows.filter(([name]) => !name.startsWith('每') && !name.startsWith('持有') && name !== '适用英雄');
  const traits = info.rows.filter(([name]) => name.startsWith('每'));
  const inventory = info.rows.filter(([name]) => name.startsWith('持有'));
  if (attributes.length) groups.push({ title: g.give.kind === 'equip' ? '初始属性' : g.give.kind === 'hero' ? '英雄能力' : '数量信息', rows: attributes });
  if (traits.length) groups.push({ title: '武器特性', rows: traits });
  if (inventory.length) groups.push({ title: '持有情况', rows: inventory });
  const deliveryH = Math.max(50, Math.ceil(info.delivery.length / 28) * 25);
  const contentH = groups.reduce((sum, group) => sum + detailGroupHeight(group.rows.length), 0) + 38 + deliveryH + 8;
  const footerInset = 20, footerH = 202 + footerInset;
  const height = detailHeight(contentH,footerH,760), bottom = -height/2;
  const panel = detailDialog(ctx.screens.parent || ctx.screens,620,height,'商品详情','shopProductDetails:' + g.id);
  const art = itemArt(g), equipment = g.give.kind === 'equip' ? EQUIPS[g.give.id] : null;
  const users = info.rows.find(([name]) => name === '适用英雄')?.[1];
  detailOverview(panel,g.name,info.meta,users,info.description,(parent,x,y,side) => {
    if (equipment || g.give.kind === 'mat') shopQualitySocket(parent,x,y,side,equipment?.quality ?? 1);
    if (art) {
      if (g.give.kind === 'hero') comicPortrait(parent,x,y,side,art);
      else comicArt(parent,x,y,side-20,side-20,art);
    } else comicMark(parent,x,y,'lock',50,COMIC.sub);
  });
  const content = detailBody(panel,contentH,footerH,'shopProduct');
  let cursor = 0;
  groups.forEach(group => { cursor = detailGroup(content,cursor,group.title,group.rows); });
  detailParagraph(content,cursor,'获取说明',info.delivery,deliveryH);
  detailFooter(panel,footerH);
  const status = owned ? '已拥有该英雄' : g.give.id === 'pyro' ? '通关普通1-2免费获得 · 无需钻石' : !g.price ? '敬请期待' : !unlocked ? '通关 ' + g.unlock + ' 解锁购买'
    : '每次购买获得 ' + (g.give.n || 1) + (g.give.kind === 'hero' ? ' 名英雄' : g.give.kind === 'equip' ? ' 件装备' : ' 个材料');
  const feedback = N('shopPurchaseFeedback', panel);
  const statusLabel = mainLabel(feedback, 0, bottom + 87 + footerInset, status, { size: 17, font:'body', color: available ? COMIC.greenShade : COMIC.sub, w: 552, h: 24 });
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
    const price = fmt(g.price), textW = Math.min(160, price.length * 23), groupW = 40 + 10 + textW;
    comicArt(feedback, -groupW / 2 + 20, bottom + 153 + footerInset, 40, 40, g.currency === 'gold' ? 'comic_coin_v1' : 'comic_diamond_v1');
    mainLabel(feedback, -groupW / 2 + 50 + textW / 2, bottom + 153 + footerInset, price, { size: 36, font: 'number', color: '#1B3040',
      align: 'left', w: textW, h: 46 });
    const wallet = g.currency === 'gold' ? sv.gold : sv.diamonds;
    walletLabel = mainLabel(feedback, 0, bottom + 116 + footerInset, '持有 ' + fmt(wallet) + (g.currency === 'gold' ? ' 金币' : ' 钻石'),
      { size: 18, font:'body', color: wallet >= g.price ? COMIC.sub : '#B34338', w: 552, h: 24 });
  }
  comicButton(panel, -139, bottom + 39 + footerInset, 248, 58, '关闭', () => dismissUI(panel.parent),
    { tone: 'dark', name: 'shopDetailsClose', sound: 'close' });
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
    dismissUI(panel.parent, () => {
      ctx.refresh();
      showRewardPopup(ctx.screens.parent || ctx.screens, g.name, 0, [{ name: g.name, icon: itemArt(g), amount: g.give.n || 1,
        quality: g.give.kind === 'equip' ? EQUIPS[g.give.id]?.quality : undefined }], undefined,
      { title: g.give.kind === 'hero' ? '英雄加入' : '购买成功',
        subtitle: g.give.kind === 'hero' ? '新的伙伴已加入远征' : '已收入背包 · 可前往英雄页使用',
        heroId: g.give.kind === 'hero' ? g.give.id : undefined,
        sound: g.give.kind === 'hero' ? 'recruit' : 'purchase' });
    }, false);
  };
  const purchase = comicButton(panel, 139, bottom + 39 + footerInset, 248, 58, available ? '购买' : owned ? '已拥有' : g.give.id === 'pyro' ? '关卡免费获得' : !g.price ? '敬请期待' : '尚未解锁',
    attemptPurchase, { tone: 'green', name: 'shopPurchaseConfirm', enabled: available });
  // The semantic result owns its sound, including a failed purchase; no success click first.
  bindButton(purchase, attemptPurchase, { sound: false });
}
