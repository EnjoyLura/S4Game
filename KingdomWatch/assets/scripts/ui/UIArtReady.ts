/** Track artwork requested while a surface is built, independently of its visibility. */
import { isValid, Mask, Node, Rect, UITransform } from 'cc';

const loading = new WeakMap<Node, Promise<void>>();
const surfaces = new WeakMap<Node, Set<Promise<void>>>();

/** Use the mask's own rect; getBoundingBoxToWorld also includes offscreen children. */
function ownBounds(node: Node): Rect | null {
  const transform = node.getComponent(UITransform);
  if (!transform || !transform.width || !transform.height) return null;
  return new Rect(-transform.anchorX * transform.width, -transform.anchorY * transform.height,
    transform.width, transform.height).transformMat4(node.worldMatrix);
}

/** Hidden animation shells still need their art. Only actual clipping excludes a request. */
export function uiArtInView(node: Node, margin = 0): boolean {
  const bounds = ownBounds(node);
  if (!bounds) return true;
  for (let parent = node.parent; parent; parent = parent.parent) {
    const mask = parent.getComponent(Mask);
    if (!mask?.enabled || mask.inverted) continue;
    const clip = ownBounds(parent);
    if (clip && (bounds.xMax < clip.xMin - margin || bounds.xMin > clip.xMax + margin
      || bounds.yMax < clip.yMin - margin || bounds.yMin > clip.yMax + margin)) return false;
  }
  return true;
}

/** A parent surface must also wait for nested refreshes to finish their draw handoff. */
export function trackUISurface(node: Node): () => void {
  let complete!: () => void;
  const ready = new Promise<void>(resolve => { complete = resolve; });
  let requests = surfaces.get(node);
  if (!requests) { requests = new Set(); surfaces.set(node, requests); }
  requests.add(ready);
  return () => { requests!.delete(ready); complete(); };
}

export function trackUIArt(node: Node): () => void {
  let complete!: () => void;
  const ready = new Promise<void>(resolve => { complete = resolve; });
  loading.set(node, ready);
  return () => { loading.delete(node); complete(); };
}

/** Failed art also settles: the existing procedural fallback remains usable. */
export function whenUIArtReady(root: Node, done: () => void, buildingSurface?: Node, maxWaitMs = 8000): void {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    if (isValid(root, true)) done();
  };
  const wait = (): void => {
    if (finished) return;
    if (!isValid(root, true)) { finish(); return; }
    const requests: Promise<void>[] = [];
    const visit = (node: Node): void => {
      const request = loading.get(node);
      if (request && uiArtInView(node)) requests.push(request);
      if (node !== buildingSurface) surfaces.get(node)?.forEach(pending => requests.push(pending));
      node.children.forEach(visit);
    };
    visit(root);
    if (!requests.length) { finish(); return; }
    // Re-scan after settlement: an art callback or a newer navigation can add work.
    Promise.all(requests).then(wait);
  };
  // Network failures cannot keep modal input or a retained page locked forever.
  timer = setTimeout(finish, Math.max(0, maxWaitMs));
  wait();
}
