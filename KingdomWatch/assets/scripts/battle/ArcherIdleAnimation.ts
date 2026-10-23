/** Complete idle/attack video frames, sharing a fixed foot pivot and painted scale. */
import { JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { ArtPriority, higherArtPriority, promoteUXArt, uxFrame } from '../ui/Ux';

type ClipId = 'idle' | 'attack';
interface IdleManifest {
  frames: Record<string, number[]>;
  animation: { frames: string[]; seconds: number; releaseIndex?: number; recoverySeconds?: number };
  groundAnchor: number[];
  readyHeightPx: number;
  displayHeight: number;
}
interface IdleClip { manifest: IdleManifest; frames: SpriteFrame[]; }
const clips = new Map<ClipId, IdleClip>();
const pending = new Map<ClipId, ((value: IdleClip | null) => void)[]>();
const priorities = new Map<ClipId, ArtPriority>();

function loadClip(id: ClipId, callback: (value: IdleClip | null) => void, priority: ArtPriority = 'visible'): void {
  const cached = clips.get(id);
  if (cached) { Promise.resolve().then(() => callback(cached)); return; }
  priorities.set(id, higherArtPriority(priorities.get(id) || priority, priority));
  promoteUXArt(`archer_${id}_v1/${id}`, priority);
  const queue = pending.get(id);
  if (queue) { queue.push(callback); return; }
  pending.set(id, [callback]);
  const finish = (result: IdleClip | null): void => {
    if (result) clips.set(id, result);
    const callbacks = pending.get(id) || [];
    pending.delete(id);
    priorities.delete(id);
    callbacks.forEach(cb => cb(result));
  };
  resources.load(`ux/archer_${id}_v1/${id}.frames`, JsonAsset, (error, asset) => {
    if (error || !asset) { finish(null); return; }
    uxFrame(`archer_${id}_v1/${id}`, source => {
      if (!source) { finish(null); return; }
      const manifest = asset.json as IdleManifest;
      const map = new Map<string, SpriteFrame>();
      for (const [name, rect] of Object.entries(manifest.frames)) {
        const [x, y, w, h] = rect;
        const sf = new SpriteFrame();
        sf.reset({ texture: source.texture, rect: new Rect(x, y, w, h),
          originalSize: new Size(w, h), offset: new Vec2() });
        sf.packable = false;
        map.set(name, sf);
      }
      source.texture.addRef();
      asset.addRef();
      finish({ manifest, frames: manifest.animation.frames.map(name => map.get(name)!) });
    }, priorities.get(id) || priority);
  });
}

/** Prepare the same shared clip cache from the lobby, without constructing a character. */
export function preloadArcherClip(id: ClipId, priority: ArtPriority = 'visible'): Promise<void> {
  return new Promise(resolve => loadClip(id, () => resolve(), priority));
}

export class ArcherIdleAnimation {
  readonly node = new Node('archerIdleAnimation');
  readonly sprite: Sprite;
  loaded = false;
  clock = 0;
  frameIndex = -1;
  private data: IdleClip | null = null;
  private attackData: IdleClip | null = null;
  private shownData: IdleClip | null = null;
  private attackClock = Infinity;
  private attackSeconds = .62;

  constructor(parent: Node, onLoaded: () => void) {
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.node.setPosition(0, -76, 0);
    this.node.addComponent(UITransform);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.trim = false;
    this.node.active = false;
    loadClip('attack', data => {
      if (!this.node.isValid) return;
      this.attackData = data;
    });
    loadClip('idle', data => {
      if (!data || !this.node.isValid) return;
      this.data = data;
      this.show(data, 0);
      this.loaded = true;
      this.node.active = true;
      onLoaded();
    });
  }

  get attacking(): boolean { return this.attackClock < this.attackSeconds; }

  /** Called by actual arrow rows; an overlapping rapid row keeps the gesture continuous. */
  release(interval: number): void {
    if (this.attacking) return;
    this.attackSeconds = Math.min(this.attackData?.manifest.animation.recoverySeconds ?? .62,
      Math.max(.1, interval * .74));
    this.attackClock = 0;
    if (this.attackData) this.show(this.attackData, this.attackData.manifest.animation.releaseIndex ?? 0);
  }

  /** Advance only with simulation time, so pause/GM/cards freeze the current pose. */
  tick(dt: number, idle = true, prepare = 0): void {
    if (!Number.isFinite(dt) || dt < 0) return;
    if (this.attacking) {
      this.attackClock = Math.min(this.attackSeconds, this.attackClock + dt);
      if (this.attackData) {
        const first = this.attackData.manifest.animation.releaseIndex ?? 0;
        const count = this.attackData.frames.length - first;
        const index = first + Math.min(count - 1, Math.floor(this.attackClock / this.attackSeconds * count));
        this.show(this.attackData, index);
      }
      return;
    }
    if (!idle && this.attackData) {
      const release = this.attackData.manifest.animation.releaseIndex ?? 0;
      const index = prepare > 0 ? Math.min(release - 1, Math.floor(prepare * release))
        : this.attackData.frames.length - 1;
      this.show(this.attackData, Math.max(0, index));
      return;
    }
    // Idle phase freezes for the whole attack gesture, including recovery.
    if (idle) this.clock += dt;
    if (this.data) this.clock %= this.data.manifest.animation.seconds;
    if (this.data) {
      const index = Math.floor(this.clock / this.data.manifest.animation.seconds * this.data.frames.length);
      this.show(this.data, index);
    }
  }

  private show(data: IdleClip, index: number): void {
    if (!this.node.isValid) return;
    if (data === this.shownData && index === this.frameIndex) return;
    if (data !== this.shownData) {
      const sf = data.frames[0], m = data.manifest;
      const transform = this.node.getComponent(UITransform)!;
      transform.setAnchorPoint(m.groundAnchor[0] / sf.rect.width, 1 - m.groundAnchor[1] / sf.rect.height);
      const scale = m.displayHeight / m.readyHeightPx;
      transform.setContentSize(sf.rect.width * scale, sf.rect.height * scale);
      this.shownData = data;
    }
    this.frameIndex = index;
    this.sprite.spriteFrame = data.frames[index];
  }
}
