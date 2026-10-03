/**
 * 二级编队界面（参考布阵版式）：上方 4 上阵位（从左到右 = 战斗站位序）+ 下方英雄栏
 * 上阵：点英雄栏未上阵英雄，从左到右占位；满员 toast「编队已满，请先下阵英雄」
 * 下阵：点已上阵英雄（英雄栏或上阵位）→ 二次确认弹窗
 * 全屏二级界面：挂 Screens 父级置顶，盖过底部导航，左上返回关闭
 */
import { Node } from 'cc';
import { PAL } from '../config/GameConfig';
import { CA, btn, dimLayer, gcircle, gpanel, label, N, WY } from './UIKit';
import { artSprite } from './Ux';
import { PageCtx, toast } from './PageKit';
import { HERO_DEFS, SQUAD_MAX, deployHero, inSquad, squadList, undeployHero } from '../core/GameData';
import { loadSave } from '../core/SaveData';

export function openSquadPanel(ctx: PageCtx): void {
  const root = ctx.screens.parent;
  if (!root) return;
  const dim = dimLayer(root, 0.9);
  dim.setSiblingIndex(root.children.length - 1);
  /* 动态内容（重建单元）：计数 / 上阵位 / 提示 / 英雄栏 */
  const body = N('squadBody', dim, 0, 0);

  btn(dim, -265, WY(40, 64), 130, 64, '◀ 返回', '#5A6472', () => dim.destroy(), 24, true);
  label(dim, 0, WY(46, 46), '编 队', { size: 32, color: '#FFE08A', bold: true, w: 200, h: 46 });

  rebuild();

  function rebuild(): void {
    body.destroyAllChildren();
    const sq = squadList();
    const sv = loadSave();

    /* 已上阵计数 */
    label(body, 245, WY(54, 36), `已上阵 ${sq.length}/${SQUAD_MAX}`,
      { size: 22, color: '#E8E0C8', bold: true, w: 240, h: 36, align: 'right' });

    /* 4 上阵位（空位大 + 号；有英雄 = 头像+名字+等级+✓，点击弹下阵确认） */
    const slotCy = WY(210, 180);
    for (let i = 0; i < SQUAD_MAX; i++) {
      const x = (i - 1.5) * 172;
      const hid = sq[i];
      const slot = gpanel(body, x, slotCy, 160, 180, hid ? CA('#1C2430', 0.95) : CA('#10151D', 0.66), undefined, 0, 20);
      if (hid) {
        const def = HERO_DEFS[hid];
        const av = gcircle(body, x, slotCy + 22, 52, CA('#2A3240', 1));
        artSprite(av, 0, 0, 92, 92, def.avatar, { sliced: false });
        label(body, x, slotCy - 44, def.name, { size: 19, color: '#F5E6C8', bold: true, w: 150, h: 26, shrink: true });
        label(body, x, slotCy - 72, 'Lv.' + (sv.heroes[hid]?.lv || 1), { size: 16, color: '#8C96A4', w: 150, h: 22 });
        const ok = gcircle(body, x + 60, slotCy - 62, 17, CA(PAL.green, 0.95));
        label(ok, 0, 0, '✓', { size: 22, color: '#FFFFFF', bold: true });
        slot.on(Node.EventType.TOUCH_END, () => confirmRemove(hid));
      } else {
        label(body, x, slotCy, '+', { size: 60, color: '#4A5563', bold: true });
      }
    }
    label(body, 0, WY(416, 26), '点英雄栏上阵（从左到右）· 点已上阵英雄下阵',
      { size: 17, color: '#7A8494', w: 660, h: 26 });

    /* 英雄栏（全部英雄；已上阵带 ✓ 徽记，名字转绿） */
    const bar = gpanel(body, 0, WY(456, 330), 690, 330, CA('#10151D', 0.82), undefined, 0, 16);
    label(bar, 0, 126, '— 英雄栏 —', { size: 22, color: '#FFE08A', bold: true });
    const defs = Object.values(HERO_DEFS);
    defs.forEach((def, i) => {
      const x = (i - (defs.length - 1) / 2) * 172;
      const dep = inSquad(def.id);
      const card = gpanel(bar, x, -22, 152, 210, CA('#1C2430', 0.95), undefined, 0, 16);
      const av = gcircle(card, 0, 34, 50, CA('#2A3240', 1));
      artSprite(av, 0, 0, 88, 88, def.avatar, { sliced: false });
      label(card, 0, -36, def.name, { size: 19, color: dep ? '#9FE07A' : '#F5E6C8', bold: true, w: 140, h: 26, shrink: true });
      label(card, 0, -62, 'Lv.' + (sv.heroes[def.id]?.lv || 1), { size: 16, color: '#8C96A4', w: 140, h: 22 });
      if (dep) {
        const ok = gcircle(card, 52, 78, 20, CA(PAL.green, 0.95));
        label(ok, 0, 0, '✓', { size: 26, color: '#FFFFFF', bold: true });
      }
      card.on(Node.EventType.TOUCH_END, () => {
        if (dep) { confirmRemove(def.id); return; }
        const r = deployHero(def.id);
        toast(r.msg); // 满员 → 「编队已满，请先下阵英雄」
        if (r.ok) rebuild();
      });
    });
  }

  /* 下阵二次确认弹窗 */
  function confirmRemove(hid: string): void {
    const m = gpanel(dim, 0, 60, 520, 290, CA('#1B201A', 0.97), undefined, 0, 18);
    /* 面板吞触摸：点面板空白不落到遮罩 */
    m.on(Node.EventType.TOUCH_END, (e: unknown) => {
      const ev = e as { propagationStopped?: () => void };
      if (ev && ev.propagationStopped) ev.propagationStopped();
    });
    label(m, 0, 78, '下阵确认', { size: 28, color: '#FFE08A', bold: true });
    label(m, 0, 16, `确定将「${HERO_DEFS[hid].name}」下阵？`, { size: 22, color: '#E8E0C8', w: 460, h: 36 });
    btn(m, 122, -82, 190, 70, '确 定', PAL.green, () => {
      const r = undeployHero(hid);
      m.destroy();
      toast(r.msg);
      if (r.ok) rebuild();
    }, 24, true);
    btn(m, -122, -82, 190, 70, '取 消', '#5A6472', () => m.destroy(), 24, true);
  }
}
