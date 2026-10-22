/** Actual battle receipts: feathered double rules, earned rewards, then collected equipment. */
import { Mask, Node, ScrollView, UITransform } from 'cc';
import { EQUIPS, HERO_DEFS, itemName } from '../core/GameData';
import { heroPortrait } from './HeroComic';
import { StageLootSummary } from '../core/StageLoot';
import { battleArtIcon } from './BattlePanelSkin';
import { bindButton } from './ButtonFeedback';
import { feedbackSurface } from './FeedbackSurface';
import { gearArt } from './HeroComic';
import { shopQualitySocket } from './LobbyChrome';
import { label, N } from './UIKit';

type Counter = 'gold' | 'xp';
interface RewardItem {
  id: string; name: string; amount: number; quality: number; counter?: Counter; hero?: boolean;
}
interface BattleRewardOptions {
  top: number; heading: string; gold: number; xp: number; note: string;
  loot?: StageLootSummary;
  onInspect?: () => void;
  onCounter?: (kind: Counter, node: Node, target: number) => void;
}

/** Keep every actual drop accessible. Extra types scroll horizontally instead of being discarded. */
function rewardRow(parent: Node, name: string, y: number, items: RewardItem[], side: number,
  onCounter?: BattleRewardOptions['onCounter'], onInspect?: () => void): void {
  const width = 600, pitch = 110, overflow = items.length * pitch > width;
  let content: Node;
  if (overflow) {
    const view = N(name + ':view', parent, 0, y - 10, width, 116);
    view.addComponent(Mask);
    const scroll = view.addComponent(ScrollView);
    content = N(name + ':content', view, -width / 2, 0, items.length * pitch, 116);
    content.getComponent(UITransform)!.setAnchorPoint(0, .5);
    scroll.content = content; scroll.horizontal = true; scroll.vertical = false;
    scroll.inertia = true; scroll.elastic = false; scroll.brake = .7; scroll.cancelInnerEvents = true;
  } else content = N(name, parent, 0, y);
  items.forEach((item, index) => {
    const x = overflow ? (index + .5) * pitch : (index - (items.length - 1) / 2) * pitch;
    const card = N(name + ':' + item.id, content, x, overflow ? 10 : 0, 104, 112);
    shopQualitySocket(card, 0, 0, side, item.quality);
    if (item.counter) {
      const art = N('battleRewardIcon:' + item.id, card);
      battleArtIcon(art, item.counter === 'gold' ? 'ui_icon_coin' : 'ui_icon_exp', side - 16);
    } else if (item.hero) heroPortrait(card, 0, 3, side - 16, item.id);
    else gearArt(card, 0, 3, side - 16, side - 16, item.id);
    const amount = label(card, 0, -side / 2 + 14, (item.counter ? '' : '×') + item.amount, {
      size: 24, font: 'number', color: '#FFFFFF', bold: true, align: 'right',
      w: side - 10, h: 30, shrink: true, outline: '#142431', outlineW: 2,
    });
    if (item.counter) {
      amount.name = item.counter === 'gold' ? 'settlementGoldNumber' : 'settlementXpNumber';
      onCounter?.(item.counter, amount, item.amount);
    }
    label(card, 0, -side / 2 - 15, item.name, {
      size: 17, color: '#F6EEDB', w: 106, h: 24, shrink: true,
    });
    if (onInspect) bindButton(card, onInspect, { sound: false, scale: .97, dragThreshold: 7 });
  });
}

/** Read-only presentation: no rolls, pickups, inventory writes, or reward transactions. */
export function battleRewardPanel(parent: Node, options: BattleRewardOptions): Node {
  const counts: Record<string, number> = {};
  for (const item of options.loot?.equipment || []) counts[item.defId] = (counts[item.defId] || 0) + 1;
  const equipment: RewardItem[] = Object.keys(counts).map(id => ({
    id, name: itemName(id), amount: counts[id], quality: EQUIPS[id]?.quality ?? 0,
  }));
  for (const id of options.loot?.heroes || []) if (HERO_DEFS[id]) equipment.push({
    id, name: '火法师 · 免费', amount: 1, quality: 3, hero: true,
  });
  const hasEquipment = equipment.length > 0;
  const height = hasEquipment ? 326 : 204;
  const panel = N('battleRewardPanel', parent, 0, options.top - height / 2, 750, height);
  feedbackSurface(panel, 'battleRewardFeather', 'feather', 0, 0, 750, height, '#263440', .76);
  for (const side of [-1, 1]) {
    feedbackSurface(panel, 'battleRewardOuterRule', 'line', 0, side * (height / 2 - 1), 750, 2.4, '#E7C98A', .82);
    feedbackSurface(panel, 'battleRewardInnerRule', 'line', 0, side * (height / 2 - 5.5), 750, 1.2, '#E7C98A', .44);
  }
  const y = (belowTop: number): number => height / 2 - belowTop;
  label(panel, 0, y(24), options.heading, { size: 25, color: '#FFE3A2', bold: true, w: 580, h: 34 });
  const earned: RewardItem[] = [
    { id: 'gold', name: '金币', amount: Math.max(0, Math.floor(options.gold)), quality: 2, counter: 'gold' },
    { id: 'xp', name: '本局经验', amount: Math.max(0, Math.floor(options.xp)), quality: 2, counter: 'xp' },
    ...(options.loot?.materials || []).filter(item => item.n > 0).map(item => ({
      id: item.id, name: itemName(item.id), amount: item.n, quality: 1,
    })),
  ];
  rewardRow(panel, 'earnedBattleRewards', y(87), earned, 76, options.onCounter);
  if (hasEquipment) {
    for (const side of [-1, 1]) feedbackSurface(panel, 'equipmentSectionRule', 'line', side * 238, y(170), 124, 1, '#A8B4B9', .32);
    // The section is created only for equipment actually collected in this battle.
    label(panel, 0, y(170), options.loot?.heroes?.length ? '首胜英雄 · 回营手动编队' : equipment.length > 5 ? '已获得装备 · 左右滑动' : '已获得装备', {
      size: 18, color: '#E4D2A9', w: 344, h: 26,
    });
    rewardRow(panel, 'collectedBattleEquipment', y(225), equipment, 72, undefined, options.onInspect);
  }
  label(panel, 0, -height / 2 + 20, options.note, {
    size: 16, color: '#CCD2D1', w: 594, h: 24, shrink: true,
  });
  return panel;
}
