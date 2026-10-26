/** Fixed-canvas user-video flipbooks. Only visual frames read area.age; no gameplay clocks. */
import { Color, JsonAsset, Layers, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';
import { ArtPriority, promoteUXArt, uxFrame } from '../ui/Ux';

export type WindVideoKind = 'eye' | 'tornado';
export const WIND_VIDEO_RESOURCES: Record<WindVideoKind, string> = {
  eye: 'fx/wind_eye_video_v129', tornado: 'fx/wind_tornado_video_v129',
};
interface ClipManifest {
  schema: number; framePrefix: string; frameCount: number; fps: number; playbackSpeed: number;
  cellSize: [number, number]; groundAnchor: [number, number]; visualWidthPerRadius: number;
  displayHeightScale?: number; displayOffsetY?: number;
  frames: Record<string, [number, number, number, number]>;
}
interface Clip { manifest: ClipManifest; frames: SpriteFrame[]; }
interface View { kind: string; x: number; y: number; age: number; radius: number; }
interface Slot { node: Node; sprite: Sprite; ui: UITransform; frame: SpriteFrame | null; }
const jobs = new Map<WindVideoKind, Promise<Clip | null>>();

function validManifest(m: ClipManifest, source: SpriteFrame): boolean {
  if (m?.schema !== 1 || !Number.isInteger(m.frameCount) || m.frameCount < 1 || m.frameCount > 96
    || !Number.isFinite(m.fps) || m.fps <= 0 || m.fps > 60
    || !Number.isFinite(m.playbackSpeed) || m.playbackSpeed <= 0 || m.playbackSpeed > 3
    || !Number.isFinite(m.visualWidthPerRadius) || m.visualWidthPerRadius <= 0 || m.visualWidthPerRadius > 5
    || !Array.isArray(m.cellSize) || m.cellSize.length !== 2 || !m.cellSize.every(n => Number.isFinite(n) && n > 0)
    || !Array.isArray(m.groundAnchor) || m.groundAnchor.length !== 2
    || !m.groundAnchor.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
    || (m.displayHeightScale !== undefined && (!Number.isFinite(m.displayHeightScale) || m.displayHeightScale < .2 || m.displayHeightScale > 2))
    || (m.displayOffsetY !== undefined && (!Number.isFinite(m.displayOffsetY) || Math.abs(m.displayOffsetY) > 100)) || !m.frames) return false;
  for (let i = 0; i < m.frameCount; i++) {
    const r = m.frames[m.framePrefix + i];
    if (!Array.isArray(r) || r.length !== 4 || !r.every(Number.isFinite) || r[0] < 0 || r[1] < 0
      || r[2] !== m.cellSize[0] || r[3] !== m.cellSize[1]
      || r[0] + r[2] > source.rect.width || r[1] + r[3] > source.rect.height) return false;
  }
  return true;
}

/** Shared UX image request and one shared manifest/derived-frame cache for the application.
 * Prewarm at the entry barrier; constructors consume the same promise without another download.
 * UX owns the source texture for application lifetime, just like existing UI atlas aliases.
 */
function loadClip(kind: WindVideoKind, priority: ArtPriority): Promise<Clip | null> {
  const hit = jobs.get(kind); if (hit) { promoteUXArt(WIND_VIDEO_RESOURCES[kind], priority); return hit; }
  const path = WIND_VIDEO_RESOURCES[kind];
  const image = new Promise<SpriteFrame | null>(resolve => uxFrame(path, resolve, priority));
  const manifest = new Promise<ClipManifest | null>(resolve => {
    resources.load(path + '.frames', JsonAsset, (error, asset) => resolve(!error && asset ? asset.json as ClipManifest : null));
  });
  const job = Promise.all([image, manifest]).then(([source, m]): Clip | null => {
    if (!source || !m || !validManifest(m, source)) return null;
    source.packable = false;
    const frames: SpriteFrame[] = [];
    for (let i = 0; i < m.frameCount; i++) {
      const [x, y, w, h] = m.frames[m.framePrefix + i];
      const frame = new SpriteFrame();
      frame.reset({ texture: source.texture, rect: new Rect(source.rect.x + x, source.rect.y + y, w, h),
        originalSize: new Size(w, h), offset: new Vec2() });
      frame.packable = false; frames.push(frame);
    }
    return { manifest: m, frames };
  });
  jobs.set(kind, job);
  void job.then(clip => { if (!clip && jobs.get(kind) === job) jobs.delete(kind); });
  return job;
}

export function warmWindVideo(priority: ArtPriority = 'next'): Promise<void> {
  return Promise.all((['eye', 'tornado'] as const).map(kind => loadClip(kind, priority))).then(() => {});
}

/** Pure time mapping; pause/slow-motion naturally follow the owning area's battle age. */
export function windVideoFrame(age: number, fps: number, speed: number, count: number): number {
  return Math.floor(Math.max(0, Number.isFinite(age) ? age : 0) * fps * speed + 1e-7) % count;
}

export class WindVideoVFX {
  private readonly root = new Node('WindVideoVFX');
  private readonly groundRoot = new Node('WindEyeGroundVFX');
  private readonly clips = new Map<WindVideoKind, Clip>();
  private readonly selected = new WeakMap<View, Clip | null>();
  private readonly slots: Slot[] = [];
  private readonly tint = new Color(255, 255, 255, 255);
  private used = 0;
  private disposed = false;
  constructor(parent: Node) {
    this.root.layer = Layers.Enum.UI_2D; this.root.setParent(parent);
    const field = parent.parent || parent;
    const ground = field.getChildByName('GroundFxLayer');
    this.groundRoot.layer = Layers.Enum.UI_2D; this.groundRoot.setParent(ground || this.root);
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.disposed = true;
      for (const slot of this.slots) { if (slot.node.isValid) slot.sprite.spriteFrame = null; slot.frame = null; }
      this.slots.length = 0; this.clips.clear();
      // The eye lives below MobLayer, outside this root's normal child hierarchy.
      if (this.groundRoot.isValid) this.groundRoot.destroy();
    });
    for (let i = 0; i < 8; i++) {
      const node = new Node('windVideo' + i); node.layer = Layers.Enum.UI_2D; node.setParent(this.root);
      // Source cone sway is corrected offline; neither slot follows projectile facing.
      node.setRotationFromEuler(0, 0, 0);
      const ui = node.addComponent(UITransform), sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
      // Straight RGBA: default SRC_ALPHA / ONE_MINUS_SRC_ALPHA, never additive.
      node.active = false; this.slots.push({ node, sprite, ui, frame: null });
    }
    for (const kind of ['eye', 'tornado'] as const) void loadClip(kind, 'visible').then(clip => {
      if (clip && !this.disposed && this.root.isValid) this.clips.set(kind, clip);
    });
  }
  begin(): void { this.used = 0; }
  area(area: View, alpha: number): boolean {
    if (this.disposed || (area.kind !== 'eye' && area.kind !== 'tornado') || this.used >= this.slots.length) return false;
    if (!this.selected.has(area)) this.selected.set(area, this.clips.get(area.kind) || null);
    // Fix the rendering choice for this cast: late network recovery never swaps a live effect.
    const clip = this.selected.get(area); if (!clip) return false;
    const slot = this.slots[this.used++], m = clip.manifest;
    const plane = area.kind === 'eye' ? this.groundRoot : this.root;
    if (slot.node.parent !== plane) slot.node.setParent(plane);
    const frame = clip.frames[windVideoFrame(area.age, m.fps, m.playbackSpeed, m.frameCount)];
    if (slot.frame !== frame) { slot.sprite.spriteFrame = frame; slot.frame = frame; }
    const width = Math.max(1, area.radius) * m.visualWidthPerRadius;
    slot.ui.setAnchorPoint(...m.groundAnchor);
    slot.ui.setContentSize(width, width * m.cellSize[1] / m.cellSize[0] * (m.displayHeightScale ?? 1));
    this.tint.a = Math.round(255 * Math.max(0, Math.min(1, alpha))); slot.sprite.color = this.tint;
    slot.node.setPosition(area.x, area.y + (m.displayOffsetY ?? 0), 0); slot.node.active = true;
    return true;
  }
  end(): void { for (let i = this.used; i < this.slots.length; i++) this.slots[i].node.active = false; }
}
