/** Track artwork requested while a surface is built, independently of its visibility. */
import { isValid, Node } from 'cc';

const loading = new WeakMap<Node, Promise<void>>();
const surfaces = new WeakMap<Node, Set<Promise<void>>>();

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
export function whenUIArtReady(root: Node, done: () => void, buildingSurface?: Node): void {
  const wait = (): void => {
    if (!isValid(root, true)) return;
    const requests: Promise<void>[] = [];
    const visit = (node: Node): void => {
      const request = loading.get(node);
      if (request) requests.push(request);
      if (node !== buildingSurface) surfaces.get(node)?.forEach(pending => requests.push(pending));
      node.children.forEach(visit);
    };
    visit(root);
    if (!requests.length) { done(); return; }
    // Re-scan after settlement: an art callback or a newer navigation can add work.
    Promise.all(requests).then(wait);
  };
  wait();
}
