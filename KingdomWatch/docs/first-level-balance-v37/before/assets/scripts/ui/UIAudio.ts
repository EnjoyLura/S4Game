/** One semantic UI cue per action, even when that action opens/closes another surface. */
import { Sfx } from '../core/Sfx';
import { resolveAudioCue, SfxName } from '../core/AudioCatalog';

export type UISound = 'tap' | 'select' | 'open' | 'close' | 'toggle' | 'confirm' | 'success' | 'warning' | 'reward' | 'upgrade'
  | 'growthTick' | 'growthLand' | 'rewardLand' | 'pickOpen' | 'pickRefresh' | 'pickChoose'
  | 'victory' | 'defeat' | 'breakthrough' | 'purchase' | 'recruit' | 'construction' | 'star' | 'starFinish';
const cues: Record<UISound, SfxName> = {
  tap: 'ui', select: 'uiSelect', open: 'uiOpen', close: 'uiClose', toggle: 'uiToggle', confirm: 'uiConfirm',
  success: 'uiConfirm', warning: 'ui', reward: 'reward', upgrade: 'growth',
  growthTick: 'growthTick', breakthrough: 'breakthrough', purchase: 'purchase', recruit: 'recruit', construction: 'construction', star: 'star', starFinish: 'starFinish',
  growthLand: 'growthLand', rewardLand: 'rewardLand', pickOpen: 'pickOpen', pickRefresh: 'pickRefresh', pickChoose: 'pickChoose',
  victory: 'victory', defeat: 'defeat',
};
const rank: Record<UISound, number> = { tap: 0, select: 1, open: 2, close: 2, toggle: 3, confirm: 4, success: 4, warning: 4,
  reward: 6, upgrade: 5, growthTick: 5, breakthrough: 7, purchase: 6, recruit: 7, construction: 7, star: 5, starFinish: 5,
  growthLand: 3, rewardLand: 3, pickOpen: 5, pickRefresh: 5, pickChoose: 6, victory: 8, defeat: 8 };
let pending: UISound | null = null;
let scheduled = false;
let lastRequestAt = -Infinity;

/** Fill silent component/blank-space taps after Cocos has handled the gesture.
 * DOM pointer-up may precede Cocos' mouse-up, so a microtask is too early here.
 * Existing button/selection/result sounds own the same gesture and suppress this fallback.
 */
export function queueTapSound(available: () => boolean): () => void {
  const releasedAt = performance.now();
  const timer = setTimeout(() => {
    if (!available() || lastRequestAt >= releasedAt - 100) return;
    uiSound('tap');
  }, 32);
  return () => clearTimeout(timer);
}

export function uiSound(kind: UISound): void {
  // A silent decoration must not swallow an action's actual click/success cue.
  if (!resolveAudioCue(cues[kind])) return;
  lastRequestAt = performance.now();
  if (!pending || rank[kind] >= rank[pending]) pending = kind;
  if (scheduled) return;
  scheduled = true;
  void Promise.resolve().then(() => {
    const cue = pending;
    pending = null; scheduled = false;
    if (cue) Sfx.play(cues[cue]);
  });
}
