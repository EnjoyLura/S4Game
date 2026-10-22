/** Approved archer art, native Cocos sprite nodes and hand/bow constraints. No Spine. */
import { Color, Graphics, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { uxFrame } from '../ui/Ux';
import { ArcherPose, ArcherRigPose } from './ArcherRigPose';

interface RigAtlas { frames: Record<string, number[]>; sprites: Map<string, SpriteFrame>; }
let atlas: RigAtlas | null = null;
let loading = false;
const pending: ((value: RigAtlas | null) => void)[] = [];
function loadRig(callback: (value: RigAtlas | null) => void): void {
  if (atlas) { Promise.resolve().then(() => callback(atlas)); return; }
  pending.push(callback);
  if (loading) return;
  loading = true;
  const finish = (result: RigAtlas | null): void => {
    if (result) atlas = result;
    loading = false;
    pending.splice(0).forEach(fn => fn(result));
  };
  resources.load('ux/archer_native_v1/parts.frames', JsonAsset, (error, manifest) => {
    if (error || !manifest) { finish(null); return; }
    uxFrame('archer_native_v1/parts', source => {
      if (!source) { finish(null); return; }
      source.texture.addRef(); manifest.addRef();
      const frames = manifest.json.frames as Record<string, number[]>;
      const sprites = new Map<string, SpriteFrame>();
      for (const name of Object.keys(frames)) {
        const [x, y, w, h] = frames[name], frame = new SpriteFrame();
        frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
        frame.packable = false;
        sprites.set(name, frame);
      }
      finish({ frames, sprites });
    });
  });
}

export class ArcherNativeRig {
  readonly node = new Node('archerNativeRig');
  loaded = false;
  pose: ArcherPose | null = null;
  model: ArcherRigPose | null = null;
  private readonly pieces = new Map<string, { node: Node; sprite: Sprite; transform: UITransform }>();
  private readonly stringNode = new Node('archerBowstring');
  private readonly strings: Graphics;
  private readonly arrowNode = new Node('archerNockedArrow');
  private readonly arrow: Graphics;
  private data: RigAtlas | null = null;

  constructor(parent: Node, onLoaded: () => void) {
    this.node.layer = this.stringNode.layer = this.arrowNode.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.node.setPosition(0, -76, 0);
    this.stringNode.setParent(this.node);
    this.arrowNode.setParent(this.node);
    this.strings = this.stringNode.addComponent(Graphics);
    this.arrow = this.arrowNode.addComponent(Graphics);
    this.node.active = false;
    loadRig(data => {
      if (!data || !this.node.isValid) return;
      this.data = data;
      this.model = new ArcherRigPose(data.frames);
      this.loaded = true;
      this.node.active = true;
      this.apply(this.model.sample());
      onLoaded();
    });
  }

  tick(dt: number, prepare: number, dx?: number, dy?: number): void {
    if (this.model) this.apply(this.model.tick(dt, prepare, dx, dy));
  }

  release(dx: number, dy: number, heavy = false): void {
    if (this.model) this.apply(this.model.release(dx, dy, heavy));
  }

  private apply(pose: ArcherPose): void {
    if (!this.data || !this.node.isValid) return;
    this.pose = pose;
    this.pieces.forEach(piece => { piece.node.active = false; });
    for (let index = 0; index < pose.parts.length; index++) {
      const part = pose.parts[index];
      // Reuse one node for each attachment role when facing changes.
      const role = part.name.replace(/^(up|left|right)_(legs|cape|torso|head)$/, '$2');
      let piece = this.pieces.get(role);
      if (!piece) {
        const node = new Node('archerPart:' + role); node.layer = Layers.Enum.UI_2D; node.setParent(this.node);
        const transform = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
        piece = { node, sprite, transform }; this.pieces.set(role, piece);
      }
      piece.sprite.spriteFrame = this.data.sprites.get(part.name)!;
      piece.transform.setAnchorPoint(part.ax, part.ay);
      piece.transform.setContentSize(part.width, part.height);
      piece.node.setPosition(part.x, part.y, 0);
      piece.node.angle = part.angle;
      piece.node.active = true;
      piece.node.setSiblingIndex(index);
    }
    this.stringNode.setSiblingIndex(pose.parts.length);
    this.arrowNode.setSiblingIndex(pose.parts.length + 1);
    const g = this.strings;
    g.clear(); g.strokeColor = new Color(218, 188, 135, 255); g.lineWidth = .7;
    g.moveTo(pose.bowTop.x, pose.bowTop.y); g.lineTo(pose.stringPoint.x, pose.stringPoint.y);
    g.lineTo(pose.bowBottom.x, pose.bowBottom.y); g.stroke();
    const a = this.arrow; a.clear();
    if (pose.arrowVisible) {
      const p = pose.arrowTail, tip = pose.arrowTip;
      const dx = tip.x - p.x, dy = tip.y - p.y, length = Math.hypot(dx, dy) || 1;
      const ux = dx / length, uy = dy / length;
      a.strokeColor = new Color(113, 65, 28, 255); a.lineWidth = .9;
      a.moveTo(p.x, p.y); a.lineTo(tip.x, tip.y); a.stroke();
      a.fillColor = new Color(220, 225, 216, 255);
      a.moveTo(tip.x, tip.y); a.lineTo(tip.x - ux * 4 - uy * 1.5, tip.y - uy * 4 + ux * 1.5);
      a.lineTo(tip.x - ux * 4 + uy * 1.5, tip.y - uy * 4 - ux * 1.5); a.close(); a.fill();
      a.strokeColor = new Color(242, 234, 211, 255); a.lineWidth = 1.2;
      for (const side of [-1, 1]) {
        a.moveTo(p.x + ux * 5, p.y + uy * 5);
        a.lineTo(p.x + ux * 1 - uy * side * 2, p.y + uy * 1 + ux * side * 2); a.stroke();
      }
    }
  }
}
