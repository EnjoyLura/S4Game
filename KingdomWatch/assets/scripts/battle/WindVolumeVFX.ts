/** Painted wind only. The WindHero host creates this pool during warmEffects. */
import { EffectAsset, gfx, isValid, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2, Vec4 } from 'cc';
import { N } from '../ui/UIKit';
import { uxFrame } from '../ui/Ux';

/** Resource IDs, without extensions or /spriteFrame: identical to the host's UX prewarm IDs. */
export const WIND_VOLUME_IMAGES = ['fx/wind_volume_v122/eye', 'fx/wind_volume_v122/tornado'] as const;
export const WIND_VOLUME_EFFECT = 'fx/wind-volume-v122';

interface WindVolumeArea {
  kind: string; x: number; y: number; radius: number; age: number; duration: number;
}
interface Quad {
  node: Node; ui: UITransform; sprite: Sprite; material: Material | null;
  state: Vec4; shape: Vec4; mode: number;
}

// One retained reference per successful resource path, shared across scene restarts.
// Failed requests are evicted; a live pool retries with bounded backoff. Never
// destroy/release these global assets from an individual pool's destruction hook.
const effectRequests = new Map<string, Promise<EffectAsset | null>>();
const frameRequests = new Map<string, Promise<SpriteFrame | null>>();
function loadEffect(path: string): Promise<EffectAsset | null> {
  const prior = effectRequests.get(path);
  if (prior) return prior;
  const request = new Promise<EffectAsset | null>(resolve => {
    resources.load(path, EffectAsset, (error, asset) => {
      if (error || !asset || !isValid(asset, true)) { resolve(null); return; }
      asset.addRef(); resolve(asset);
    });
  }).catch(() => null);
  effectRequests.set(path, request);
  void request.then(asset => {
    if (!asset && effectRequests.get(path) === request) effectRequests.delete(path);
  });
  return request;
}
function loadAtlas(path: string): Promise<SpriteFrame | null> {
  const prior = frameRequests.get(path);
  if (prior) return prior;
  const request = new Promise<SpriteFrame | null>(resolve => {
    // uxFrame owns the actual resources.load and deduplicates with the host's
    // existing cache/prewarm. Do not load an ImageAsset or clone its texture.
    uxFrame(path, frame => {
      if (!frame || !isValid(frame, true) || !frame.texture || !isValid(frame.texture, true)
        || frame.texture.width !== 1024 || frame.texture.height !== 1024) { resolve(null); return; }
      frame.packable = false;
      frame.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
      // Mip levels would mix the four cells. The painted 40px gutters and the
      // shader's two-source-pixel inset protect base-level bilinear sampling.
      frame.texture.setMipFilter(Texture2D.Filter.NONE);
      frame.texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
      frame.addRef(); resolve(frame);
    }, 'visible');
  }).catch(() => null);
  frameRequests.set(path, request);
  void request.then(frame => {
    if (!frame && frameRequests.get(path) === request) frameRequests.delete(path);
  });
  return request;
}

export class WindVolumeVFX {
  private readonly root: Node;
  private readonly texture: Texture2D;
  private readonly frame: SpriteFrame;
  private readonly quads: Quad[] = [];
  private atlases: readonly SpriteFrame[] = [];
  private used = 0;
  private lastUsed = 0;
  private destroyed = false;
  private loading = false;
  private retryDelay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  ready = false;

  constructor(private readonly parent: Node, capacity = 8) {
    this.root = N('wind-volume-v122', parent);
    // A scene-owned carrier supplies full 0..1 UVs only. It never supplies art
    // and stays invisible until every real atlas and custom material is ready.
    this.texture = new Texture2D();
    this.texture.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    this.texture.uploadData(new Uint8Array(16).fill(255));
    this.frame = new SpriteFrame();
    this.frame.reset({ texture: this.texture, rect: new Rect(0, 0, 2, 2), originalSize: new Size(2, 2), offset: new Vec2() });
    this.frame.packable = false;
    const count = Math.max(0, Math.min(8, Math.floor(Number.isFinite(capacity) ? capacity : 8)));
    for (let i = 0; i < count; i++) {
      const node = N('wind-volume-' + i, this.root);
      node.active = false;
      const ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false; sprite.spriteFrame = this.frame;
      // Sprite's batching blend factors must agree with the custom pass.
      const blend = sprite as unknown as { _srcBlendFactor: gfx.BlendFactor; _dstBlendFactor: gfx.BlendFactor };
      blend._srcBlendFactor = gfx.BlendFactor.ONE;
      blend._dstBlendFactor = gfx.BlendFactor.ONE_MINUS_SRC_ALPHA;
      this.quads.push({ node, ui, sprite, material: null, state: new Vec4(), shape: new Vec4(), mode: -1 });
    }
    this.root.once(Node.EventType.NODE_DESTROYED, () => this.dispose());
    this.prepare();
  }

  private alive(): boolean {
    // strict validity also excludes a parent's queued destroy before its child
    // receives NODE_DESTROYED, preventing late asynchronous material creation.
    return !this.destroyed && isValid(this.root, true) && isValid(this.parent, true);
  }

  private prepare(): void {
    if (!this.alive() || this.ready || this.loading) return;
    this.loading = true;
    void Promise.all([loadEffect(WIND_VOLUME_EFFECT), loadAtlas(WIND_VOLUME_IMAGES[0]), loadAtlas(WIND_VOLUME_IMAGES[1])])
      .then(([effect, eye, tornado]) => {
        if (!this.alive()) return;
        if (!effect || !eye || !tornado) { this.retry(); return; }
        this.atlases = [eye, tornado];
        for (const q of this.quads) {
          const material = new Material(); q.material = material;
          material.initialize({ effectAsset: effect, technique: 0 });
          // Initial mode transition happens during preparation, off the draw path.
          material.setProperty('volumeMap', eye.texture); q.mode = 0;
          q.sprite.customMaterial = material;
        }
        this.loading = false; this.ready = true;
      }).catch(() => {
        if (!this.alive()) return;
        for (const q of this.quads) {
          q.node.active = false; q.sprite.customMaterial = null;
          q.material?.destroy(); q.material = null; q.mode = -1;
        }
        this.retry();
      });
  }

  private retry(): void {
    this.loading = false;
    if (!this.alive() || this.retryTimer !== undefined) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined; this.prepare();
    }, this.retryDelay);
    this.retryDelay = Math.min(5000, this.retryDelay * 2);
  }

  begin(): void { this.used = 0; }

  draw(area: WindVolumeArea, opacity: number): boolean {
    if (!this.ready || !this.alive()) return false;
    if (area.kind !== 'eye' && area.kind !== 'tornado') return false;
    if (!Number.isFinite(area.x) || !Number.isFinite(area.y) || !Number.isFinite(area.radius)
      || !Number.isFinite(area.age) || !Number.isFinite(area.duration) || !Number.isFinite(opacity)) return false;
    // A handled but invisible field must not cause the host's visible fallback.
    if (opacity <= 0 || area.radius <= 0) return true;
    if (this.used >= this.quads.length) return false;
    const mode = area.kind === 'tornado' ? 1 : 0, q = this.quads[this.used++];
    const width = area.radius * (mode ? 2.6 : 2.7), height = area.radius * (mode ? 3.3 : 2.7);
    const y = area.y + (mode ? area.radius * .35 : 0);
    if (q.mode !== mode) {
      q.material!.setProperty('volumeMap', this.atlases[mode].texture); q.mode = mode;
    }
    if (q.node.position.x !== area.x || q.node.position.y !== y) q.node.setPosition(area.x, y, 0);
    if (q.ui.width !== width || q.ui.height !== height) q.ui.setContentSize(width, height);
    // One stable seed, battle age only, and exactly one parent opacity multiplier.
    q.state.set(Math.max(0, area.age), Math.min(1, opacity), mode, .73);
    q.shape.set(width, height, area.radius, area.duration);
    q.material!.setProperty('volumeState', q.state); q.material!.setProperty('volumeShape', q.shape);
    if (!q.node.active) q.node.active = true;
    return true;
  }

  end(): void {
    if (!this.alive()) return;
    for (let i = this.used; i < this.lastUsed; i++) this.quads[i].node.active = false;
    this.lastUsed = this.used;
  }

  private dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.ready = false;
    if (this.retryTimer !== undefined) { clearTimeout(this.retryTimer); this.retryTimer = undefined; }
    for (const q of this.quads) {
      if (isValid(q.sprite, true)) { q.sprite.customMaterial = null; q.sprite.spriteFrame = null; }
      q.material?.destroy();
    }
    this.quads.length = 0; this.atlases = [];
    // Only these private carriers belong to this pool. Shared source art/effect
    // remains retained by its per-path cache and is never globally destroyed.
    this.frame.destroy(); this.texture.destroy();
  }
}
