/**
 * ⑤ 基地（线稿 base）：等距场景占位 + 主城（升级加耐久/盾）+ 研究院（怪物图鉴弹窗）+ 锁定建筑占位
 */
import { CA, btn, C, gpanel, label, N, WY, WX } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, toast, fmt, CX } from '../PageKit';
import { PAL } from '../../config/GameConfig';
import { CODEX, codexUnlocked, keepHp, keepShield, keepUpCost, upKeep, MAX } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';

export function buildBase(ctx: PageCtx): void {
  const root = ctx.screens;
  const sv = loadSave();

  /* 等距基地场景占位 */
  const bg = gpanel(root, 0, WY(90, 1122), 750, 1122, CA('#40503A', 0.5), CA('#8CB46E', 0.6), 1.5, 18);
  artSprite(bg, 0, 0, 750, 1122, 'bg_base_island', { belowIdx: 0, cover: true });
  label(bg, 0, 60, '奇幻风等距基地场景（浮空岛 · 占位）', { size: 20, color: '#A8BD97', w: 700, h: 30 });

  /* 主城（左上） */
  const keep = gpanel(root, CX(225, 300), WY(270, 300), 300, 300, CA('#3A2E23', 0.9), C(PAL.gold), 3, 20);
  artSprite(keep, 0, 0, 300, 300, 'building_keep', { belowIdx: 0 });
  label(keep, 0, -60, '🏰', { size: 84 });
  const dot = gpanel(keep, 108, -108, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
  void dot;
  keep.on(NodeClick(), () => keepModal(ctx));

  const plate1 = gpanel(root, CX(265, 220), WY(575, 56), 220, 56, CA('#14181E', 0.94), CA(PAL.gold, 0.9), 2, 12);
  label(plate1, 0, 0, `主城 Lv.${sv.keepLv} ▶`, { size: 22, color: '#FFE08A', bold: true, w: 200, h: 36 });
  plate1.on(NodeClick(), () => keepModal(ctx));

  /* 研究院（右下） */
  const lab = gpanel(root, CX(470, 240), WY(680, 220), 240, 220, CA('#1E2A3A', 0.9), C(PAL.blue), 3, 20);
  artSprite(lab, 0, 0, 240, 220, 'building_lab', { belowIdx: 0 });
  label(lab, 0, -40, '🔬', { size: 72 });
  const unlockedN = CODEX.filter(c => codexUnlocked(c.id)).length;
  if (unlockedN > 0) gpanel(lab, 92, -82, 26, 26, CA('#E5484D', 0.95), undefined, 0, 13);
  lab.on(NodeClick(), () => codexModal(ctx));
  const plate2 = gpanel(root, CX(500, 180), WY(905, 52), 180, 52, CA('#14181E', 0.94), CA(PAL.blue, 0.9), 2, 12);
  label(plate2, 0, 0, `研究院 ▶`, { size: 22, color: '#CFE3FF', bold: true, w: 160, h: 34 });
  plate2.on(NodeClick(), () => codexModal(ctx));

  /* 锁定建筑占位（工坊） */
  const lock = gpanel(root, CX(45, 220), WY(680, 220), 220, 220, CA('#10151D', 0.7), '#FFFFFF22', 2, 20);
  label(lock, 0, -30, '🏗️', { size: 60 });
  label(lock, 0, 40, '工坊 · 未开放', { size: 20, color: '#889099', w: 200, h: 30 });
  const plate3 = gpanel(root, CX(60, 190), WY(905, 52), 190, 52, CA('#14181E', 0.8), '#FFFFFF22', 2, 12);
  label(plate3, 0, 0, '🔒 未解锁', { size: 20, color: '#889099', w: 170, h: 34 });
}

function NodeClick(): string { return 'touch-end'; }

/* ---------- 主城升级弹窗 ---------- */
function keepModal(ctx: PageCtx): void {
  const sv = loadSave();
  const maxed = sv.keepLv >= MAX.keep;
  const cost = keepUpCost(sv.keepLv);
  const panel = modal(ctx, 590, 560, '主 城');
  label(panel, 0, 170, `等级 Lv.${sv.keepLv}${maxed ? '（MAX）' : ` → Lv.${sv.keepLv + 1}`}`, { size: 26, color: '#FFE08A', bold: true, w: 500, h: 40 });
  const rows: [string, string, string][] = [
    ['防线耐久', `1000 + 100/级`, `当前 ${keepHp(sv.keepLv)}${maxed ? '' : ` → ${keepHp(sv.keepLv + 1)}`}`],
    ['阶段盾量', `每 3 级 +200`, `当前 ${keepShield(sv.keepLv)}${maxed ? '' : ` → ${keepShield(sv.keepLv + 1)}`}`],
  ];
  rows.forEach((r, i) => {
    const y = 70 - i * 110;
    label(panel, -180, y, r[0], { size: 22, color: '#AAB2BD', align: 'left', w: 200, h: 32 });
    label(panel, 60, y - 26, r[1], { size: 18, color: '#8D96A3', align: 'right', w: 320, h: 28 });
    label(panel, 60, y + 8, r[2], { size: 21, color: '#FFF3D6', bold: true, align: 'right', w: 320, h: 32 });
  });
  if (!maxed) {
    gpanel(panel, -160, -140, 60, 60, CA(PAL.gold, 0.2), C(PAL.gold), 2, 30);
    label(panel, -160, -140, '🪙', { size: 30 });
    label(panel, -90, -140, fmt(cost), { size: 26, color: '#FFF3D6', bold: true, align: 'left', w: 150, h: 60 });
    btn(panel, 120, -135, 200, 90, '升 级', PAL.gold, () => {
      const r = upKeep();
      toast(r.msg);
      if (r.ok) { const d = panel.parent; if (d) d.destroy(); ctx.refresh(); }
    }, 26);
  } else {
    label(panel, 0, -140, '已达等级上限', { size: 24, color: '#8D96A3', w: 400, h: 40 });
  }
}

/* ---------- 研究院：怪物图鉴弹窗 ---------- */
function codexModal(ctx: PageCtx): void {
  const panel = modal(ctx, 620, 760, '研究院 · 怪物图鉴');
  label(panel, 0, 290, '战斗中首次遇到新怪物自动解锁词条', { size: 18, color: '#8D96A3', w: 560, h: 28 });
  CODEX.forEach((c, i) => {
    const got = codexUnlocked(c.id);
    const cell = gpanel(panel, -145 + (i % 2) * 290, 215 - Math.floor(i / 2) * 155, 270, 140,
      CA('#14181E', 0.92), got ? C('#4FA8FF') : C('#3A4250'), 2, 14);
    label(cell, -100, 34, got ? '👹' : '❓', { size: 44 });
    label(cell, 10, 34, got ? c.name : '???', { size: 21, color: got ? '#FFF3D6' : '#6B7480', bold: true, w: 170, h: 30, shrink: true });
    label(cell, 0, -34, got ? '点开词条 ▶' : '未解锁', { size: 17, color: got ? '#8FC' : '#5F6873', w: 240, h: 26 });
    if (got) cell.on(NodeClick(), () => codexDetail(ctx, c.id));
  });
}

function codexDetail(ctx: PageCtx, id: string): void {
  const c = CODEX.find(x => x.id === id)!;
  const panel = modal(ctx, 560, 520, c.name);
  gpanel(panel, 0, 130, 120, 120, CA('#2A3240', 1), C('#4FA8FF'), 2.5, 60);
  label(panel, 0, 130, '👹', { size: 56 });
  label(panel, 0, 20, c.desc, { size: 21, color: '#E8E0C8', w: 500, h: 110, shrink: true });
  const weak = gpanel(panel, 0, -120, 500, 90, CA('#3A2E23', 0.9), CA('#E5484D', 0.8), 2, 12);
  label(weak, 0, 18, '弱点', { size: 19, color: '#FFB0B3', bold: true, w: 460, h: 28 });
  label(weak, 0, -16, c.weak, { size: 21, color: '#FFE08A', bold: true, w: 460, h: 30 });
}
