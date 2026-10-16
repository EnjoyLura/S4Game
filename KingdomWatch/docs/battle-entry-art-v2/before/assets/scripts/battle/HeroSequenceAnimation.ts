/** Full-character preparation, release and forward recovery with an unchanged foot pivot. */
import { JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { uxFrame } from '../ui/Ux';

type ClipId = 'idle' | 'attack';
interface Manifest {
  frames: Record<string, number[]>;
  textures?: string[];
  framePages?: Record<string, number>;
  animation: { frames: string[]; seconds: number; frameDurations?: number[];
    releaseIndex?: number; readyIndex?: number; recoverySeconds?: number };
  groundAnchor: number[];
  readyHeightPx: number;
  displayHeight: number;
}
interface Clip { manifest: Manifest; frames: SpriteFrame[]; frameEnds: number[] }
const clips = new Map<string, Clip>();
const pending = new Map<string, ((clip: Clip | null) => void)[]>();

function loadClip(directory: string, id: ClipId, callback: (clip: Clip | null) => void): void {
  const key = `${directory}/${id}`;
  const cached = clips.get(key);
  if (cached) { Promise.resolve().then(() => callback(cached)); return; }
  const waiting = pending.get(key);
  if (waiting) { waiting.push(callback); return; }
  pending.set(key, [callback]);
  const finish = (clip: Clip | null): void => {
    if (clip) clips.set(key, clip);
    const callbacks = pending.get(key) || [];
    pending.delete(key);
    callbacks.forEach(cb => cb(clip));
  };
  resources.load(`ux/${directory}/${id}.frames`, JsonAsset, (error, asset) => {
    if (error || !asset) { finish(null); return; }
    const manifest = asset.json as Manifest;
    const textures = manifest.textures ?? [`${id}.png`];
    const sources: SpriteFrame[] = new Array(textures.length);
    let remaining = textures.length, failed = false;
    textures.forEach((file, page) => uxFrame(`${directory}/${file.replace(/\.png$/, '')}`, source => {
      if (failed) return;
      if (!source) { failed = true; finish(null); return; }
      sources[page] = source;
      if (--remaining > 0) return;
      const unique = new Map<string, SpriteFrame>();
      for (const [name, [x, y, w, h]] of Object.entries(manifest.frames)) {
        const frame = new SpriteFrame();
        frame.reset({ texture: sources[manifest.framePages?.[name] ?? 0].texture, rect: new Rect(x, y, w, h),
          originalSize: new Size(w, h), offset: new Vec2() });
        frame.packable = false;
        unique.set(name, frame);
      }
      const frames = manifest.animation.frames.map(name => unique.get(name)!);
      let end = 0;
      const frameEnds = frames.map((_, i) => {
        end += manifest.animation.frameDurations?.[i] ?? manifest.animation.seconds / frames.length;
        return end;
      });
      sources.forEach(texture => texture.texture.addRef());
      asset.addRef();
      finish({ manifest, frames, frameEnds });
    }));
  });
}

function frameAt(clip: Clip, time: number): number {
  let first = 0, last = clip.frames.length - 1;
  while (first < last) {
    const mid = (first + last) >>> 1;
    if (time < clip.frameEnds[mid]) last = mid;
    else first = mid + 1;
  }
  return first;
}

export class HeroSequenceAnimation {
  readonly node: Node;
  readonly sprite: Sprite;
  loaded = false;
  private idleClip: Clip | null = null;
  private attackClip: Clip | null = null;
  private shownClip: Clip | null = null;
  private idleClock = 0;
  private frameIndex = -1;
  private attackClock = Infinity;
  private attackSeconds = .6;

  constructor(parent: Node, onLoaded: () => void, name: string, idleDirectory: string, attackDirectory: string) {
    this.node = new Node(name);
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.node.setPosition(0, -76, 0);
    this.node.addComponent(UITransform);
    this.sprite = this.node.addComponent(Sprite);
    this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite.trim = false;
    this.node.active = false;
    loadClip(attackDirectory, 'attack', clip => {
      if (!this.node.isValid) return;
      this.attackClip = clip;
      if (clip && this.loaded && this.attacking) this.show(clip, this.attackFrame(clip));
    });
    loadClip(idleDirectory, 'idle', clip => {
      if (!clip || !this.node.isValid) return;
      this.idleClip = clip;
      if (this.attacking && this.attackClip) this.show(this.attackClip, this.attackFrame(this.attackClip));
      else this.show(clip, 0);
      this.loaded = true;
      this.node.active = true;
      onLoaded();
    });
  }

  get attacking(): boolean { return this.attackClock < this.attackSeconds; }

  /** Only an actual projectile or spell callback starts the release gesture. */
  release(interval: number): void {
    if (this.attacking) return;
    const recovery = this.attackClip?.manifest.animation.recoverySeconds ?? .6;
    const gap = Number.isFinite(interval) && interval > 0 ? interval : recovery;
    this.attackSeconds = Math.min(recovery, Math.max(.16, gap * .78));
    this.attackClock = 0;
    // Recovery returns to the original source pose, so idle resumes at its matching first frame.
    this.idleClock = 0;
    if (this.attackClip) this.show(this.attackClip, this.attackClip.manifest.animation.releaseIndex ?? 0);
  }

  tick(dt: number, idle = true, prepare = 0): void {
    if (!Number.isFinite(dt) || dt < 0) return;
    if (this.attacking) {
      this.attackClock = Math.min(this.attackSeconds, this.attackClock + dt);
      if (this.attackClip) this.show(this.attackClip, this.attackFrame(this.attackClip));
      return;
    }
    if (!idle) {
      if (this.attackClip) {
        const release = this.attackClip.manifest.animation.releaseIndex ?? 0;
        const ready = this.attackClip.manifest.animation.readyIndex ?? this.attackClip.frames.length - 1;
        const index = prepare > 0 && release > 0
          ? Math.max(0, Math.min(release - 1, Math.floor(prepare * release))) : ready;
        this.show(this.attackClip, index);
      }
      return;
    }
    if (!this.idleClip) return;
    this.idleClock = (this.idleClock + dt) % this.idleClip.manifest.animation.seconds;
    this.show(this.idleClip, frameAt(this.idleClip, this.idleClock));
  }

  private attackFrame(clip: Clip): number {
    const release = clip.manifest.animation.releaseIndex ?? 0;
    const start = release > 0 ? clip.frameEnds[release - 1] : 0;
    const end = clip.frameEnds[clip.frameEnds.length - 1];
    return frameAt(clip, start + (end - start) * Math.min(1, this.attackClock / this.attackSeconds));
  }

  private show(clip: Clip, index: number): void {
    if (!this.node.isValid || (clip === this.shownClip && index === this.frameIndex)) return;
    if (clip !== this.shownClip) {
      const frame = clip.frames[0], manifest = clip.manifest;
      const transform = this.node.getComponent(UITransform)!;
      transform.setAnchorPoint(manifest.groundAnchor[0] / frame.rect.width,
        1 - manifest.groundAnchor[1] / frame.rect.height);
      const scale = manifest.displayHeight / manifest.readyHeightPx;
      transform.setContentSize(frame.rect.width * scale, frame.rect.height * scale);
      this.shownClip = clip;
    }
    this.frameIndex = index;
    this.sprite.spriteFrame = clip.frames[index];
  }
}
