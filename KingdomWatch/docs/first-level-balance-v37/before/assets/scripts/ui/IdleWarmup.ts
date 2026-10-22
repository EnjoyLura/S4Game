/** Background art must not compete with the visible surface's first load. */
import { isValid, Node } from 'cc';
import { whenUIArtReady } from './UIArtReady';

const versions = new WeakMap<Node, number>();

/** A newer render supersedes the old job; hidden tabs do not start new downloads. */
export function deferUIWarmup(owner: Node, work: () => void, delayMs = 1200): void {
  const version = (versions.get(owner) || 0) + 1;
  versions.set(owner, version);
  const current = (): boolean => isValid(owner, true) && versions.get(owner) === version;
  const run = (): void => {
    if (!current()) return;
    if (typeof document !== 'undefined' && document.hidden) { setTimeout(run, 1000); return; }
    // Exclude the surface's own handoff promise, which is waiting for these same images.
    whenUIArtReady(owner, () => {
      if (!current()) return;
      if (typeof document !== 'undefined' && document.hidden) { setTimeout(run, 1000); return; }
      work();
    }, owner);
  };
  setTimeout(() => {
    if (!current()) return;
    whenUIArtReady(owner, () => { if (current()) setTimeout(run, 350); }, owner);
  }, delayMs);
}
