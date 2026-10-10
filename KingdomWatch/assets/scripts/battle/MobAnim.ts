/** MobAnim —— 怪物动作序列帧注册表（battle_mob_anim_v1 图集）。
 * 帧名约定 <mobId>_w<i>（walk 循环）/ <mobId>_a<i>（attack 一次性，可缺省）。
 * 加载失败返回 null → Monster 走程序化步态兜底，调用方零分支。
 */
import { JsonAsset, Rect, resources, Size, SpriteFrame, Vec2 } from 'cc';
import { uxFrame } from '../ui/Ux';

export interface MobClip {
  walk: SpriteFrame[];
  attack: SpriteFrame[];
  /** 步态环真实时长（s）：源视频一个完整周期；运行时按实时速率播放避免慢动作/快进的踉跄感 */
  loopDur: number;
  /** 固定地面基线和逐帧左右鞋底点，均为相对于显示高度的比例。 */
  groundOffset: number;
  feet: [number, number, number, number][];
}

interface FrameManifest {
  frames: Record<string, [number, number, number, number]>;
  cycles?: Record<string, number>;
  ground?: Record<string, { offset: number; feet: [number, number, number, number][] }>;
}

let defs: Map<string, MobClip> | null = null;
let loading = false;
const waiters: ((d: Map<string, MobClip> | null) => void)[] = [];

export function getMobAnims(cb: (d: Map<string, MobClip> | null) => void): void {
  if (defs) { cb(defs); return; }
  waiters.push(cb);
  if (loading) return;
  loading = true;
  resources.load('ux/battle_mob_anim_v1.frames', JsonAsset, (err, asset) => {
    if (err || !asset) { finish(null); return; }
    uxFrame('battle_mob_anim_v1', source => {
      if (!source) { finish(null); return; }
      finish(parse(asset.json as FrameManifest, source.texture));
    });
  });
}

function finish(d: Map<string, MobClip> | null): void {
  defs = d;
  loading = false;
  const q = waiters.slice();
  waiters.length = 0;
  q.forEach(f => f(d));
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
        return sf;
      });
    };
    const contact = manifest.ground?.[mob];
    out.set(mob, { walk: mk(s.w), attack: mk(s.a), loopDur: manifest.cycles?.[mob] || 1,
      groundOffset: contact?.offset ?? 3 / 160, feet: contact?.feet || [] });
  }
  return out;
}
