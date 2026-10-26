/** Hero-colored ultimate energy. One additive quad, advanced by the HUD clock. */
import { EffectAsset, Layers, Material, Node, resources, Sprite, UITransform, Vec4 } from 'cc';
import { uxFrame } from './Ux';

export class UltEnergyFx {
  loaded = false;
  private node = new Node('ultEnergy');
  private material: Material | null = null;
  private state = new Vec4(0, 0, 0, 2);
  private wasReady = false;
  private elapsed = 0;
  private age = 2;
  private releaseAge = 2;
  get releasing(): boolean { return this.releaseAge < 0.55; }
  get chargeVisibility(): number {
    return Math.max(0, Math.min(1, (this.releaseAge - 0.18) / 0.37));
  }

  release(): void {
    this.releaseAge = 0;
    this.wasReady = false;
    this.sync(0, 0, false);
  }

  constructor(parent: Node, x: number, y: number, tint = '#1F9EFF', diameter = 90) {
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.node.setPosition(x, y, 0);
    const size = 168 * diameter / 90;
    this.node.addComponent(UITransform).setContentSize(size, size);
    const sprite = this.node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.node.active = false;
    this.node.once(Node.EventType.NODE_DESTROYED, () => {
      this.loaded = false; this.material?.destroy(); this.material = null;
    });
    resources.load('fx/ult-energy', EffectAsset, (err, effect) => {
      if (err || !effect || !this.node.isValid) return;
      uxFrame('ult_energy_quad', frame => {
        if (!frame || !this.node.isValid) return;
        // The shader needs full 0..1 UVs; keep this quad outside dynamic atlases.
        frame.packable = false;
        this.material = new Material();
        this.material.initialize({ effectAsset: effect });
        const rgb = parseInt(tint.replace('#', ''), 16);
        this.material.setProperty('energyColor', new Vec4(
          ((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255, 1));
        this.material.setProperty('energyState', this.state);
        sprite.customMaterial = this.material;
        sprite.spriteFrame = frame;
        this.loaded = true;
        this.node.active = true;
      });
    });
  }

  sync(dt: number, pct: number, ready: boolean): void {
    if (!this.loaded || !this.material || !this.node.isValid) return;
    this.elapsed += Math.min(dt, 0.1);
    if (ready && !this.wasReady) this.age = 0;
    if (!ready && this.wasReady) this.releaseAge = 0;
    if (!ready) this.age = 2;
    this.age = Math.min(2, this.age + Math.min(dt, 0.1));
    this.releaseAge = Math.min(2, this.releaseAge + Math.min(dt, 0.1));
    this.wasReady = ready;
    const releasing = !ready && this.releasing;
    this.state.set(this.elapsed, Math.max(0, Math.min(1, pct)), ready ? 1 : releasing ? -1 : 0,
      releasing ? this.releaseAge : this.age);
    this.material.setProperty('energyState', this.state);
  }
}
