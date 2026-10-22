/** Continuous local motion on the existing combat silhouette; simulation origins stay fixed. */
import { EffectAsset, Material, Node, resources, Vec4 } from 'cc';
import { BattleSprite } from './BattleSprite';

interface Profile {
  arm: number; brace: number; recoil: number; shoulderX: number; shoulderY: number;
  cloth: number; breath: number; sniper: number; lean: number;
}
const PROFILES: Record<string, Profile> = {
  archer: { arm: .042, brace: .026, recoil: .65, shoulderX: .68, shoulderY: .42, cloth: .65, breath: .26, sniper: 0, lean: -.65 },
  sniper: { arm: .009, brace: .008, recoil: 2.8, shoulderX: .57, shoulderY: .27, cloth: .48, breath: .19, sniper: 1, lean: -1.1 },
  pyro:   { arm: .052, brace: .035, recoil: 1.0, shoulderX: .69, shoulderY: .38, cloth: .70, breath: .30, sniper: 0, lean: .5 },
  volt:   { arm: .042, brace: .030, recoil: .85, shoulderX: .72, shoulderY: .38, cloth: .62, breath: .27, sniper: 0, lean: .4 },
  mora:   { arm: .046, brace: .032, recoil: .8, shoulderX: .71, shoulderY: .39, cloth: .70, breath: .27, sniper: 0, lean: .35 },
};
let effect: EffectAsset | null = null;
let loading = false, failed = false;
const waiting: (() => void)[] = [];
function loadEffect(callback: () => void): void {
  if (effect || failed) { callback(); return; }
  waiting.push(callback);
  if (loading) return;
  loading = true;
  resources.load('fx/hero-motion', EffectAsset, (err, asset) => {
    if (err || !asset) failed = true;
    else { effect = asset; effect.addRef(); }
    loading = false;
    waiting.splice(0).forEach(fn => fn());
  });
}

export class HeroBattleMotion {
  private readonly profile: Profile;
  private material: Material | null = null;
  private age = 10;
  private heavy = false;
  private clock: number;
  private kick = 0;
  private brace = 0;
  private aim = 0;
  private readonly atlas = new Vec4();
  private readonly body = new Vec4();
  private readonly arm = new Vec4();
  private readonly shape = new Vec4();

  constructor(private art: BattleSprite, id: string) {
    this.profile = PROFILES[id] || PROFILES.archer;
    this.clock = Object.keys(PROFILES).indexOf(id) * 1.73;
    this.art.node.once(Node.EventType.NODE_DESTROYED, () => { this.material?.destroy(); this.material = null; });
    loadEffect(() => {
      if (!this.art.node.isValid || !effect) return;
      this.material = new Material();
      this.material.initialize({ effectAsset: effect, defines: { USE_TEXTURE: true } });
      this.apply();
    });
  }

  /** A new release drives the same rig; rapid volleys do not reset the displayed pose. */
  release(heavy: boolean): void {
    if (!heavy && this.heavy && this.age < .12) return;
    this.heavy = heavy;
    this.age = 0;
  }

  get attacking(): boolean {
    return this.age < (this.heavy ? .75 : .5) || this.kick > .01 || this.brace > .01;
  }

  tick(dt: number, prepare: number, targetLean: number, idle = true): void {
    // Breathing/cloth keep their current phase during combat; attack recoil still runs.
    if (idle) this.clock += dt;
    this.age += dt;
    const p = this.profile;
    const speed = this.heavy ? 6.5 : p.sniper ? 10 : 8;
    const impulse = (1 - Math.exp(-this.age * 100)) * Math.exp(-this.age * speed);
    // Exponential damping is frame-rate independent and keeps repeat shots continuous.
    this.kick += ((this.heavy ? 1.35 : 1) * impulse - this.kick) * (1 - Math.exp(-dt * 42));
    this.brace += (prepare - this.brace) * (1 - Math.exp(-dt * 22));
    this.aim += (targetLean - this.aim) * (1 - Math.exp(-dt * 7));
    this.apply();
  }

  private apply(): void {
    const sf = this.art.sprite.spriteFrame;
    if (!this.material || !sf) return;
    const p = this.profile, h = 146 * 360 / 336, w = h * sf.rect.width / sf.rect.height;
    this.atlas.set(sf.rect.x / sf.texture.width, sf.rect.y / sf.texture.height,
      sf.rect.width / sf.texture.width, sf.rect.height / sf.texture.height);
    this.body.set((this.aim * .8 + this.kick * p.lean) / w, -this.kick * p.recoil / h,
      Math.sin(this.clock * 1.85) * p.breath / h, p.cloth / w);
    this.arm.set(this.kick * p.arm - this.brace * p.brace, this.kick * (p.sniper ? 0 : .14), this.clock, this.brace);
    this.shape.set(p.shoulderX, p.shoulderY, p.sniper, w / h);
    this.material.setProperty('atlasRect', this.atlas);
    this.material.setProperty('bodyMotion', this.body);
    this.material.setProperty('armMotion', this.arm);
    this.material.setProperty('heroShape', this.shape);
    // Never expose default full-atlas UVs while the asynchronous sprite is still loading.
    if (this.art.sprite.customMaterial !== this.material) this.art.sprite.customMaterial = this.material;
  }
}
