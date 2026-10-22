/** One same-document history boundary makes mobile Back dismiss the top registered view first. */
import { _decorator, Component, Node } from 'cc';
const { ccclass } = _decorator;
type BackView = { owner: Node; close: () => void };
const views: BackView[] = [];
let installed = false, armed = false, token = 0;
const STATE_KEY = '__kingdomWatchOverlayBack';

function arm(): void {
  if (armed || typeof window === 'undefined') return;
  try {
    const state = window.history.state;
    window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), [STATE_KEY]: ++token }, '');
    armed = true;
  } catch (_) { /* Embedded hosts may not expose history; in-game close controls remain available. */ }
}

function pop(): void {
  if (!armed || window.history.state?.[STATE_KEY] === token) return;
  armed = false;
  while (views.length && !views[views.length-1].owner.isValid) views.pop();
  const top = views.pop();
  if (!top) return;
  // A confirmation nested inside the squad uses the same boundary, then restores it for its parent.
  if (views.length) arm();
  top.close();
}

@ccclass('BrowserBackLifetime')
class BrowserBackLifetime extends Component {
  release: (() => void) | null = null;
  onDestroy(): void { this.release?.(); this.release = null; }
}

export function bindBrowserBack(owner: Node, close: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!installed) { window.addEventListener('popstate', pop); installed = true; }
  const entry = { owner, close }; views.push(entry); arm();
  const release = (): void => {
    const index = views.indexOf(entry); if (index >= 0) views.splice(index,1);
  };
  owner.addComponent(BrowserBackLifetime).release = release;
  // Keep a single reusable boundary on button-close; repeated opens never accumulate history entries.
  return release;
}
