/**
 * ③ 关卡（线稿 levels）：顶部关卡名 + 三档难度页签（普通/精英/地狱，逐一通关解锁）
 * + 关卡大图（图内左右切关）+ 三档星箱（按当前难度独立计星）+ 「开始战斗」。
 * 去边框规范：全部纯色板，无描边、无框体美术。
 */
import { Node, director } from 'cc';
import { PAL } from '../../config/GameConfig';
import { CA, btn, gbar, gpanel, label, N, WY } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, artPanel, toast, circleArrow } from '../PageKit';
import { CHEST_COND, claimChest, starKey, squadList } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';
import { flow } from '../../core/Flow';
import { openSquadPanel } from '../SquadPanel';

/** 关卡目录（与 config/Mobs 的 LEVEL_TABLE 对应；通关上一关解锁下一关） */
const LEVELS: { id: string; name: string; desc: string }[] = [
  { id: '1-1', name: '1-1 前哨', desc: '10 波 · 哥布林军团' },
  { id: '1-2', name: '1-2 深林', desc: '10 波 · 深林伏兵' },
  { id: '1-3', name: '1-3 兽穴', desc: '10 波 · 蛮兵巢穴' },
];
const DIFFS = ['普通', '精英', '地狱'];

export function buildLevels(ctx: PageCtx): void {
  const root = ctx.screens;
  const content = N('lvContent', root, 0, 0, 750, 900);
  const st = { i: 0, d: 0 };

  /** 关卡是否开放：首关恒开放，其余需上一关（普通难度）通关 */
  function levelOpen(i: number): boolean {
    return i === 0 || (loadSave().stars[starKey(LEVELS[i - 1].id, 0)] || 0) >= 1;
  }
  /** 难度是否解锁：精英需本关普通有星，地狱需本关精英有星 */
  function diffUnlocked(i: number, d: number): boolean {
    return d === 0 ? levelOpen(i) : (loadSave().stars[starKey(LEVELS[i].id, d - 1)] || 0) >= 1;
  }

  render();

  function render(): void {
    content.destroyAllChildren();
    const sv = loadSave();
    const lv = LEVELS[st.i];
    const open = levelOpen(st.i);
    const key = starKey(lv.id, st.d);
    const stars = sv.stars[key] || 0;
    const claimed = sv.chestClaimed[key] || 0;

    /* 顶部关卡名（下移避让右上资源栏——用户反馈重叠） */
    const banner = gpanel(content, 0, WY(206, 84), 640, 84, CA('#2E2418', 0.92), undefined, 0, 14);
    label(banner, 0, 20, '第1章 腐朽森林', { size: 19, color: '#C8B080', w: 480, h: 28 });
    label(banner, 0, -14, lv.name, { size: 30, color: '#F5E6C8', bold: true, w: 480, h: 38 });

    /* 三档难度页签（独立按钮；未解锁带锁，点击提示） */
    for (let d = 0; d < 3; d++) {
      const unlocked = diffUnlocked(st.i, d);
      const active = st.d === d;
      const tab = gpanel(content, (d - 1) * 174, WY(310, 56), 150, 56,
        active ? CA(PAL.gold, 0.95) : unlocked ? CA('#2A3240', 0.92) : CA('#20242C', 0.62), undefined, 0, 14);
      label(tab, 0, 0, unlocked ? DIFFS[d] : '🔒 ' + DIFFS[d], {
        size: 24, bold: true, color: active ? '#241C12' : unlocked ? '#E8E0C8' : '#6B7480', w: 150, h: 40,
      });
      tab.on(Node.EventType.TOUCH_END, () => {
        if (!unlocked) { toast('通关上一难度解锁'); return; }
        if (st.d !== d) { st.d = d; render(); }
      });
    }

    /* 关卡大图 + 图内左右切关（无边框圆形箭头板） */
    const scene = gpanel(content, 0, WY(384, 540), 550, 540, CA('#2E4034', 0.85), undefined, 0, 18);
    artSprite(scene, 0, 0, 550, 540, 'scenes/scene_' + lv.id.replace('-', '_'), { belowIdx: 0, cover: true });
    if (open) {
      label(scene, 0, -240, `${lv.desc} · ${DIFFS[st.d]}`, {
        size: 24, color: '#EAF2E0', w: 500, h: 34, shrink: true, outline: '#1C2A18', outlineW: 3,
      });
    } else {
      label(scene, 0, 16, '🔒 未解锁', { size: 30, color: '#EAF2E0', bold: true, w: 500, h: 40, outline: '#1C2A18', outlineW: 3 });
      label(scene, 0, -24, `通关 ${LEVELS[st.i - 1].id} 解锁`, { size: 20, color: '#C9D8BC', w: 500, h: 30, outline: '#1C2A18', outlineW: 2 });   // 上一关（用户调整：按当前关动态显示，而非恒 1-1）
    }
    for (const dx of [-205, 205]) {
      circleArrow(scene, dx, 0, dx < 0 ? -1 : 1, () => {
        st.i = (st.i + (dx < 0 ? LEVELS.length - 1 : 1)) % LEVELS.length;
        while (st.d > 0 && !diffUnlocked(st.i, st.d)) st.d--;
        render();
      });
    }
    if (st.i === 0 && !sv.stars['1-1']) {
      const nb = gpanel(content, 220, WY(404, 30), 70, 30, CA('#E5484D', 0.95), undefined, 0, 8);
      label(nb, 0, 0, 'NEW', { size: 16, color: '#FFFFFF', bold: true });
    }

    /* 星箱区背板 + 达星进度条（按当前难度；进度条穿在三张卡后面连接宝箱——老版式） */
    artPanel(content, 0, WY(954, 200), 690, 200, 'ui_panel_zone');
    gbar(content, 0, WY(1003, 14), 470, 14, PAL.gold).set(stars / 3);

    /* 三档星箱（无边框，可领取亮徽记红点；不写具体奖励——用户确认） */
    const chests = [
      { icon: '📦' },
      { icon: '🎁' },
      { icon: '💎' },
    ];
    for (let t = 0; t < 3; t++) {
      const tier = t + 1;
      const canClaim = stars >= tier && claimed < tier;
      const done = claimed >= tier;
      const card = gpanel(content, (t - 1) * 235, WY(968, 156), 215, 156, CA('#14181E', 0.92), undefined, 0, 12);
      const ic = gpanel(card, 0, 42, 68, 68, canClaim ? CA('#F0C060', 0.3) : CA('#10151D', 0.8), undefined, 0, 12);
      label(ic, 0, 0, done ? '✅' : chests[t].icon, { size: 36 });
      if (canClaim) gpanel(card, 28, 70, 16, 16, CA('#E5484D', 1), undefined, 0, 8);
      label(card, 0, -28, CHEST_COND[tier - 1], { size: 18, color: done ? '#6B7480' : '#E8E0C8', w: 200, h: 26 });
      if (canClaim) {
        card.on(Node.EventType.TOUCH_END, () => {
          const r = claimChest(key, stars, tier);
          toast(r.msg);
          if (r.ok) ctx.refresh();
        });
      }
    }

    /* 开始战斗（扁平无框——用户确认）；空编队拦截 */
    if (open) {
      btn(content, 0, WY(1166, 80), 500, 80, '⚔ 开 始 战 斗', PAL.green, () => {
        if (!squadList().length) { toast('请先上阵英雄'); return; }
        flow.mode = 'battle';
        flow.levelId = lv.id;
        flow.diff = st.d;
        director.loadScene('Main');
      }, 30, true);
    } else {
      btn(content, 0, WY(1166, 80), 500, 80, `🔒 通关 ${LEVELS[st.i - 1].id} 解锁`, '#5A6472', () => {}, 24, true);   // 上一关（用户调整：按当前关动态显示）
    }

    /* 编队按钮（用户红框指定：开始战斗右下方；二级编队界面） */
    btn(content, 245, WY(1322, 80), 240, 80, '编 队', PAL.gold, () => openSquadPanel(ctx), 28, true);
  }
}
