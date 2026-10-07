/** Shared-texture battle sprites. Rectangles come from the art export manifest.
 * All characters use a foot pivot; presentation never moves collision origins.
 * Missing assets retain the existing Graphics fallback.
 */
import { Color, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { uxFrame } from '../ui/Ux';

type AtlasId = 'battle_mobs_v2' | 'battle_heroes_v2' | 'battle_mob_anim_v1';
interface FrameManifest { frames: Record<string, [number, number, number, number]>; }
interface Atlas { frames: Map<string, SpriteFrame>; }
const atlases = new Map<AtlasId, Atlas>();
const pending = new Map<AtlasId, ((atlas: Atlas | null) => void)[]>();

function loadAtlas(id: AtlasId, cb: (atlas: Atlas | null) => void): void {
  const cached = atlases.get(id);
  if (cached) { cb(cached); return; }
  const queue = pending.get(id);
  if (queue) { queue.push(cb); return; }
  pending.set(id, [cb]);
  const finish = (atlas: Atlas | null): void => {
    if (atlas) atlases.set(id, atlas);
    const callbacks = pending.get(id) || [];
    pending.delete(id);
    callbacks.forEach(f => f(atlas));
  };
  resources.load('ux/' + id + '.frames', JsonAsset, (err, asset) => {
    if (err || !asset) { finish(null); return; }
    uxFrame(id, source => {
      if (!source) { finish(null); return; }
      const frames = new Map<string, SpriteFrame>();
      const manifest = asset.json as FrameManifest;
      for (const name of Object.keys(manifest.frames)) {
        const [x, y, w, h] = manifest.frames[name];
        const sf = new SpriteFrame();
        sf.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
        frames.set(name, sf);
      }
      finish({ frames });
    });
  });
}

export class BattleSprite {
  readonly node = new Node('battleArt');
  readonly sprite: Sprite;
  loaded = false;
  private frame = '';
  private height = 100;
  private atlas: Atlas | null = null;
  /** 序列帧模式（showSeq 写入；show() 清除回到静态帧） */
  private seqFrames: SpriteFrame[] | null = null;
  private seqIndex = -1;

  constructor(parent: Node, atlasId: AtlasId, private onLoaded: () => void) {
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.node.addComponent(UITransform).setAnchorPoint(0.5, 0);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.trim = false;
    this.node.active = false;
    loadAtlas(atlasId, atlas => {
      if (!this.node.isValid || !atlas) return;
      this.atlas = atlas;
      this.apply();
    });
  }

  show(frame: string, height: number): void {
    if (frame === this.frame && height === this.height && !this.seqFrames) return;
    this.seqFrames = null;
    this.frame = frame;
    this.height = height;
    this.apply();
  }

  /** 序列帧模式：按 index 切换预解析帧（高度不变时零 setContentSize；同帧同位零操作） */
  showSeq(frames: SpriteFrame[], index: number, height: number): void {
    if (!frames.length) { this.seqFrames = null; return; }
    const i = index < 0 ? 0 : index >= frames.length ? frames.length - 1 : index;
    if (this.seqFrames === frames && i === this.seqIndex && height === this.height) return;
    this.seqFrames = frames;
    this.seqIndex = i;
    this.frame = '';
    this.height = height;
    if (this.atlas) this.applySeq(frames[i]);
  }

  private applySeq(sf: SpriteFrame): void {
    if (!this.node.isValid) return;
    this.sprite.spriteFrame = sf;
    this.node.getComponent(UITransform)!.setContentSize(this.height * sf.rect.width / sf.rect.height, this.height);
    this.node.active = true;
    if (!this.loaded) { this.loaded = true; this.onLoaded(); }
  }

  private apply(): void {
    if (this.seqFrames) { this.applySeq(this.seqFrames[this.seqIndex]); return; }
    const sf = this.atlas?.frames.get(this.frame);
    if (!this.node.isValid) return;
    if (!sf) { this.node.active = false; this.loaded = false; return; }
    this.sprite.spriteFrame = sf;
    this.node.getComponent(UITransform)!.setContentSize(this.height * sf.rect.width / sf.rect.height, this.height);
    this.node.active = true;
    if (!this.loaded) { this.loaded = true; this.onLoaded(); }
  }

  tint(color: Color): void { this.sprite.color = color; }
}
