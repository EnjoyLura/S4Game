/** MobAnim —— 怪物动作序列帧注册表，按怪物所在图集按需加载。
 * 帧名约定 <mobId>_w<i>（walk 循环）/ <mobId>_a<i>（attack 一次性，可缺省）。
 * 加载失败返回 null → Monster 走程序化步态兜底，调用方零分支。
 */
import { JsonAsset, Rect, resources, Size, SpriteFrame, Vec2 } from 'cc';
import { ArtPriority, higherArtPriority, promoteUXArt, uxFrame } from '../ui/Ux';

export interface MobClip {
  walk: SpriteFrame[];
  attack: SpriteFrame[];
  /** 步态环真实时长（s）：源视频一个完整周期；运行时按实时速率播放避免慢动作/快进的踉跄感 */
  loopDur: number;
  /** 源步态对应的移速；现有普通怪保持原45，新王按17.5播放原速。 */
  referenceSpeed: number;
  /** 固定地面基线和逐帧左右鞋底点，均为相对于显示高度的比例。 */
  groundOffset: number;
  feet: [number, number, number, number][];
  /** 头部最高点相对画布底部的比例，避开法杖/长矛和透明留白。 */
  topRatio?: number;
}

interface FrameManifest {
  frames: Record<string, [number, number, number, number]>;
  cycles?: Record<string, number>;
  walkSpeeds?: Record<string, number>;
  ground?: Record<string, { offset: number; feet: [number, number, number, number][] }>;
  topRatios?: Record<string, number>;
}

type AtlasId = 'battle_mob_anim_v1' | 'goblin_king_walk_v1' | 'chapter1_mob_walk_v81';
const videoWalkMobs = new Set(['goblin_worker', 'goblin_shaman', 'goblin_brute', 'wolf_rider']);
type Loaded = Map<string, MobClip> | null;
const defs = new Map<AtlasId, Map<string, MobClip>>();
const pending = new Map<AtlasId, ((d: Loaded) => void)[]>();
const priorities = new Map<AtlasId, ArtPriority>();

export function getMobAnims(cb: (d: Loaded) => void, mobId = '', priority: ArtPriority = 'visible'): void {
  const id: AtlasId = mobId === 'goblin_king' ? 'goblin_king_walk_v1'
    : videoWalkMobs.has(mobId) ? 'chapter1_mob_walk_v81' : 'battle_mob_anim_v1';
  const cached = defs.get(id);
  if (cached) { cb(cached); return; }
  priorities.set(id, higherArtPriority(priorities.get(id) || priority, priority));
  promoteUXArt(id, priority);
  const waiters = pending.get(id);
  if (waiters) { waiters.push(cb); return; }
  pending.set(id, [cb]);
  const finish = (d: Loaded): void => {
    if (d) defs.set(id, d);
    const callbacks = pending.get(id) || [];
    pending.delete(id);
    priorities.delete(id);
    callbacks.forEach(f => f(d));
  };
  resources.load('ux/' + id + '.frames', JsonAsset, (err, asset) => {
    if (err || !asset) { finish(null); return; }
    uxFrame(id, source => {
      if (!source) { finish(null); return; }
      finish(parse(asset.json as FrameManifest, source.texture));
    }, priorities.get(id) || priority);
  });
}

function parse(manifest: FrameManifest, tex: SpriteFrame['texture']): Map<string, MobClip> {
  const segs = new Map<string, { w: [number, string, number][]; a: [number, string, number][] }>();
  for (const name of Object.keys(manifest.frames)) {
    const m = /^(.+)_(w|a)(\d+)$/.exec(name);
    if (!m) continue;
    const mob = m[1], mode = m[2], i = Number(m[3]);
    let s = segs.get(mob);
    if (!s) { s = { w: [], a: [] }; segs.set(mob, s); }
    (mode === 'w' ? s.w : s.a).push([i, name, i]);
  }
  const out = new Map<string, MobClip>();
  for (const [mob, s] of segs) {
    const mk = (list: [number, string, number][]): SpriteFrame[] => {
      list.sort((p, q) => p[0] - q[0]);
      return list.map(([, name]) => {
        const [x, y, w, h] = manifest.frames[name];
        const sf = new SpriteFrame();
        sf.reset({ texture: tex, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
        if (mob === 'goblin_king' || videoWalkMobs.has(mob)) sf.packable = false;
        return sf;
      });
    };
    const contact = manifest.ground?.[mob];
    out.set(mob, { walk: mk(s.w), attack: mk(s.a), loopDur: manifest.cycles?.[mob] || 1,
      referenceSpeed: manifest.walkSpeeds?.[mob] || 45,
      groundOffset: contact?.offset ?? 3 / 160, feet: contact?.feet || [],
      topRatio: manifest.topRatios?.[mob] });
  }
  return out;
}
