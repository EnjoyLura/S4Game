/**
 * ⑤ 基地（线稿 base）：等距场景占位 + 主城（升级加耐久/盾）+ 研究院（怪物图鉴弹窗）+ 锁定建筑占位
 */
import { CA, btn, C, gcircle, gpanel, label, N, WY, WX } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, toast, fmt, CX } from '../PageKit';
import { zoneTab } from './UpgradePage';
import { PAL } from '../../config/GameConfig';
import { CODEX, codexUnlocked, keepHp, keepShield, keepUpCost, upKeep, MAX } from '../../core/GameData';
import { loadSave } from '../../core/SaveData';

const INK = '#4A3214', OK = '#3E7C28', NO = '#B03A2E';

export function buildBase(ctx: PageCtx): void {
  const root = ctx.screens;
  const sv = loadSave();

  /* 主城（左上）——无大背板（用户确认：建筑直接浮于场景） */
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

/* ---------- 主城升级弹窗（参照升级页弹窗版式：扁平无框 + 奶白分区板 + 深色行动条） ---------- */
function keepModal(ctx: PageCtx): void {
  const sv = loadSave();
  const maxed = sv.keepLv >= MAX.keep;
  const cost = keepUpCost(sv.keepLv);
  const W = 620, PW = 560, p1H = 120, H = p1H + 424;
  const panel = modal(ctx, W, H, '主城升级', true);
  /* 头部：方形底板图标 + 名称 + 等级行（与技能/装备弹窗同一几何） */
  gpanel(panel, -W / 2 + 66, H / 2 - 104, 88, 88, CA(PAL.gold, 0.3), undefined, 0, 12);
  label(panel, -W / 2 + 66, H / 2 - 104, '🏰', { size: 44 });
  label(panel, -W / 2 + 272, H / 2 - 96, '主 城', { size: 24, color: '#FFF3D6', bold: true, align: 'left', w: 300, h: 32, shrink: true });
  label(panel, -W / 2 + 272, H / 2 - 130, maxed ? `等级 Lv.${sv.keepLv}（MAX）` : `等级 Lv.${sv.keepLv} → Lv.${sv.keepLv + 1}`,
    { size: 18, color: '#FFE08A', bold: true, align: 'left', w: 310, h: 28, shrink: true });
  /* 属性提升（奶白板 + 标题出板；行结构与技能弹窗一致） */
  const p1Top = H / 2 - 184;
  const p1 = gpanel(panel, 0, p1Top - p1H / 2, PW, p1H, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p1Top + 17, '属性提升');
  const rows: [string, string, string | null][] = [
    ['防线耐久', String(keepHp(sv.keepLv)), maxed ? null : `+${keepHp(sv.keepLv + 1) - keepHp(sv.keepLv)}`],
    ['阶段盾量', String(keepShield(sv.keepLv)), maxed ? null : `+${keepShield(sv.keepLv + 1) - keepShield(sv.keepLv)}`],
  ];
  rows.forEach((r, i) => {
    const y = 16 - i * 32;
    label(p1, -PW / 2 + 90, y, r[0], { size: 22, color: INK, bold: true, align: 'left', w: 160, h: 30, shrink: true });
    label(p1, PW / 2 - 310, y, r[1], { size: 24, color: INK, bold: true, align: 'right', w: 140, h: 30, shrink: true });
    if (r[2]) label(p1, PW / 2 - 110, y, r[2], { size: 24, color: OK, bold: true, align: 'right', w: 160, h: 30, shrink: true });
  });
  /* 升级规则（奶白板，同「每级提升」结构） */
  const p2Top = p1Top - p1H - 44;
  const p2 = gpanel(panel, 0, p2Top - 44, PW, 88, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p2Top + 17, '升级规则');
  label(p2, -100, 16, '防线耐久 1000 + 100/级', { size: 20, color: INK, bold: true, align: 'left', w: 340, h: 30, shrink: true });
  label(p2, -100, -16, '阶段盾量 每 3 级 +200', { size: 20, color: INK, bold: true, align: 'left', w: 340, h: 30, shrink: true });
  /* 行动条（深色药丸 + 消耗 + 升级钮，扁平无框） */
  const actCy = -H / 2 + 46;
  const act = gpanel(panel, 0, actCy, PW, 64, CA('#14181E', 0.72), undefined, 0, 32);
  if (!maxed) {
    gcircle(act, -212, 0, 24, CA(PAL.gold, 0.22));
    label(act, -212, 0, '🪙', { size: 24 });
    label(act, -128, 0, fmt(cost), { size: 22, color: sv.gold >= cost ? OK : NO, bold: true, align: 'left', w: 100, h: 48, shrink: true });
    btn(act, 195, 0, 160, 54, '升 级', PAL.gold, () => {
      const r = upKeep();
      toast(r.msg);
      if (r.ok) { const d = panel.parent; if (d) d.destroy(); ctx.refresh(); }
    }, 24, true);
    gpanel(act, 263, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
  } else {
    label(act, 0, 0, '已达等级上限', { size: 22, color: '#AAB2BD' });
  }
}

/* ---------- 研究院：怪物图鉴弹窗（扁平无框；已解锁奶白卡、未解锁置灰——同步骤条未达卡） ---------- */
function codexModal(ctx: PageCtx): void {
  const panel = modal(ctx, 620, 760, '研究院 · 怪物图鉴', true);
  label(panel, 0, 290, '战斗中首次遇到新怪物自动解锁词条', { size: 18, color: '#8D96A3', w: 560, h: 28 });
  CODEX.forEach((c, i) => {
    const got = codexUnlocked(c.id);
    const cell = gpanel(panel, -145 + (i % 2) * 290, 160 - Math.floor(i / 2) * 155, 270, 140,
      got ? CA('#E9DFC2', 0.94) : CA('#D8CBA8', 0.9), undefined, 0, 12);
    label(cell, -100, 34, got ? '👹' : '❓', { size: 44 });
    label(cell, 10, 34, got ? c.name : '???', { size: 21, color: got ? INK : '#6B5A3A', bold: true, w: 170, h: 30, shrink: true });
    label(cell, 0, -34, got ? '点开词条 ▶' : '未解锁', { size: 17, color: got ? OK : '#8A7A5C', w: 240, h: 26 });
    if (got) cell.on(NodeClick(), () => codexDetail(ctx, c.id));
  });
}

function codexDetail(ctx: PageCtx, id: string): void {
  const c = CODEX.find(x => x.id === id)!;
  const panel = modal(ctx, 560, 520, c.name, true);
  gcircle(panel, 0, 130, 60, CA('#2A3240', 1));
  label(panel, 0, 130, '👹', { size: 56 });
  label(panel, 0, 20, c.desc, { size: 21, color: '#E8E0C8', w: 500, h: 110, shrink: true });
  const weak = gpanel(panel, 0, -120, 500, 90, CA('#E9DFC2', 0.94), undefined, 0, 12);
  label(weak, 0, 18, '弱点', { size: 19, color: NO, bold: true, w: 460, h: 28 });
  label(weak, 0, -16, c.weak, { size: 21, color: INK, bold: true, w: 460, h: 30 });
}
