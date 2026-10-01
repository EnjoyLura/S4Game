/**
 * ③ 关卡（线稿 levels）：章节横幅 + 当前关场景大图（图内左右切关）+ 三档星箱（进度条连接·一次性领取）
 * 底部「开始战斗」→ 直接进入战斗（flow.mode=battle + loadScene）。
 */
import { Node, director } from 'cc';
import { PAL } from '../../config/GameConfig';
import { CA, btn, C, gbar, gpanel, label, N, WY, WX } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, toast, CX } from '../PageKit';
import { CHEST_COND, claimChest } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { flow } from '../../core/Flow';

/** 关卡目录（M0 仅 1-1 开放；加关卡进表即可） */
const LEVELS: { id: string; name: string; desc: string; open: boolean }[] = [
  { id: '1-1', name: '1-1 前哨', desc: '10 波 · 哥布林军团', open: true },
  { id: '1-2', name: '1-2 深林', desc: '通关 1-1 解锁', open: false },
];

export function buildLevels(ctx: PageCtx): void {
  const root = ctx.screens;
  const content = N('lvContent', root, 0, 0, 750, 900);
  const st = { i: 0 };

  render();

  function render(): void {
    content.destroyAllChildren();
    const sv = loadSave();
    const lv = LEVELS[st.i];

    /* 章节横幅 */
    const banner = gpanel(content, CX(125, 500), WY(210, 100), 500, 100, CA('#3A2E23', 0.95), C(PAL.gold), 2.5, 16);
    artSprite(banner, 0, 0, 500, 100, 'ui_banner_title', { belowIdx: 0 });
    label(banner, 0, 16, '第1章 腐朽森林', { size: 30, color: '#4A3214', bold: true, w: 480, h: 40 });
    label(banner, 0, -22, lv.name, { size: 24, color: '#6B4A1E', bold: true, w: 480, h: 34 });

    /* 当前关场景大图 + 图内左右切关箭头 */
    const scene = gpanel(content, CX(100, 550), WY(325, 550), 550, 550, CA('#2E4034', 0.8), 'rgba(120,180,110,1)', 1.5, 18);
    artSprite(scene, 0, 0, 550, 550, 'scenes/scene_' + lv.id.replace('-', '_'), { belowIdx: 0, cover: true });
    label(scene, 0, -30, lv.open ? `${lv.desc}` : '🔒 未解锁', { size: 26, color: '#EAF2E0', w: 500, h: 40, shrink: true, outline: '#1C2A18', outlineW: 3 });
    if (!lv.open) label(scene, 0, 10, `通关 ${LEVELS[0].id} 解锁`, { size: 20, color: '#C9D8BC', w: 500, h: 30, outline: '#1C2A18', outlineW: 2 });
    btn(scene, -190, 0, 70, 70, '◀', PAL.gold, () => { st.i = (st.i + LEVELS.length - 1) % LEVELS.length; render(); }, 26);
    btn(scene, 190, 0, 70, 70, '▶', PAL.gold, () => { st.i = (st.i + 1) % LEVELS.length; render(); }, 26);
    if (st.i === 0 && !sv.stars[lv.id]) {
      const nb = gpanel(content, CX(560, 70), WY(345, 30), 70, 30, CA('#E5484D', 0.95), undefined, 0, 8);
      label(nb, 0, 0, 'NEW', { size: 16, color: '#FFFFFF', bold: true });
    }

    /* 星箱进度条（垫三箱后方；金色=已达成档数） */
    gbar(content, CX(147, 470), WY(940, 14), 470, 14, PAL.gold).set((sv.stars[lv.id] || 0) / 3);

    /* 三档星箱 */
    const stars = sv.stars[lv.id] || 0;
    const claimed = sv.chestClaimed[lv.id] || 0;
    const chests = [
      { q: PAL.gold as string, icon: '📦' },
      { q: '#C0C8D0', icon: '🎁' },
      { q: PAL.purple as string, icon: '💎' },
    ];
    for (let t = 0; t < 3; t++) {
      const tier = t + 1;
      const x = CX(40 + t * 235, 215);
      const canClaim = stars >= tier && claimed < tier;
      const done = claimed >= tier;
      const card = gpanel(content, x, WY(890, 180), 215, 180,
        CA('#14181E', 0.92), done ? C('#3A4250') : canClaim ? C(chests[t].q) : C('#3A4250'), canClaim ? 3 : 2, 14);
      const ic = gpanel(card, 0, 33, 90, 90, CA('#10151D', 0.8), done ? C('#3A4250') : C(chests[t].q), 2, 14);
      label(ic, 0, 0, done ? '✅' : chests[t].icon, { size: 44 });
      label(card, 0, -33, CHEST_COND[tier - 1], { size: 19, color: done ? '#6B7480' : '#E8E0C8', w: 200, h: 26 });
      const reward = ['200金', '60钻', '150钻'][t];
      label(card, 0, -62, done ? '已领取' : canClaim ? `领取 ${reward}` : `未达标 · ${reward}`, {
        size: 18, color: done ? '#5F6873' : canClaim ? '#FFE08A' : '#889099', w: 200, h: 26,
      });
      if (canClaim) {
        card.on(Node.EventType.TOUCH_END, () => {
          const r = claimChest(lv.id, stars, tier);
          toast(r.msg);
          if (r.ok) ctx.refresh();
        });
      }
    }

    /* 开始战斗 */
    if (lv.open) {
      btn(content, CX(125, 500), WY(1085, 90), 500, 90, '⚔ 开 始 战 斗', PAL.green, () => {
        flow.mode = 'battle';
        flow.levelId = lv.id;
        director.loadScene('Main');
      }, 30);
    } else {
      btn(content, CX(125, 500), WY(1085, 90), 500, 90, '🔒 通关 1-1 解锁', '#5A6472', () => {}, 24);
    }
  }
}
