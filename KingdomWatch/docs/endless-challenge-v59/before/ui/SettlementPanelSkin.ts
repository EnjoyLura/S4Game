/** Shared feathered battle receipts, with the original victory/defeat heraldry. */
import { Node } from 'cc';
import { LO } from '../config/GameConfig';
import { label, N } from './UIKit';
import { artSprite } from './Ux';
import { battleArtSprite } from './BattlePanelSkin';
import { COMIC, comicButtonControl } from './ComicUI';
import { StageLootSummary } from '../core/StageLoot';
import { showCollectedLoot } from './LevelLootPreview';
import { SettlementMotion } from './SettlementMotion';
import { battleRewardPanel } from './BattleRewardPanel';

const ART = 'settlement_comic_v1/';
type Outcome = 'win' | 'lose';
type Tone = 'gold' | 'green' | 'teal' | 'muted';

export function settlementFrame(parent: Node, outcome: Outcome, level: string, stars = 0, ratio = 0, animate = false): Node {
  const root = N('settlement:' + outcome, parent);
  const scale = Math.min(1, Math.max(.1, (LO.half * 2 - LO.safeTop - LO.safeBottom - 56) / 900));
  root.setScale(scale, scale, 1);
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

export function settlementRewards(parent: Node, outcome: Outcome, gold: number, diamonds: number, note: string, loot?: StageLootSummary,
  animation: { intro?: boolean; goldFrom?: number } = {}): void {
  battleRewardPanel(parent, {
    top: 122, heading: outcome === 'win' ? '通关奖励' : '已获得奖励', gold, diamonds, loot, note,
    onInspect: loot ? () => showCollectedLoot(parent.parent || parent, loot) : undefined,
    onCounter: (kind, number, target) => parent.getComponent(SettlementMotion)?.addReward(number, target,
      !!animation.intro || (kind === 'gold' && animation.goldFrom !== undefined && animation.goldFrom !== gold),
      kind === 'gold' ? animation.goldFrom || 0 : 0),
  });
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
