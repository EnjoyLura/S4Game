/** Ground-anchored airborne sprites share the actors' existing depth order. */
import { Node } from 'cc';

export interface DepthSprite { node: Node; depthY: number; }
const sprites = new WeakMap<Node, DepthSprite[]>();
const sorters = new WeakMap<Node, () => void>();

export function registerDepthSprite(parent: Node, node: Node): DepthSprite {
  let list = sprites.get(parent);
  if (!list) { list = []; sprites.set(parent, list); }
  const entry = { node, depthY: 0 }; list.push(entry);
  node.once(Node.EventType.NODE_DESTROYED, () => {
    const i = list!.indexOf(entry); if (i >= 0) list!.splice(i, 1);
  });
  return entry;
}
export function depthSprites(parent: Node): readonly DepthSprite[] { return sprites.get(parent) || []; }
export function setDepthSorter(parent: Node, sort: () => void): void { sorters.set(parent, sort); }
export function clearDepthSorter(parent: Node): void { sorters.delete(parent); }
export function refreshDepth(parent: Node): void { if (parent.isValid) sorters.get(parent)?.(); }
