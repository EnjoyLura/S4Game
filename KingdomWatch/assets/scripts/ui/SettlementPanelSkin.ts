/** Shared lobby-paper settlement body, with the original victory/defeat heraldry. */
import { Graphics, Node } from 'cc';
import { LO } from '../config/GameConfig';
import { CA, label, N } from './UIKit';
import { artSprite } from './Ux';
import { battleArtIcon, battleArtSprite } from './BattlePanelSkin';
import { bindButton } from './ButtonFeedback';
import { COMIC, comicButtonControl, comicPlate } from './ComicUI';
import { StageLootSummary } from '../core/StageLoot';
import { gearArt } from './HeroComic';
import { itemName } from '../core/GameData';
import { showCollectedLoot } from './LevelLootPreview';
import { SettlementMotion } from './SettlementMotion';

const ART = 'settlement_comic_v1/';
type Outcome = 'win' | 'lose';
type Tone = 'gold' | 'green' | 'teal' | 'muted';

export function settlementFrame(parent: Node, outcome: Outcome, level: string, stars = 0, ratio = 0, animate = false): Node {
  const root = N('settlement:' + outcome, parent);
  const scale = Math.min(1, Math.max(.1, (LO.half * 2 - LO.safeTop - LO.safeBottom - 56) / 900));
  root.setScale(scale, scale, 1);
  comicPlate(root, 0, -42, 660, 320, 'paper', { name: 'settlementBody', cut: 14 });
  label(root, 0, 84, '奖励总览', { size: 25, color: COMIC.text, bold: true, w: 580, h: 34 });
  const divider = N('settlementRewardDivider', root).addComponent(Graphics);
  divider.strokeColor = CA(COMIC.sub, .26); divider.lineWidth = 1;
  divider.moveTo(-290, 60); divider.lineTo(290, 60); divider.stroke();
  const width = 590, source = outcome === 'win' ? [1036, 355, 0, -64.5] : [953, 328, -.5, -66];
  const k = width / source[0];
  const badge = N('settlementHeraldry:' + outcome, root, 0, 350);
  artSprite(badge, 0, 0, width, source[1] * k, ART + 'badge_' + outcome, { sliced: false });
  label(badge, source[2] * k, source[3] * k, outcome === 'win' ? '挑战成功！' : '挑战失败', {
    size: 36, font: 'title', color: outcome === 'win' ? '#3D2910' : '#F2F6FF',
    bold: true, w: 330, h: 52, shrink: true, outline: outcome === 'win' ? '#FFE896' : '#253C5E', outlineW: 1.4,
  });
  const starViews: { node: Node; earned: boolean }[] = [];
  if (outcome === 'win') {
    for (let i = 0; i < 3; i++) {
      const host = N('settlementStar:' + i, root, (i - 1) * 72, 225, 58, 58), lit = i < stars;
      const gray = label(host, 0, 0, '★', { size: 48, color: '#71808D' });
      battleArtSprite(host, 0, 0, 58, 58, 'ui_star_gray', { sliced: false, hideOnLoad: [gray] });
      const earned = N('settlementEarnedStar:' + i, root, (i - 1) * 72, 225, 58, 58);
      if (lit) {
        const fallback = label(earned, 0, 0, '★', { size: 48, color: '#FFD24F' });
        battleArtSprite(earned, 0, 0, 58, 58, 'ui_star', { sliced: false, hideOnLoad: [fallback] });
      }
      starViews.push({ node: earned, earned: lit });
    }
  }
  label(root, 0, outcome === 'win' ? 178 : 214, level, {
    size: 22, color: outcome === 'win' ? '#FFECA3' : '#DAE8FF', bold: true, w: 620, h: 30, shrink: true,
  });
  label(root, 0, outcome === 'win' ? 148 : 178,
    outcome === 'win' ? '剩余耐久 ' + Math.round(ratio * 100) + '%' : '保底奖励 30% · 可复活继续本局',
    { size: 17, color: outcome === 'win' ? '#E4D6B7' : '#BFCFDE', w: 620, h: 25, shrink: true });
  root.addComponent(SettlementMotion).configure(outcome, badge, starViews, animate);
  return root;
}

export function playSettlement(root: Node): void { root.getComponent(SettlementMotion)?.play(); }

export function settlementRewards(parent: Node, outcome: Outcome, gold: number, xp: number, note: string, loot?: StageLootSummary,
  animation: { intro?: boolean; goldFrom?: number } = {}): void {
  const compact = !!(loot && (loot.materials.length || loot.equipment.length));
  label(parent, 0, compact ? 39 : 32, outcome === 'win' ? '本局累计金币已到账' : '金币保底30% · 已到账', {
    size: 21, color: COMIC.text, bold: true, w: 580, h: 30,
  });
  [['金币', 'ui_icon_coin', gold], ['本局经验', 'ui_icon_exp', xp]].forEach((item, index) => {
    const card = comicPlate(parent, (index - .5) * 292, compact ? -36 : -70, 246, compact ? 100 : 144, 'card',
      { name: 'settlementReward:' + index, cut: 9 });
    label(card, 0, compact ? 32 : 48, String(item[0]), { size: 17, color: COMIC.sub, w: 200, h: 22 });
    battleArtIcon(card, String(item[1]), compact ? 32 : 64);
    const number = label(card, 0, compact ? -33 : -49, String(item[2]), { size: compact ? 22 : 25, font: 'number', color: COMIC.text, bold: true, w: 204, h: 28, shrink: true });
    number.name = index ? 'settlementXpNumber' : 'settlementGoldNumber';
    parent.getComponent(SettlementMotion)?.addReward(number, Number(item[2]), !!animation.intro
      || (!index && animation.goldFrom !== undefined && animation.goldFrom !== gold), index ? 0 : animation.goldFrom || 0);
  });
  if (compact && loot) {
    const rows = loot.materials.map(row => ({ id: row.id, text: itemName(row.id) + ' ×' + row.n }));
    if (loot.equipment.length) rows.push({ id: loot.equipment[0].defId, text: '装备 ×' + loot.equipment.length + ' ›' });
    const n = rows.length, pitch = Math.min(144, 592 / n);
    rows.forEach((row, i) => {
      const card = comicPlate(parent, (i - (n - 1) / 2) * pitch, -124, pitch - 6, 64, 'card', { cut: 6 });
      gearArt(card, 0, 9, 31, 31, row.id);
      label(card, 0, -20, row.text, { size: 15, color: COMIC.text, w: pitch - 12, h: 22, shrink: true });
      bindButton(card, () => showCollectedLoot(parent.parent || parent, loot), { sound: false, scale: .96 });
    });
  }
  label(parent, 0, -178, note, { size: 16, color: COMIC.sub, w: 594, h: 28, shrink: true });
}

export interface SettlementButton { node: Node; setText: (text: string) => void; setEnabled: (enabled: boolean) => void; setBusy: (busy: boolean, text?: string) => void; }
export function settlementButton(parent: Node, x: number, y: number, w: number, h: number,
  text: string, tone: Tone, onClick: () => void, enabled = true, name = ''): SettlementButton {
  return comicButtonControl(parent, x, y, w, h, text, onClick, {
    tone: tone === 'teal' ? 'green' : tone, size: 24, enabled,
    color: tone === 'muted' ? COMIC.text : undefined,
    name: name || 'settlementButton:' + tone,
  });
}
