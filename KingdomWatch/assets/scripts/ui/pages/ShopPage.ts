/**
 * ① 商店（线稿 shop）：撕纸标题 + 四页签连体（无背板，仅首/末段外侧圆弧）+ 货架大背板 + 商品卡 2×2
 * 固定货架 12 件，关卡章节阶段性解锁；购买=确认弹窗→扣货币→入包/解锁英雄。
 */
import { Node, Graphics } from 'cc';
import { PAL, LO } from '../../config/GameConfig';
import { CA, btn, C, gpanel, label, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, artPanel, confirmModal, fmt, toast, CX, qualityBadge } from '../PageKit';
import { EQUIPS, SHOP, SHOP_TABS, ShopDef, ShopTab, QCOLOR, lvReached, shopBuy } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';

const KIND_ICON: Record<string, string> = { weapon: '🏹', hero: '🦸', equip: '🛡️', mat: '🧱' };

/* 页签跨刷新保持（购买后 refresh 重建页面不跳回第一个页签） */
const st: { tab: ShopTab } = { tab: 'weapon' };

export function buildShop(ctx: PageCtx): void {
  const root = ctx.screens;

  const banner = gpanel(root, 0, WY(210, 88), 520, 88, CA('#3A2E23', 0.95), C(PAL.gold), 2.5, 14);
  artSprite(banner, 0, 0, 520, 88, 'ui_banner_title', { belowIdx: 0 });
  label(banner, 0, 0, '商 店', { size: 34, color: '#4A3214', bold: true });

  const content = N('shopContent', root, 0, 0, 750, 800);
  render();

  function render(): void {
    content.destroyAllChildren();
    // 货架大背板（用户确认：商品栏加大背板，从页签下方铺到导航栏上方）
    const top = 400;
    const bh = 2 * LO.half - 174 - top;   // 预留底部导航(148)+边距
    artPanel(content, 0, WY(top, bh), 730, bh, 'ui_panel_zone');
    // 四页签连体（用户确认参考英雄页：无背板、段内直角、仅首/末段外侧圆弧）
    const segW = 680 / 4, segH = 64, segR = 14;
    SHOP_TABS.forEach((t, i) => {
      const active = t.key === st.tab;
      const seg = N('tab_' + t.key, content, CX(35 + i * segW, segW), WY(320, segH), segW, segH);
      const g = seg.addComponent(Graphics);
      g.fillColor = C(active ? PAL.gold : '#5A6472');
      g.roundRect(-segW / 2, -segH / 2, segW, segH, i === 0 || i === SHOP_TABS.length - 1 ? segR : 0);
      if (i === 0) g.rect(segW / 2 - segR, -segH / 2, segR, segH);                    // 并集盖平右侧两角
      else if (i === SHOP_TABS.length - 1) g.rect(-segW / 2, -segH / 2, segR, segH);  // 并集盖平左侧两角
      g.fill();
      label(seg, 0, 0, t.name, { size: 22, color: '#241C12', bold: true, w: segW, h: segH });
      seg.on(Node.EventType.TOUCH_END, () => { st.tab = t.key; render(); });
    });
    // 商品卡 2×2
    const items = SHOP.filter(s => s.tab === st.tab);
    items.forEach((g, c) => {
      drawCard(content, ctx, g, CX(35 + (c % 2) * 350, 330), WY(420 + Math.floor(c / 2) * 330, 300));
    });
  }
}

function drawCard(parent: Node, ctx: PageCtx, g: ShopDef, cx: number, cy: number): void {
  const sv = loadSave();
  const unlocked = lvReached(g.unlock);
  const owned = g.give.kind === 'hero' && g.give.id ? !!sv.heroes[g.give.id]?.owned : false;
  const q = g.give.kind === 'equip' ? EQUIPS[g.give.id]?.quality ?? 0 : 1;
  /* 用户确认：商品卡无边框（无描边、无带框面板美术），品质色只保留在图标座上 */
  const card = gpanel(parent, cx, cy, 330, 300, CA('#14181E', 0.92), undefined, 0, 14);

  const seat = gpanel(card, 0, 60, 130, 130, CA('#2A3240', 1), unlocked ? C(QCOLOR[q]) : C('#5A6472'), 2.5, 14);
  label(seat, 0, 0, KIND_ICON[g.tab] || '🎁', { size: 56 });

  if (g.give.kind === 'equip') {
    const d = EQUIPS[g.give.id];
    qualityBadge(card, -115, 125, d.quality, d.tier);   // 缩小后贴卡片左上角，右缘 -69 不压图标座（座左缘 -65）
  }
  label(card, 0, -27, g.name, { size: 24, color: unlocked ? '#FFF3D6' : '#889099', bold: true, w: 310, h: 32, shrink: true });
  label(card, 0, -55, g.sub, { size: 17, color: unlocked ? '#AAB2BD' : '#5F6873', w: 310, h: 26, shrink: true });

  const cur = g.currency === 'gold' ? '🪙' : '💎';
  if (!unlocked) {
    btn(card, 0, -100, 240, 54, `🔒 通关 ${g.unlock} 解锁`, '#5A6472', () => toast(`通关 ${g.unlock} 后解锁`), 19, true);
  } else if (owned || !g.price) {
    btn(card, 0, -100, 240, 54, owned ? '已拥有' : '敬请期待', '#5A6472', () => {}, 22, true);
  } else {
    btn(card, 0, -100, 240, 54, `${cur} ${fmt(g.price)} 购买`, PAL.green, () => {
      confirmModal(ctx, g.name, [
        g.sub,
        g.give.kind === 'hero' ? '购买后解锁该英雄' : g.give.kind === 'equip' ? '购买后自动穿戴（槽位已占用则入仓库）' : `获得 ${g.give.n || 1} 个`,
        `价格：${cur} ${fmt(g.price)}`,
      ], '购 买', () => {
        const r = shopBuy(g);
        return r.ok ? null : r.msg;
      }, KIND_ICON[g.tab] || '🎁');
    }, 22, true);
  }
}
