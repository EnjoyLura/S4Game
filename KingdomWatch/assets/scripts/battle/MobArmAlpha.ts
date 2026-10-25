/** Sparse, frame-specific transparent holes. Original atlas files/RGB and all geometry stay intact. */
import { director, gfx, JsonAsset, resources, SpriteFrame } from 'cc';
type FrameTexture = SpriteFrame['texture'];

interface Plan { atlasSize: [number, number]; rectangles: [number, number, number, number][]; }
type Plans = Record<string, Plan>;
const targets = new Set(['chapter1_mob_walk_v94', 'chapter1_mob_walk_v95']);
const applied = new WeakMap<FrameTexture, object>();
let planJob: Promise<Plans | null> | null = null;
function plans(): Promise<Plans | null> {
  if (!planJob) planJob = new Promise(resolve => {
    resources.load('ux/mob-arm-alpha-v111', JsonAsset, (error, asset) => {
      if (error || !asset) { planJob = null; resolve(null); }
      else resolve(asset.json as Plans);
    });
  });
  return planJob;
}
export function warmMobArmAlpha(): void { void plans(); }

/** Called before the texture is exposed to either portrait or animation consumers. */
export function prepareMobArmAlpha(atlas: string, texture: FrameTexture, done: () => void): void {
  if (!targets.has(atlas)) { done(); return; }
  void plans().then(data => {
    const target = texture.isValid ? texture.getGFXTexture() : null, device = director.root?.device;
    const plan = data?.[atlas];
    if (!target || !device || !plan || applied.get(texture) === target) return;
    if (texture.width !== plan.atlasSize[0] || texture.height !== plan.atlasSize[1] || target.format !== gfx.Format.RGBA8) {
      return; // A future compressed texture must use a rebaked source, never an incompatible upload.
    }
    const regions: gfx.BufferTextureCopy[] = [], buffers: Uint8Array[] = [];
    // The tiny clear buffers are shared by equal rectangles; no full CPU atlas copy or canvas readback.
    const zeros = new Map<number, Uint8Array>();
    for (const [x, y, w, h] of plan.rectangles) {
      if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > texture.width || y + h > texture.height) continue;
      const bytes = w * h * 4;
      let clear = zeros.get(bytes); if (!clear) { clear = new Uint8Array(bytes); zeros.set(bytes, clear); }
      const region = new gfx.BufferTextureCopy();
      region.texOffset.x = x; region.texOffset.y = y;
      region.texExtent.width = w; region.texExtent.height = h; region.texExtent.depth = 1;
      regions.push(region); buffers.push(clear);
    }
    device.copyBuffersToTexture(buffers, target, regions);
    applied.set(texture, target);
  }).then(done, done); // Settle once; a consumer error must never call its callback twice.
}
