/** Shared native horizontal scrolling for both comic hero selectors. */
import { Mask, Node, ScrollView, UITransform, Vec2 } from 'cc';
import { N, WY } from './UIKit';

const positions = new Map<string, { offset: number; selected: string }>();
export const ROSTER_CARD_W = 144;
const WIDTH = 686, HEIGHT = 122, STEP = 156, PAD = 8;

export function heroRosterRail(parent: Node, top: number, key: string, ids: string[], selected: string,
  opts: { cardWidth?: number; step?: number; center?: boolean } = {}): {
  content: Node; cardWidth: number; x: (index: number) => number;
} {
  const cardWidth=opts.cardWidth ?? ROSTER_CARD_W, step=opts.step ?? STEP;
  const rowWidth=Math.max(0,ids.length-1)*step+cardWidth;
  const pad=opts.center ? Math.max(PAD,(WIDTH-rowWidth)/2) : PAD;
  const width = Math.max(WIDTH,pad*2+rowWidth);
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
    const index = Math.max(0, ids.indexOf(selected)), left = pad + index * step, right = left + cardWidth;
    if (left < offset + pad) offset = Math.max(0, left - pad);
    if (right > offset + WIDTH - pad) offset = Math.min(max, right - WIDTH + pad);
  }
  const state = { offset, selected };
  positions.set(key, state);
  view.on(ScrollView.EventType.SCROLLING, () => {
    if (positions.get(key) !== state) return;
    // Cocos reports horizontal content displacement as negative, unlike scrollToOffset.
    state.offset = Math.max(0, Math.min(max, -scroll.getScrollOffset().x));
  });
  scroll.scrollToOffset(new Vec2(offset, 0), 0);
  return { content, cardWidth, x: index => pad + cardWidth / 2 + index * step };
}
