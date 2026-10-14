/** Victory/defeat artwork and a compact centered layout, independent of pause geometry. */
import { Node, Sprite } from 'cc';
import { LO } from '../config/GameConfig';
import { DamageRow, fmtWk } from '../battle/DamageService';
import { C, gpanel, label, N, setText } from './UIKit';
import { artSprite } from './Ux';
import { battleArtIcon, battleArtSprite } from './BattlePanelSkin';
import { battleProgressBar } from './BattleProgressBar';
import { pauseTabFace } from './PausePanelSkin';

const ART = 'settlement_comic_v1/';
type Outcome = 'win' | 'lose';
type Tone = 'gold' | 'green' | 'teal' | 'muted';

export function settlementFrame(parent: Node, outcome: Outcome, level: string, stars = 0, ratio = 0): Node {
  const root = N('settlement:' + outcome, parent);
  const scale = Math.min(1, Math.max(.1, (LO.half * 2 - LO.safeTop - LO.safeBottom - 56) / 900));
  root.setScale(scale, scale, 1);
  const body = gpanel(root, 0, -42, 660, 320, outcome === 'win' ? '#463426' : '#263749', undefined, 0, 14);
  body.name = 'settlementBody';
  artSprite(body, 0, 0, 660, 320, ART + 'panel_' + outcome, { belowIdx: 0 });
  const width = 590, source = outcome === 'win' ? [1036, 355, 0, -64.5] : [953, 328, -.5, -66];
  const k = width / source[0];
  artSprite(root, 0, 350, width, source[1] * k, ART + 'badge_' + outcome, { sliced: false });
  label(root, source[2] * k, 350 + source[3] * k, outcome === 'win' ? '挑战成功！' : '挑战失败', {
    size: 36, font: 'title', color: outcome === 'win' ? '#3D2910' : '#F2F6FF',
    bold: true, w: 330, h: 52, shrink: true, outline: outcome === 'win' ? '#FFE896' : '#253C5E', outlineW: 1.4,
  });
  if (outcome === 'win') {
    for (let i = 0; i < 3; i++) {
      const host = N('settlementStar:' + i, root, (i - 1) * 72, 225, 58, 58), lit = i < stars;
      const fallback = label(host, 0, 0, '★', { size: 48, color: lit ? '#FFD24F' : '#71808D' });
      battleArtSprite(host, 0, 0, 58, 58, lit ? 'ui_star' : 'ui_star_gray', { sliced: false, hideOnLoad: [fallback] });
    }
  }
  label(root, 0, outcome === 'win' ? 178 : 214, level, {
    size: 22, color: outcome === 'win' ? '#FFECA3' : '#DAE8FF', bold: true, w: 620, h: 30, shrink: true,
  });
  label(root, 0, outcome === 'win' ? 148 : 178,
    outcome === 'win' ? '剩余耐久 ' + Math.round(ratio * 100) + '%' : '保底奖励 30% · 可复活继续本局',
    { size: 17, color: outcome === 'win' ? '#E4D6B7' : '#BFCFDE', w: 620, h: 25, shrink: true });
  return root;
}

export function settlementTabs(parent: Node, active: number, onSelect: (tab: number) => void): void {
  ['奖励总览', '伤害统计'].forEach((text, index) => {
    const segment = gpanel(parent, (index - .5) * 302, 88, 302, 46, index === active ? '#F2B23E' : '#5A6472', undefined, 0, 10);
    segment.name = 'settlementTab:' + index;
    label(segment, 0, 0, text, { size: 22, bold: true, color: index === active ? '#302719' : '#EFF3F7', w: 280, h: 42 });
    pauseTabFace(segment, index, 2, 302, 46, index === active);
    if (index !== active) segment.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
      e.propagationStopped = true; onSelect(index);
    });
  });
}

export function settlementRewards(parent: Node, outcome: Outcome, gold: number, xp: number, note: string): void {
  label(parent, 0, 32, outcome === 'win' ? '通关奖励' : '已获得奖励 · 保底30%', {
    size: 21, color: outcome === 'win' ? '#FFECA3' : '#D9E7FB', bold: true, w: 580, h: 30,
  });
  [['金币', 'ui_icon_coin', gold], ['经验', 'ui_icon_exp', xp]].forEach((item, index) => {
    const card = gpanel(parent, (index - .5) * 292, -70, 246, 144, '#28313A', undefined, 0, 10);
    artSprite(card, 0, 0, 246, 144, ART + 'card_' + outcome, { belowIdx: 0 });
    label(card, 0, 48, String(item[0]), { size: 17, color: '#E9E4D5', w: 200, h: 22 });
    battleArtIcon(card, String(item[1]), 64);
    label(card, 0, -49, String(item[2]), { size: 25, font: 'number', color: '#FFFFFF', bold: true, w: 204, h: 30, shrink: true });
  });
  label(parent, 0, -178, note, { size: 16, color: '#C4C9CA', w: 594, h: 28, shrink: true });
}

export function settlementStats(parent: Node, rows: DamageRow[]): void {
  const shown = rows.slice(0, 5), leader = Math.max(1, ...rows.map(row => row.val));
  const pitch = Math.min(55, 225 / Math.max(1, shown.length));
  shown.forEach((row, index) => {
    const y = 26 - index * pitch, avatar = N('settlementHero:' + row.id, parent, -270, y, 42, 42);
    const fallback = label(avatar, 0, 0, row.name.slice(0, 1), { size: 25, color: '#FFE27A', bold: true });
    battleArtSprite(avatar, 0, 0, 42, 42, 'ui_avatar_' + row.id, { sliced: false, hideOnLoad: [fallback] });
    label(parent, -76, y + 8, row.name, { size: 17, color: '#FFFFFF', align: 'left', w: 296, h: 25, shrink: true });
    label(parent, 235, y + 8, fmtWk(row.val), { size: 20, font: 'number', color: '#FFE27A', align: 'right', w: 140, h: 25, shrink: true });
    label(parent, 235, y - 10, (row.pct * 100).toFixed(2) + '%', { size: 11, font: 'number', color: '#BAC5CD', align: 'right', w: 140, h: 13 });
    const bar = battleProgressBar(parent, 39, y - 24, 528, 8, 'damage');
    bar.set(row.val > 0 ? row.val / leader : 0);
    if (index === 0 && row.val > 0) {
      const tag = gpanel(parent, -270, y + 26, 52, 16, '#F5C85C', undefined, 0, 3);
      label(tag, 0, 0, 'MVP', { size: 12, font: 'number', color: '#483515', bold: true, w: 50, h: 16 });
    }
  });
}

export interface SettlementButton { node: Node; setText: (text: string) => void; setEnabled: (enabled: boolean) => void; }
export function settlementButton(parent: Node, x: number, y: number, w: number, h: number,
  text: string, tone: Tone, onClick: () => void, enabled = true, name = ''): SettlementButton {
  const node = gpanel(parent, x, y, w, h, tone === 'green' ? '#65B441' : tone === 'gold' ? '#FFC848' : tone === 'teal' ? '#269DAB' : '#5A6472', undefined, 0, 12);
  node.name = name || 'settlementButton:' + tone;
  const caption = label(node, 0, 0, text, { size: 24, bold: true, color: tone === 'teal' || tone === 'muted' ? '#F3FFFA' : '#302719', w: w - 32, h: h - 8, shrink: true,
    outline: tone === 'teal' ? '#1C6269' : undefined, outlineW: 1 });
  let sprite: Sprite | null = null, pressed = false;
  const apply = (): void => { if (sprite) sprite.color = C(!enabled ? '#A7ADB2' : pressed ? '#D3D3D3' : '#FFFFFF'); };
  const id = tone === 'gold' || tone === 'green' ? 'pause_comic_v1/button_' + tone : ART + 'button_' + tone;
  artSprite(node, 0, 0, w, h, id, { belowIdx: 0, onLoaded: art => { sprite = art.getComponent(Sprite); apply(); } });
  node.on(Node.EventType.TOUCH_START, () => { pressed = enabled; apply(); });
  node.on(Node.EventType.TOUCH_CANCEL, () => { pressed = false; apply(); });
  node.on(Node.EventType.TOUCH_END, (e: { propagationStopped?: boolean }) => {
    e.propagationStopped = true; pressed = false; apply(); if (enabled) onClick();
  });
  return { node, setText: value => setText(caption, value), setEnabled: value => { enabled = value; pressed = false; apply(); } };
}
