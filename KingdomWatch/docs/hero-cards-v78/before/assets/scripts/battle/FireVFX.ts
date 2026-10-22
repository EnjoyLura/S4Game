/** Layered fire contacts: coherent painted cels, shared RGBA atlas,
 * fixed pool, and battle-clock motion. No gameplay state or tweens here.
 */
import { Color, EffectAsset, JsonAsset, Layers, Material, Node, Rect, resources, Size, Sprite, SpriteFrame, UITransform, Vec2 } from 'cc';

interface Part { node: Node; sprite: Sprite; frame: string; }
interface Fragment { part: Part; vx: number; vy: number; spin: number; }
interface Flight { root: Node; body: Part; tail: Part; }
interface Residue { mark: Part; glow: Part; }
interface Clip { part: Part; age: number; scale: number; }
interface BurnState { lifeId: number; pulse: number; clips: Clip[]; }
/** Read-only status view: every burn source already maintains these fields. */
export interface BurningTarget { node: Node; lifeId: number; dead: boolean; burnT: number; burnTick: number; burnPulse: number; def: { radius: number }; }
interface Burst {
  root: Node; ground: Node; core: Part; flames: Part[]; smoke: Part[]; dust: Part; scorch: Part;
  fragments: Fragment[]; age: number; life: number; radius: number; angle: number; blast: boolean; heavy: boolean;
  x: number; y: number;
}
const CAP = 16;
const CONTACT_CAP = 10;
const BLAST_CAP = 8;
const FLIGHT_CAP = 32;
const RESIDUE_CAP = 8;
const FLAME_IDS = ['flame_0', 'flame_1', 'flame_2', 'flame_3', 'flame_4', 'flame_5', 'flame_6', 'flame_7'];
// Short ignition, solid peak, then outgoing wisps. Blend only at cel boundaries.
const FLAME_TIME = [0, 0.018, 0.045, 0.10, 0.155, 0.210, 0.270, 0.320, 0.360];
// 图生视频命中序列（fx/pyro_hit，16 格 256px）：快攻绽放 → 慢衰余焰烟雾，纯黑底 ADD 混合。
const CLIP_CAP = 6;
const PYRO_CELL = 256;
// 每格时长：快攻绽放 → 慢衰消散；总和必须 < 普攻间隔，否则怪死了火还在原地烧
const PYRO_CEL_DUR = [0.04, 0.04, 0.04, 0.04, 0.05, 0.05, 0.05, 0.05, 0.065, 0.065, 0.065, 0.065];
const PYRO_CELS = PYRO_CEL_DUR.length;
const PYRO_CLIP_LIFE = PYRO_CEL_DUR.reduce((sum, seconds) => sum + seconds, 0);
const PYRO_ANCHOR_Y = 172;  // 首格火焰亮度质心（格内坐标，自顶向下）
const PYRO_FLAME_W = 88;    // 首格火焰宽度（决定格缩放 → 屏上火焰尺寸）
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => { const t = clamp(v); return t * t * (3 - 2 * t); };

export class FireVFX {
  readonly root: Node;
  readonly groundRoot: Node;
  loaded = false;
  private frames = new Map<string, SpriteFrame>();
  private clipFrames = new Map<string, SpriteFrame>();
  private craterFrames = new Map<string, SpriteFrame>();
  private clipFree: Clip[] = [];
  private clipsActive: Clip[] = [];
  private burning = new Map<BurningTarget, BurnState>();
  private burnFree: Clip[] = [];
  private clipLoaded = false;
  private craterLoaded = false;
  private material: Material | null = null;
  private active: Burst[] = [];
  private free: Burst[] = [];
  private flights: Flight[] = [];
  private flightCount = 0;
  private residues: Residue[] = [];
  private tint = new Color(255, 255, 255, 255);
  private sequence = 0;

  constructor(parent: Node, groundParent: Node, projectileParent: Node) {
    this.root = this.node('fireVfx', parent);
    this.groundRoot = this.node('fireGround', groundParent);
    // 坑分两层：焦痕垫底、余烬叠顶。同层兄弟按序渲染，跨坑时先铺全部焦痕再叠全部余烬。
    const markLayer = this.node('fireCraterMark', this.groundRoot);
    const glowLayer = this.node('fireCraterGlow', this.groundRoot);
    for (let i = 0; i < CAP; i++) this.free.push(this.create());
    for (let i = 0; i < RESIDUE_CAP; i++) {
      const mark = this.part('craterMark' + i, markLayer);
      const glow = this.part('craterGlow' + i, glowLayer);
      mark.node.active = false; glow.node.active = false;
      this.residues.push({ mark, glow });
    }
    for (let i = 0; i < FLIGHT_CAP; i++) {
      const root = this.node('fireFlight', projectileParent);
      const tail = this.part('fireTail', root), body = this.part('fireball', root);
      root.active = false; this.flights.push({ root, body, tail });
    }
    for (let i = 0; i < CLIP_CAP; i++) {
      const part = this.part('fireClip' + i, this.root);
      part.node.active = false;
      this.clipFree.push({ part, age: 0, scale: 1 });
    }
    resources.load('fx/pyro_hit.frames', JsonAsset, (err, data) => {
      if (err || !data || !this.root.isValid) return;
      resources.load('fx/pyro_hit/spriteFrame', SpriteFrame, (error, source) => {
        if (error || !source || !this.root.isValid) return;
        const rects = (data.json as { frames: Record<string, number[]> }).frames;
        for (const id of Object.keys(rects)) {
          const [x, y, w, h] = rects[id];
          const frame = new SpriteFrame();
          frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
          frame.packable = false;
          this.clipFrames.set(id, frame);
        }
        this.clipLoaded = true;
      });
    });
    // 坑贴图必须包一层自建 SpriteFrame：直存的 resources 产物会被场景重启时的
    // 自动释放掏空（texture/uv 全 null → 激活即崩），pyro_hit 同理用包装帧规避。
    resources.load('fx/crater_mark/spriteFrame', SpriteFrame, (err, markSrc) => {
      if (err || !markSrc || !this.root.isValid) return;
      const mark = new SpriteFrame();
      mark.reset({ texture: markSrc.texture, rect: new Rect(0, 0, markSrc.width, markSrc.height), originalSize: new Size(markSrc.width, markSrc.height), offset: new Vec2() });
      mark.packable = false;
      this.craterFrames.set('mark', mark);
      resources.load('fx/crater_embers/spriteFrame', SpriteFrame, (error, emberSrc) => {
        if (error || !emberSrc || !this.root.isValid) return;
        const embers = new SpriteFrame();
        embers.reset({ texture: emberSrc.texture, rect: new Rect(0, 0, emberSrc.width, emberSrc.height), originalSize: new Size(emberSrc.width, emberSrc.height), offset: new Vec2() });
        embers.packable = false;
        this.craterFrames.set('embers', embers);
        this.craterLoaded = true;
      });
    });
    resources.load('fx/fire_v2.frames', JsonAsset, (err, data) => {
      if (err || !data || !this.root.isValid) return;
      resources.load('fx/fire_v2/spriteFrame', SpriteFrame, (error, source) => {
        if (error || !source || !this.root.isValid) return;
        const rects = (data.json as { frames: Record<string, number[]> }).frames;
        for (const id of Object.keys(rects)) {
          const [x, y, w, h] = rects[id];
          const frame = new SpriteFrame();
          frame.reset({ texture: source.texture, rect: new Rect(x, y, w, h), originalSize: new Size(w, h), offset: new Vec2() });
          frame.packable = false;
          this.frames.set(id, frame);
        }
        resources.load('fx/fire-paint-v2', EffectAsset, (effectError, effect) => {
          if (effectError || !effect || !this.root.isValid) return;
          this.material = new Material();
          this.material.initialize({ effectAsset: effect, defines: { USE_TEXTURE: true } });
          for (const burst of this.free) for (const part of [...burst.flames, ...burst.smoke]) part.sprite.customMaterial = this.material;
          for (const flight of this.flights) flight.tail.sprite.customMaterial = this.material;
          this.loaded = true;
        });
      });
    });
    this.root.once(Node.EventType.NODE_DESTROYED, () => {
      this.burning.clear(); this.burnFree.length = 0;
      this.material?.destroy(); this.frames.forEach(frame => frame.destroy());
      this.clipFrames.forEach(frame => frame.destroy());
      this.craterFrames.forEach(frame => frame.destroy());
    });
  }

  /** Rendering slots only: projectile data, collision and velocity stay in ProjectileManager. */
  beginProjectileFrame(): void {
    for (let i = 0; i < this.flightCount; i++) this.flights[i].root.active = false;
    this.flightCount = 0;
  }

  projectile(x: number, y: number, vx: number, vy: number, size: number): boolean {
    if (!this.loaded || this.flightCount >= FLIGHT_CAP) return false;
    const f = this.flights[this.flightCount++], length = Math.hypot(vx, vy) || 1;
    const angle = Math.atan2(vy, vx) * 180 / Math.PI - 90;
    f.root.active = true; f.root.setPosition(x, y, 0);
    this.draw(f.tail, 'streak', size * 3.2, 180, -vx / length * size * 1.6, -vy / length * size * 1.6, angle + 180);
    this.draw(f.body, 'fireball', size * 2.65, 255, 0, 0, angle);
    return true;
  }

  /** Read-only view of the hero's existing four-second burn areas. */
  craters(areas: readonly { x: number; y: number; t: number }[], radius: number, clock: number): boolean {
    if (!this.loaded) return false;
    const slots = this.residues;
    const n = Math.min(slots.length, areas.length);
    for (let i = n; i < slots.length; i++) { slots[i].mark.node.active = false; slots[i].glow.node.active = false; }
    // 所有坑共用 mark 层与 glow 层：先铺全部焦痕、再叠全部余烬，跨坑不再互相盖。
    for (let i = 0; i < n; i++) {
      const c = areas[areas.length - 1 - i];
      const seed = Math.sin(c.x * 0.017 + c.y * 0.013);
      const fade = Math.min(1, c.t / 0.8, clamp((4 - c.t) / 0.08));
      let k = 0;
      for (let j = 0; j < areas.length; j++) {
        if (Math.hypot(areas[j].x - c.x, areas[j].y - c.y) < radius) k++;
      }
      const atten = 1 / Math.sqrt(Math.max(1, k));   // 近邻越多越衰减，叠点不烧成实心红饼
      if (this.craterLoaded) {
        // 沙环已从贴片抠除：叠加只会炭压炭加深，不会出现盖沙拼布。
        this.drawFrame(slots[i].mark, 'mark', radius * 2.45, 255 * fade, c.x, c.y - 6, seed * 7, 1, this.craterFrames);
      } else {
        this.draw(slots[i].mark, 'scorch', radius * 2.55, 118 * fade * atten, c.x, c.y - 6, seed * 7, 1.5);
      }
      if (this.craterLoaded) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * Math.PI * 1.05 + seed * 2.1);
        // 灰晕已从焦痕贴图抠除，炭体收紧后余烬斑同步收窄（2.3→1.7），避免亮斑飘在裸沙上
        this.drawFrame(slots[i].glow, 'embers', radius * 1.7, (110 + 145 * pulse) * fade * atten, c.x, c.y - 6, seed * 7, 1, this.craterFrames);
      } else {
        slots[i].glow.node.active = false;
      }
    }
    return true;
  }

  private node(name: string, parent: Node): Node {
    const n = new Node(name); n.layer = Layers.Enum.UI_2D; n.setParent(parent); return n;
  }

  private part(name: string, parent: Node): Part {
    const node = this.node(name, parent);
    node.addComponent(UITransform).setContentSize(1, 1);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
    return { node, sprite, frame: '' };
  }

  private create(): Burst {
    const root = this.node('fireBurst', this.root), ground = this.node('fireDecal', this.groundRoot);
    // Smoke is behind the hot body. Ground residue is below enemies and the wall.
    const smoke = [this.part('smokeA', root), this.part('smokeB', root)];
    const flames = [this.part('flameA', root), this.part('flameB', root)];
    const core = this.part('hotCore', root);
    const fragments = Array.from({ length: 4 }, (_, i) => ({ part: this.part('fragment' + i, root), vx: 0, vy: 0, spin: 0 }));
    const scorch = this.part('scorch', ground), dust = this.part('groundDust', ground);
    root.active = ground.active = false;
    return { root, ground, core, flames, smoke, fragments, scorch, dust, age: 0, life: 1, radius: 1, angle: 0, blast: false, heavy: false, x: 0, y: 0 };
  }

  /** Return true when handled, including intentional drops under the budget. */
  hit(x: number, y: number, heavy: boolean, angle = Math.PI / 2): boolean {
    if (!this.loaded) return false;
    if (this.active.filter(b => !b.blast).length >= CONTACT_CAP) return true;
    const burst = this.obtain(false);
    if (burst) this.start(burst, x, y, heavy ? 22 : 14, angle, false, heavy);
    return true;
  }

  /** 图生视频命中序列：直接命中处的灼烧 + 消散。加载失败/未就绪返回 false 走引擎兜底。 */
  hitClip(x: number, y: number, heavy: boolean): boolean {
    if (!this.clipLoaded || !this.material) return false;
    if (this.clipsActive.length >= CLIP_CAP) return true;
    const clip = this.clipFree.pop();
    if (!clip) return true;
    const scale = (heavy ? 27 : 21) / PYRO_FLAME_W;
    clip.age = 0; clip.scale = scale;
    clip.part.node.active = true;
    // 格内火焰质心在中心下方 (PYRO_ANCHOR_Y−CELL/2)px：把质心对到命中点，烟雾自然升到上方
    clip.part.node.setPosition(x, y + (PYRO_ANCHOR_Y - PYRO_CELL / 2) * scale, 0);
    clip.part.node.getComponent(UITransform)!.setContentSize(PYRO_CELL * scale, PYRO_CELL * scale);
    clip.part.sprite.customMaterial = this.material;
    clip.part.frame = '';
    this.clipsActive.push(clip);
    return true;
  }

  private renderClip(clip: Clip): void {
    let acc = 0, index = PYRO_CELS - 1;
    for (let i = 0; i < PYRO_CELS; i++) {
      acc += PYRO_CEL_DUR[i];
      if (clip.age < acc) { index = i; break; }
    }
    const id = 'pyro_hit_' + index;
    if (clip.part.frame !== id) {
      clip.part.sprite.spriteFrame = this.clipFrames.get(id) || null;
      clip.part.frame = id;
    }
    this.tint.set(255, 255, 255, 255);
    clip.part.sprite.color = this.tint;
  }

  /** Each actual burn tick starts the original, unscaled forward clip.
   * Its last 0.12s can finish beneath the next tick; never speed up or restart a playing clip. */
  syncBurns(targets: readonly BurningTarget[], dt: number): void {
    for (const [target, state] of this.burning) {
      if (target.dead || state.lifeId !== target.lifeId || !target.node.isValid || !target.node.parent) {
        for (const clip of state.clips) this.releaseBurnClip(clip);
        this.burning.delete(target);
      }
    }
    for (const target of targets) {
      if (target.dead || target.burnT <= 0 || !target.node.isValid || !target.node.parent) continue;
      if (!this.burning.has(target)) this.burning.set(target, { lifeId: target.lifeId, pulse: target.burnPulse, clips: [] });
    }
    for (const [target, state] of this.burning) {
      for (let i = state.clips.length - 1; i >= 0; i--) {
        const clip = state.clips[i]; clip.age += dt;
        if (clip.age >= PYRO_CLIP_LIFE) { state.clips.splice(i, 1); this.releaseBurnClip(clip); }
      }
      const ticked = target.burnPulse > state.pulse;
      state.pulse = target.burnPulse;
      if (ticked && this.clipLoaded && this.material && state.clips.length < 2) {
        const clip = this.burnFree.pop() || { part: this.part('burnStatusFlame', this.root), age: 0, scale: 1 };
        clip.age = target.burnTick; clip.scale = 21 / PYRO_FLAME_W;
        clip.part.frame = '';
        // Local attachment inherits movement, depth sorting, and scene destruction.
        clip.part.node.setParent(target.node);
        clip.part.node.setPosition(0, target.def.radius * .4 + (PYRO_ANCHOR_Y - PYRO_CELL / 2) * clip.scale, 0);
        clip.part.node.getComponent(UITransform)!.setContentSize(PYRO_CELL * clip.scale, PYRO_CELL * clip.scale);
        clip.part.sprite.customMaterial = this.material;
        this.renderClip(clip);
        clip.part.node.active = true;
        state.clips.push(clip);
      }
      for (const clip of state.clips) this.renderClip(clip);
      // The final damage tick keeps its natural tail even after the gameplay status expires.
      if (target.burnT <= 0 && !state.clips.length) this.burning.delete(target);
    }
  }

  private releaseBurnClip(clip: Clip): void {
    clip.part.node.active = false; clip.part.node.setParent(this.root); this.burnFree.push(clip);
  }

  blast(x: number, y: number, radius: number): boolean {
    if (!this.loaded) return false;
    if (this.active.filter(b => b.blast).length >= BLAST_CAP) return true;
    // Damage contact is reported just before the AoE event. Upgrade that same
    // contact instead of drawing two opaque explosions at one collision.
    const contact = this.active.find(b => !b.blast && b.age < 0.035 && Math.hypot(b.x - x, b.y - y) < 20);
    const burst = contact || this.obtain(true);
    if (burst) this.start(burst, x, y, Math.min(66, Math.max(34, radius * 0.38 + 16)), contact?.angle ?? Math.PI / 2, true, true);
    return true;
  }

  private obtain(priority: boolean): Burst | null {
    let burst = this.free.pop();
    if (!burst && priority) {
      const index = this.active.findIndex(b => !b.blast);
      if (index >= 0) burst = this.active.splice(index, 1)[0];
    }
    if (!burst) return null;
    this.active.push(burst); return burst;
  }

  private start(b: Burst, x: number, y: number, radius: number, angle: number, blast: boolean, heavy: boolean): void {
    b.x = x; b.y = y; b.radius = radius; b.angle = angle; b.blast = blast; b.heavy = heavy;
    b.age = 0; b.life = blast ? 0.78 : heavy ? 0.43 : 0.32;
    b.root.active = true; b.ground.active = blast;
    b.root.setPosition(x, y, 0); b.ground.setPosition(x, y - 8, 0);
    const seq = ++this.sequence;
    for (let i = 0; i < b.fragments.length; i++) {
      // Local deterministic variation never consumes the gameplay random stream.
      const variation = Math.sin(seq * 17.31 + i * 4.91) * 0.5 + 0.5;
      const a = blast ? i * Math.PI * 0.5 + variation * 0.6 : angle + (i - (heavy ? 1.5 : 0.5)) * 0.43;
      const speed = (blast ? 225 : 145) * (0.75 + variation * 0.5);
      b.fragments[i].vx = Math.cos(a) * speed; b.fragments[i].vy = Math.sin(a) * speed;
      b.fragments[i].spin = (variation - 0.5) * 180;
    }
    this.render(b);
  }

  private draw(part: Part, frame: string, width: number, alpha: number, x = 0, y = 0, angle = 0, ratio = 1): void {
    this.drawFrame(part, frame, width, alpha, x, y, angle, ratio, this.frames);
  }

  private drawFrame(part: Part, frame: string, width: number, alpha: number, x: number, y: number, angle: number, ratio: number, frames: Map<string, SpriteFrame>): void {
    const sf = frames.get(frame) || null;
    const visible = alpha > 0.5 && width > 0 && !!sf;
    // 先设帧再激活：onEnable 会立即构建网格，激活后再换帧会以旧帧（或空帧）_FLUSH
    if (part.frame !== frame) { part.sprite.spriteFrame = sf; part.frame = frame; }
    part.node.active = visible;
    if (!visible) return;
    part.node.getComponent(UITransform)!.setContentSize(width, width * ratio);
    part.node.setPosition(x, y, 0); part.node.angle = angle;
    this.tint.set(255, 255, 255, Math.round(Math.min(255, alpha))); part.sprite.color = this.tint;
  }

  private render(b: Burst): void {
    const t = b.age, r = b.radius;
    if (b.blast) {
      let stage = 0;
      while (stage < 7 && t >= FLAME_TIME[stage + 1]) stage++;
      const next = FLAME_TIME[stage + 1];
      const mix = stage < 7 ? smooth((t - next + 0.008) / 0.008) : 0;
      const fade = 1 - smooth((t - 0.270) / 0.090);
      const growth = 0.86 + 0.20 * (1 - Math.pow(1 - clamp(t / 0.045), 3)) - 0.10 * smooth((t - 0.16) / 0.20);
      const size = r * 3.0 * growth;
      this.draw(b.flames[0], FLAME_IDS[stage], size, 248 * fade * (1 - mix));
      this.draw(b.flames[1], FLAME_IDS[Math.min(7, stage + 1)], size, 248 * fade * mix);
    } else {
      // Splash neighbours get a small sharp contact, never another full fireball.
      const fade = 1 - smooth(t / (b.heavy ? 0.19 : 0.13));
      this.draw(b.flames[0], 'fireball', r * 1.65, (b.heavy ? 225 : 145) * fade, 0, 0, b.angle * 180 / Math.PI - 90);
      b.flames[1].node.active = false;
    }
    this.draw(b.core, 'core', r * (1.1 + smooth(t / 0.035) * 0.48), 250 * (1 - smooth(t / 0.065)), 0, 0, b.angle * 180 / Math.PI - 90);
    const smokeLife = b.blast ? 0.56 : b.heavy ? 0.40 : 0.28;
    const smokeT = clamp((t - 0.075) / (smokeLife - 0.075));
    const smokeAlpha = (b.blast ? 66 : b.heavy ? 24 : 0) * smooth((t - 0.065) / 0.090) * (1 - smooth(smokeT));
    const smokeMix = smooth(smokeT);
    this.draw(b.smoke[0], 'smoke_a', r * (1.75 + smokeT * 0.50), smokeAlpha * (1 - smokeMix), -r * 0.08, r * 0.10 + smokeT * 10, -smokeT * 5);
    this.draw(b.smoke[1], 'smoke_b', r * (1.75 + smokeT * 0.50), smokeAlpha * smokeMix, r * 0.06, r * 0.10 + smokeT * 10, smokeT * 5);
    for (let i = 0; i < b.fragments.length; i++) {
      const f = b.fragments[i], fragmentT = clamp(t / (b.blast ? 0.31 : 0.22));
      const alpha = (b.blast || b.heavy || i < 2) ? 225 * (1 - smooth(fragmentT)) : 0;
      this.draw(f.part, i % 2 ? 'chip' : 'ember', (i % 2 ? 16 : 12) * (1 - fragmentT * 0.30), alpha,
        f.vx * t, f.vy * t - 390 * t * t, b.angle * 180 / Math.PI - 90 + f.spin * t);
    }
    if (b.blast) {
      this.draw(b.dust, 'dust', r * (2.25 + smooth(t / 0.22) * 0.45), 72 * smooth(t / 0.035) * (1 - smooth(t / 0.40)), 0, -3);
      this.draw(b.scorch, 'scorch', r * 2.1, 85 * smooth(t / 0.045) * (1 - smooth((t - 0.30) / 0.48)));
    }
  }

  tick(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i]; b.age += dt;
      if (b.age >= b.life) {
        b.root.active = b.ground.active = false; this.active.splice(i, 1); this.free.push(b);
      } else this.render(b);
    }
    let total = 0;
    for (const d of PYRO_CEL_DUR) total += d;
    for (let i = this.clipsActive.length - 1; i >= 0; i--) {
      const clip = this.clipsActive[i]; clip.age += dt;
      if (clip.age >= total) {
        clip.part.node.active = false; this.clipsActive.splice(i, 1); this.clipFree.push(clip);
      } else this.renderClip(clip);
    }
  }
}
