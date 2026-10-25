/** Small, bounded, art-free shader quads. Cosmetic state is supplied by the battle clock. */
import { EffectAsset, gfx, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4 } from 'cc';
import { N } from '../ui/UIKit';

export const HERO_FX_EFFECT = 'fx/hero-impact-flow';
interface Quad { node: Node; ui: UITransform; sprite: Sprite; material: Material | null; state: Vec4; shape: Vec4; }
let request: Promise<EffectAsset | null> | null = null;
function effect(): Promise<EffectAsset | null> {
  if (!request) request = new Promise(resolve => {
    resources.load(HERO_FX_EFFECT, EffectAsset, (error, asset) => {
      if (error || !asset) { request = null; resolve(null); }
      else { asset.addRef(); resolve(asset); } // One tiny shared effect remains valid across battle restarts.
    });
  });
  return request;
}

export class HeroFxShader {
  private root: Node;
  private texture: Texture2D;
  private frame: SpriteFrame;
  private quads: Quad[] = [];
  private used = 0;
  private lastUsed = 0;
  private destroyed = false;
  ready = false;
  constructor(parent: Node, name: string, capacity: number, private readonly emissive = false) {
    this.root = N(name, parent);
    this.texture = new Texture2D();
    this.texture.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    this.texture.uploadData(new Uint8Array(16).fill(255));
    this.frame = new SpriteFrame();
    this.frame.reset({ texture: this.texture, rect: new Rect(0, 0, 2, 2), originalSize: new Size(2, 2), offset: new Vec2() });
    this.frame.packable = false;
    for (let i = 0; i < capacity; i++) {
      const node = N('flow' + i, this.root), ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false; sprite.spriteFrame = this.frame;
      if (emissive) {
        const blend = sprite as unknown as { _srcBlendFactor: gfx.BlendFactor; _dstBlendFactor: gfx.BlendFactor };
        blend._srcBlendFactor = gfx.BlendFactor.ONE; blend._dstBlendFactor = gfx.BlendFactor.ONE;
      }
      // Remain hidden until a real effect has a material: a white carrier is never a fallback.
      node.active = false;
      this.quads.push({ node, ui, sprite, material: null, state: new Vec4(), shape: new Vec4() });
    }
    void effect().then(asset => {
      if (!asset || this.destroyed || !this.root.isValid) return;
      for (const q of this.quads) {
        const material = new Material(); material.initialize({ effectAsset: asset, technique: this.emissive ? 1 : 0 });
        q.material = material; q.sprite.customMaterial = material;
      }
      this.ready = true;
    });
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.destroyed = true;
      for (const q of this.quads) {
        if (q.sprite.isValid) q.sprite.spriteFrame = null;
        q.material?.destroy();
      }
      this.quads.length = 0; this.frame.destroy(); this.texture.destroy();
    });
  }
  begin(): void { this.used = 0; }
  draw(x: number, y: number, width: number, height: number, angle: number,
    age: number, seed: number, power: number, mode: number, metric: number, extra = 0): boolean {
    if (!this.ready || this.destroyed || this.used >= this.quads.length) return false;
    const q = this.quads[this.used++];
    if (!q.node.active) q.node.active = true;
    const p = q.node.position;
    if (p.x !== x || p.y !== y) q.node.setPosition(x, y, 0);
    if (q.node.angle !== angle) q.node.angle = angle;
    if (q.ui.width !== width || q.ui.height !== height) q.ui.setContentSize(width, height);
    q.state.set(age, seed, power, mode); q.shape.set(width, height, metric, extra);
    q.material!.setProperty('fxState', q.state); q.material!.setProperty('fxShape', q.shape);
    return true;
  }
  end(): void {
    // Keep reused quads active, so long beams never churn node activation every frame.
    for (let i = this.used; i < this.lastUsed; i++) this.quads[i].node.active = false;
    this.lastUsed = this.used;
  }
}
