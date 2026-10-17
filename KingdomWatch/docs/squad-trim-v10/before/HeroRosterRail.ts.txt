/** Shared native horizontal scrolling for both comic hero selectors. */
import { Mask, Node, ScrollView, UITransform, Vec2 } from 'cc';
import { N, WY } from './UIKit';

const positions = new Map<string, { offset: number; selected: string }>();
export const ROSTER_CARD_W = 144;
const WIDTH = 686, HEIGHT = 122, STEP = 156, PAD = 8;

export function heroRosterRail(parent: Node, top: number, key: string, ids: string[], selected: string): {
  content: Node; x: (index: number) => number;
} {
  const width = Math.max(WIDTH, PAD * 2 + Math.max(0, ids.length - 1) * STEP + ROSTER_CARD_W);
  const view = N(key + 'Rail', parent, 0, WY(top - 4, HEIGHT), WIDTH, HEIGHT);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const content = N(key + 'Cards', view, -WIDTH / 2, 0, width, HEIGHT);
  content.getComponent(UITransform)!.setAnchorPoint(0, .5);
  scroll.content = content; scroll.horizontal = true; scroll.vertical = false;
  scroll.inertia = true; scroll.brake = .55; scroll.elastic = true; scroll.bounceDuration = .22;
  scroll.cancelInnerEvents = true;
  const max = Math.max(0, width - WIDTH), prior = positions.get(key);
  let offset = Math.max(0, Math.min(max, prior?.offset ?? 0));
  if (!prior || prior.selected !== selected) {
    const index = Math.max(0, ids.indexOf(selected)), left = PAD + index * STEP, right = left + ROSTER_CARD_W;
    if (left < offset + PAD) offset = Math.max(0, left - PAD);
    if (right > offset + WIDTH - PAD) offset = Math.min(max, right - WIDTH + PAD);
  }
  const state = { offset, selected };
  positions.set(key, state);
  view.on(ScrollView.EventType.SCROLLING, () => {
    if (positions.get(key) !== state) return;
    // Cocos reports horizontal content displacement as negative, unlike scrollToOffset.
    state.offset = Math.max(0, Math.min(max, -scroll.getScrollOffset().x));
  });
  scroll.scrollToOffset(new Vec2(offset, 0), 0);
  return { content, x: index => PAD + ROSTER_CARD_W / 2 + index * STEP };
}
