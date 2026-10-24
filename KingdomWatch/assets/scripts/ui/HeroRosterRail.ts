/** Shared native horizontal scrolling for both comic hero selectors. */
import { director, Director, Graphics, isValid, Mask, Node, ScrollView, UITransform, Vec2 } from 'cc';
import { C, CA, N, WY } from './UIKit';
import { comicButton } from './ComicUI';
import { reducedMotion } from './UIMotion';
import { trackUISurface } from './UIArtReady';

const positions = new Map<string, { offset: number; selected: string }>();
export const ROSTER_CARD_W = 144;
const WIDTH = 686, HEIGHT = 122, STEP = 156, PAD = 8;

export function heroRosterRail(parent: Node, top: number, key: string, ids: string[], selected: string,
  opts: { cardWidth?: number; step?: number; center?: boolean } = {}): {
  content: Node; cardWidth: number; x: (index: number) => number;
} {
  const cardWidth=opts.cardWidth ?? ROSTER_CARD_W, step=opts.step ?? STEP;
  const rowWidth = ids.length ? (ids.length - 1) * step + cardWidth : 0;
  const overflowing = rowWidth + PAD * 2 > WIDTH;
  // Give navigation its own gutters and leave the next portrait partly visible.
  const viewWidth = WIDTH - (overflowing ? 64 : 0);
  const pad=opts.center ? Math.max(PAD,(viewWidth-rowWidth)/2) : PAD;
  const width = Math.max(viewWidth,pad*2+rowWidth), y = WY(top - 4, HEIGHT);
  const view = N(key + 'Rail', parent, 0, y, viewWidth, HEIGHT);
  view.addComponent(Mask);
  const scroll = view.addComponent(ScrollView);
  const content = N(key + 'Cards', view, -viewWidth / 2, 0, width, HEIGHT);
  content.getComponent(UITransform)!.setAnchorPoint(0, .5);
  scroll.content = content; scroll.horizontal = overflowing; scroll.vertical = false;
  scroll.inertia = true; scroll.brake = .55; scroll.elastic = true; scroll.bounceDuration = .22;
  scroll.cancelInnerEvents = true;
  const max = Math.max(0, width - viewWidth), prior = positions.get(key);
  let offset = Math.max(0, Math.min(max, prior?.offset ?? 0));
  if (ids.includes(selected)) {
    const index = Math.max(0, ids.indexOf(selected)), left = pad + index * step, right = left + cardWidth;
    if (left < offset + pad) offset = Math.max(0, left - pad);
    if (right > offset + viewWidth - pad) offset = Math.min(max, right - viewWidth + pad);
  }
  const state = { offset, selected };
  positions.set(key, state);
  const positionReady = trackUISurface(view);
  let initialized = false;
  let leftArrow: Node | null = null, rightArrow: Node | null = null, thumb: Node | null = null;
  const trackW = 148, thumbW = Math.max(18, trackW * viewWidth / width);
  const sync = (): void => {
    if (leftArrow) leftArrow.active = state.offset > 1;
    if (rightArrow) rightArrow.active = state.offset < max - 1;
    if (thumb) thumb.setPosition(-trackW / 2 + thumbW / 2 + (trackW - thumbW) * (max ? state.offset / max : 0), 0);
  };
  if (overflowing) {
    const arrow = (direction: -1 | 1): Node => {
      const button = comicButton(parent, direction * 329, y + 8, 32, 48, '', () => {
        if (!initialized) return;
        scroll.stopAutoScroll();
        const next = Math.max(0, Math.min(max, state.offset + direction * viewWidth * .75));
        scroll.scrollToOffset(new Vec2(next, 0), reducedMotion() ? 0 : .22);
        if (reducedMotion()) { state.offset = next; sync(); }
      }, { tone: 'dark', name: key + (direction < 0 ? 'Previous' : 'Next'), sound: 'select' });
      const ink = N('heroRosterChevron', button.getChildByName('buttonFace')!).addComponent(Graphics);
      ink.strokeColor = C('#FFE1A0'); ink.lineWidth = 3;
      ink.moveTo(-direction * 4, 9); ink.lineTo(direction * 4, 0); ink.lineTo(-direction * 4, -9); ink.stroke();
      return button;
    };
    leftArrow = arrow(-1); rightArrow = arrow(1);
    const track = N(key + 'ScrollPosition', parent, 0, y - 58, trackW, 3);
    const base = track.addComponent(Graphics);
    base.fillColor = CA('#1C3545', .35); base.roundRect(-trackW / 2, -1.5, trackW, 3, 1.5); base.fill();
    thumb = N('heroRosterThumb', track, 0, 0, thumbW, 3);
    const ink = thumb.addComponent(Graphics);
    ink.fillColor = C('#F2CF7A'); ink.roundRect(-thumbW / 2, -1.5, thumbW, 3, 1.5); ink.fill();
    sync();
  }
  view.on(ScrollView.EventType.SCROLLING, () => {
    if (!initialized || positions.get(key) !== state) return;
    // Cocos reports horizontal content displacement as negative, unlike scrollToOffset.
    state.offset = Math.max(0, Math.min(max, -scroll.getScrollOffset().x));
    sync();
  });
  // Restore after callers have created every portrait and ScrollView has updated
  // its bounds, before the first draw or a retained-surface handoff can expose it.
  const restore = (): void => {
    if (isValid(view, true) && positions.get(key) === state) {
      scroll.scrollToOffset(new Vec2(offset, 0), 0);
      initialized = true; state.offset = offset; sync();
    }
    positionReady();
  };
  director.once(Director.EVENT_BEFORE_DRAW, restore);
  view.once(Node.EventType.NODE_DESTROYED, () => { director.off(Director.EVENT_BEFORE_DRAW, restore); positionReady(); });
  return { content, cardWidth, x: index => pad + cardWidth / 2 + index * step };
}
