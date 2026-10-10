/** Shared-texture battle sprites. Rectangles come from the art export manifest.
 * All characters use a foot pivot; presentation never moves collision origins.
 * Missing assets retain the existing Graphics fallback.
 */
import { Color, EffectAsset, JsonAsset, Layers, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2, Vec4 } from 'cc';
import { uxFrame } from '../ui/Ux';

type AtlasId = 'battle_mobs_v2' | 'battle_heroes_v2' | 'battle_mob_anim_v1' | 'lobby_heroes_v1';
interface FrameManifest { frames: Record<string, [number, number, number, number]>; }
interface Atlas { frames: Map<string, SpriteFrame>; }
const atlases = new Map<AtlasId, Atlas>();
const pending = new Map<AtlasId, ((atlas: Atlas | null) => void)[]>();

type ColdMode = 'frozen' | 'slow' | null;
let coldMaterials: { frozen: Material; slow: Material } | null = null;
let coldLoading = false;
let coldFailed = false;
const coldPending: (() => void)[] = [];

/** Two shared status materials, not a shader/material allocation for each monster. */
function loadColdMaterials(cb: () => void): void {
  if (coldMaterials || coldFailed) { cb(); return; }
  coldPending.push(cb);
  if (coldLoading) return;
  coldLoading = true;
  resources.load('fx/mob-cold', EffectAsset, (err, effect) => {
    if (err || !effect) coldFailed = true;
    else {
      // Battle sprites and their status materials are shared across scene restarts.
      effect.addRef();
      const frozen = new Material(), slow = new Material();
      for (const material of [frozen, slow]) material.initialize({ effectAsset: effect, defines: { USE_TEXTURE: true } });
      frozen.setProperty('coldParams', new Vec4(0.45, 0.75, 1.35, 0.62));
      slow.setProperty('coldParams', new Vec4(0.60, 0.90, 1.28, 0.38));
      coldMaterials = { frozen, slow };
    }
    coldLoading = false;
    const callbacks = coldPending.splice(0);
    callbacks.forEach(f => f());
  });
}

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
  /** 帧间混合进度 [0,1)：>0 时把下一帧按透明度叠在当前帧上，低帧率步态不再顿挫 */
  private seqFrac = 0;
  /** 帧间混合层：与主节点同锚点同尺寸，仅 seqFrac>0 时激活（同图集纹理，不破坏合批） */
  private blendNode: Node | null = null;
  private blendSprite: Sprite | null = null;
  private tintCol = new Color(255, 255, 255, 255);
  private blendCol = new Color();
  private coldMode: ColdMode = null;
  private coldMaterial: Material | null = null;
  private coldWaiting = false;

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
    this.seqFrac = 0;
    this.frame = frame;
    this.height = height;
    this.apply();
  }

  /** 序列帧模式：index=当前帧，frac=向下一帧的混合进度（walk 循环自然回绕，attack 末帧传 0） */
  showSeq(frames: SpriteFrame[], index: number, frac: number, height: number): void {
    if (!frames.length) { this.seqFrames = null; return; }
    const i = index < 0 ? 0 : index >= frames.length ? frames.length - 1 : index;
    const f = Math.max(0, Math.min(0.999, frac));
    if (this.seqFrames === frames && i === this.seqIndex && f === this.seqFrac && height === this.height) return;
    this.seqFrames = frames;
    this.seqIndex = i;
    this.seqFrac = f;
    this.frame = '';
    this.height = height;
    if (this.atlas) this.applySeq();
  }

  private applySeq(): void {
    if (!this.node.isValid || !this.seqFrames) return;
    const frames = this.seqFrames;
    const sf = frames[this.seqIndex];
    this.sprite.spriteFrame = sf;
    const w = this.height * sf.rect.width / sf.rect.height;
    this.node.getComponent(UITransform)!.setContentSize(w, this.height);
    this.node.active = true;
    const next = frames[(this.seqIndex + 1) % frames.length];
    if (this.seqFrac > 0.004 && next && next !== sf) {
      if (!this.blendNode) {
        const n = new Node('seqBlend');
        n.layer = Layers.Enum.UI_2D;
        n.setParent(this.node);
        n.addComponent(UITransform).setAnchorPoint(0.5, 0);
        this.blendSprite = n.addComponent(Sprite);
        this.blendSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.blendSprite.trim = false;
        this.blendSprite.customMaterial = this.coldMaterial;
        this.blendNode = n;
      }
      this.blendSprite!.spriteFrame = next;
      this.blendSprite!.node.getComponent(UITransform)!.setContentSize(w, this.height);
      const c = this.tintCol;
      this.blendCol.set(c.r, c.g, c.b, Math.round(c.a * this.seqFrac));
      this.blendSprite!.color = this.blendCol;
      this.blendNode.active = true;
    } else if (this.blendNode) {
      this.blendNode.active = false;
    }
    if (!this.loaded) { this.loaded = true; this.onLoaded(); }
  }

  private apply(): void {
    if (this.seqFrames) { this.applySeq(); return; }
    const sf = this.atlas?.frames.get(this.frame);
    if (!this.node.isValid) return;
    if (!sf) { this.node.active = false; this.loaded = false; return; }
    if (this.blendNode) this.blendNode.active = false;
    this.sprite.spriteFrame = sf;
    this.node.getComponent(UITransform)!.setContentSize(this.height * sf.rect.width / sf.rect.height, this.height);
    this.node.active = true;
    if (!this.loaded) { this.loaded = true; this.onLoaded(); }
  }

  tint(color: Color): void {
    this.tintCol.set(color);
    this.sprite.color = this.tintCol;
    if (this.seqFrames && this.blendNode?.active) this.applySeq();   // 混合层颜色同步（受击闪红等）
  }

  get coldReady(): boolean { return !!coldMaterials; }

  cold(mode: ColdMode): void {
    this.coldMode = mode;
    if (mode && !coldMaterials && !coldFailed && !this.coldWaiting) {
      this.coldWaiting = true;
      loadColdMaterials(() => { this.coldWaiting = false; if (this.node.isValid) this.syncColdMaterial(); });
    }
    this.syncColdMaterial();
  }

  private syncColdMaterial(): void {
    const material = this.coldMode && coldMaterials ? coldMaterials[this.coldMode] : null;
    if (this.coldMaterial === material) return;
    this.coldMaterial = material;
    this.sprite.customMaterial = material;
    if (this.blendSprite) this.blendSprite.customMaterial = material;
  }
}
