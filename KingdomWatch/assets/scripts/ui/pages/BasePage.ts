/**
 * ⑤ 基地（线稿 base）：等距场景占位 + 主城（升级加耐久/盾）+ 研究院（怪物图鉴弹窗）+ 锁定建筑占位
 */
import { Mask, ScrollView, UITransform } from 'cc';
import { CA, btn, C, gcircle, gpanel, label, N, WY, WX } from '../UIKit';
import { artSprite } from '../Ux';
import { PageCtx, modal, toast, fmt, CX } from '../PageKit';
import { zoneTab } from './UpgradePage';
import { PAL } from '../../config/GameConfig';
import { CODEX, CODEX_REWARD, claimCodexReward, codexClaimed, codexUnlocked, keepHp, keepShield, keepUpCost, upKeep, MAX } from '../../core/GameData';
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
    if (sv.gold >= cost) gpanel(act, 263, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);   // 红点=金币够升（用户反馈）
  } else {
    label(act, 0, 0, '已达等级上限', { size: 22, color: '#AAB2BD' });
  }
}

/* ---------- 研究院：怪物图鉴弹窗（扁平无框；两列卡片可滑动查看全部，未领奖励带红点） ---------- */
function codexModal(ctx: PageCtx): void {
  const panel = modal(ctx, 620, 760, '研究院 · 怪物图鉴', true);
  label(panel, 0, 290, '关卡内遭遇怪物解锁图鉴 · 首次查看可领钻石奖励', { size: 18, color: '#8D96A3', w: 560, h: 28 });
  /* 可滑动卡片区（滚动视图，怪物增多后超出即滚） */
  const VIEW_H = 570, CARD_H = 150, GAP = 16, PAD = 16;
  const rows = Math.ceil(CODEX.length / 2);
  const stackH = rows * CARD_H + (rows - 1) * GAP;
  const contentH = Math.max(stackH + PAD * 2, VIEW_H);
  const off = contentH > VIEW_H ? PAD : (VIEW_H - stackH) / 2;
  const view = N('cxView', panel, 0, (270 + -340) / 2, 560, VIEW_H);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const ct = N('cxContent', view, 0, VIEW_H / 2, 560, contentH);
  ct.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
  scroll.content = ct;
  scroll.horizontal = false;
  scroll.vertical = true;
  CODEX.forEach((c, i) => {
    const got = codexUnlocked(c.id);
    const cell = gpanel(ct, i % 2 === 0 ? -142 : 142, -(off + Math.floor(i / 2) * (CARD_H + GAP) + CARD_H / 2), 265, CARD_H,
      got ? CA('#E9DFC2', 0.94) : CA('#D8CBA8', 0.9), undefined, 0, 12);
    label(cell, 0, 28, got ? c.icon : '❓', { size: 44 });
    label(cell, 0, -26, got ? c.name : '???', { size: 20, color: got ? INK : '#6B5A3A', bold: true, w: 240, h: 28, shrink: true });
    label(cell, 0, -56, got ? '点开词条 ▶' : '未解锁', { size: 16, color: got ? OK : '#8A7A5C', w: 240, h: 24 });
    if (got && !codexClaimed(c.id)) gpanel(cell, 112, 62, 18, 18, CA('#E5484D', 1), undefined, 0, 9);
    if (got) cell.on(NodeClick(), () => codexDetail(ctx, c.id));
  });
}

/* ---------- 怪物词条详情（参考图版式：大图标 + 名称 + 标签 + 描述/弱点分区 + 首览奖励领取） ---------- */
function codexDetail(ctx: PageCtx, id: string): void {
  const c = CODEX.find(x => x.id === id)!;
  const W = 620, H = 660, PW = 560;
  const panel = modal(ctx, W, H, '', true);
  /* 大图标 + 名称 + 两枚标签（体型/定位，绿/蓝小圆角板） */
  gcircle(panel, 0, H / 2 - 120, 62, CA('#2A3240', 1));
  label(panel, 0, H / 2 - 120, c.icon, { size: 60 });
  label(panel, 0, H / 2 - 210, c.name, { size: 30, color: '#FFF3D6', bold: true, w: 500, h: 40 });
  const tags: [string, string][] = [[c.tags[0], '#3E7C28'], [c.tags[1], '#1F6BC4']];
  tags.forEach((t, i) => {
    const px = i === 0 ? -80 : 80;
    gpanel(panel, px, H / 2 - 268, 130, 44, CA(t[1], 0.95), undefined, 0, 22);
    label(panel, px, H / 2 - 268, t[0], { size: 19, color: '#FFF3D6', bold: true, w: 130, h: 44 });
  });
  /* 怪物描述 / 弱点（奶白分区板 + 金签出板） */
  const p1Top = H / 2 - 306;
  const p1 = gpanel(panel, 0, p1Top - 55, PW, 110, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p1Top + 17, '怪物描述');
  label(p1, 0, 0, c.desc, { size: 19, color: INK, w: 500, h: 70, shrink: true });
  const p2Top = p1Top - 110 - 44;
  const p2 = gpanel(panel, 0, p2Top - 44, PW, 88, CA('#E9DFC2', 0.94), undefined, 0, 12);
  zoneTab(panel, -PW / 2 + 70, p2Top + 17, '弱点');
  label(p2, 0, 0, c.weak, { size: 20, color: INK, bold: true, w: 500, h: 40, shrink: true });
  /* 行动条：首览奖励（💎 +20钻）+ 领取/已领取 */
  const actCy = -H / 2 + 46;
  const act = gpanel(panel, 0, actCy, PW, 64, CA('#14181E', 0.72), undefined, 0, 32);
  gcircle(act, -212, 0, 24, CA(PAL.blue, 0.25));
  label(act, -212, 0, '💎', { size: 24 });
  label(act, -128, 0, `+${CODEX_REWARD} 钻`, { size: 22, color: '#CFE3FF', bold: true, align: 'left', w: 120, h: 48, shrink: true });
  const claimed = codexClaimed(c.id);
  if (!claimed) {
    btn(act, 195, 0, 160, 54, '领 取', PAL.gold, () => {
      const r = claimCodexReward(id);
      toast(r.msg);
      if (r.ok) { const d = panel.parent; if (d) d.destroy(); }
    }, 24, true);
    gpanel(act, 263, 18, 24, 24, CA('#E5484D', 0.95), undefined, 0, 12);
  } else {
    label(act, 195, 0, '已领取', { size: 22, color: '#AAB2BD', w: 160, h: 40 });
  }
}
