/**
 * 怪物（§3.4 行为：松散虫群下行 + 正弦游动 + 自动分离；近战贴线攻击 / 远程停位投掷 / 萨满周期治疗）
 * 受击只闪红不掉速（用户确认：控制效果只属于特定 buff）；仅 BOSS 显示血条（M0 1-1 无 BOSS，钩子保留）
 */
import { Color, Graphics, isValid, Label, Layers, Node, Tween, UIOpacity } from 'cc';
import { MOB_DMG_MUL, MOB_HP_MUL, MobDef } from '../config/Mobs';
import { LINE_Y, LO, PAL } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { BattleSprite } from './BattleSprite';
import { FloatEvent } from './FloatText';
import { getMobAnims, MobClip } from './MobAnim';
import { drawFootIce } from './FrostVFX';
import { clearDepthSorter, DepthSprite, depthSprites, setDepthSorter } from './BattleDepth';
import { MonsterDeath, warmMonsterDeath } from './MonsterDeath';

/** 攻击序列帧一次性时长（s）：与 lunge 0.2s 前摇错开，收招略长观感更实 */
const ATK_ANIM = 0.34;
/** 统一静态/序列帧显示高度，保持脚底锚点与碰撞半径不变。 */
const MOB_ART_HEIGHT = 3.85;
/** Start the art's feet just beyond the physical top edge, then walk into view.
 * Do not use the HUD inset or shared SPAWN_Y (also used by ultimate presentations). */
function mobEntryY(radius: number): number {
  return LO.half + radius * .82 + 10;
}

export type MonsterHitCtx = {
  floatParent: Node;
  dmgNumber: (x: number, y: number, text: string, color: string, big?: boolean, event?: FloatEvent) => void;
  impact?: (x: number, y: number, hero: string, heavy: boolean, angle?: number) => void;
};

export class Monster {
  node = new Node('mob');
  def!: MobDef;
  hp = 0;
  maxHp = 0;
  state: 'move' | 'hold' | 'attack' = 'move';
  dead = false;
  baseX = 0;
  life = 0;
  /** 地面基线固定；脚印只随步态改变位置与重量，不带动角色上下移动。 */
  groundOffset = 3 / 160;
  footLeftX = 0;
  footRightX = 0;
  footLeftWeight = 0;
  footRightWeight = 0;
  atkT = 0;
  healT = 0;
  slowT = 0;
  /** 减速幅度（0.2=减速20%；applySlow 取最强者；移动 mul = 1-slowAmp） */
  slowAmp = 0.2;
  burnT = 0;
  burnTick = 0;
  burnDps = 0;
  /** 眩晕硬直（预留：真正的眩晕类 buff 才会写入；受击不再写） */
  stunT = 0;
  /** 冰封与雷系眩晕独立；解冻时才启动后续减速。 */
  freezeT = 0;
  private freezeAge = 0;
  private freezeSlowAmp = 0;
  private freezeSlowDur = 0;
  private thawT = 0;
  private walkClock = 0;
  /** 感电（沃尔·雷霆）：受雷系命中后受伤放大，持续 shockT 秒 */
  shockT = 0;
  shockAmp = 0;
  /** 易伤（焰法陨石坑）：站在坑内受伤放大，出坑后短暂残留 */
  vulnT = 0;
  vulnAmp = 0;
  /** 猎杀标记独立计时；同类易伤取高，不能让火坑续长红色准星。 */
  hunterMarkT = 0;
  hunterMarkAmp = 0;
  private hunterMarkVisual = false;
  private hunterMarkAge = 0;
  private hunterMarkTint = new Color();
  /** 冲撞/投掷前摇演出剩余时间（手动衰减，避免逐次创建 tween） */
  lungeT = 0;
  /** 攻击序列帧一次性播放剩余时间（atkAnimT>0 时压过步态帧） */
  private atkAnimT = 0;
  private anims: Map<string, MobClip> | null = null;

  private g!: Graphics;
  private ctx!: MonsterHitCtx;
  private holdY = 0;
  private mgrRef: MonsterManager | null = null;
  /** 受击闪红蒙层（只闪红不变形，用户确认；透明度 tick 手动衰减，零 tween） */
  private flashNode: Node | null = null;
  private flashOp: UIOpacity | null = null;
  private flashT = 0;
  private art: BattleSprite | null = null;
  private deathMotion: MonsterDeath | null = null;
  private tint = new Color();
  private lastTint = '';

  init(def: MobDef, parent: Node, x: number, ctx: MonsterHitCtx, mgr?: MonsterManager): void {
    this.deathMotion?.reset();
    this.def = def;
    this.ctx = ctx;
    this.mgrRef = mgr || null;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.state = 'move';
    this.dead = false;
    this.life = Math.random() * 10;
    this.walkClock = this.life;
    this.groundOffset = 3 / 160;
    this.footLeftWeight = this.footRightWeight = 0;
    this.atkT = def.atkInterval;
    this.healT = def.atkInterval;
    this.slowT = this.burnT = this.burnTick = this.burnDps = this.stunT = this.lungeT = this.flashT = 0;
    this.atkAnimT = 0;
    this.freezeT = this.freezeAge = this.freezeSlowAmp = this.freezeSlowDur = this.thawT = 0;
    this.slowAmp = 0.2;
    this.shockT = this.shockAmp = 0;
    this.vulnT = this.vulnAmp = 0;
    this.hunterMarkT = this.hunterMarkAmp = this.hunterMarkAge = 0;
    this.hunterMarkVisual = false;
    this.baseX = x;
    this.node.removeFromParent();
    this.node.setPosition(x, mobEntryY(def.radius) + Math.random() * 12, 0);
    this.node.setScale(1, 1, 1);
    this.node.angle = 0;
    this.lastTint = '';
    const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    Tween.stopAllByTarget(op); // 复用池化对象时掐断上一世的消亡渐隐
    op.opacity = 255;
    this.node.layer = Layers.Enum.UI_2D;
    this.node.setParent(parent);
    this.draw();
    this.buildArt();
  }

  private buildArt(): void {
    const r = this.def.radius;
    if (!this.art) {
      this.art = new BattleSprite(this.node, 'battle_mobs_v2', () => { this.g.enabled = false; });
      this.deathMotion = new MonsterDeath(this.node, this.art);
    }
    this.art.node.setPosition(0, -r * 0.82, 0);
    this.art.show(this.def.id, r * MOB_ART_HEIGHT);
    getMobAnims(a => { this.anims = a; });
    Tween.stopAllByTarget(this.art.node);
    this.art.node.setScale(1, 1, 1); this.art.node.angle = 0;
    this.art.cold(null);
    this.art.tint(Color.WHITE);
    if (this.art.loaded) this.g.enabled = false;
  }

  private tickArt(dt: number): void {
    if (!this.art?.loaded) return;
    if (this.immobilized) {
      // Hold the current walk/attack cel instead of snapping to idle or continuing a frozen attack.
      this.syncArtTint();
      if (this.flashNode) this.flashNode.active = false;
      return;
    }
    const clip = this.anims?.get(this.def.id);
    if (clip && clip.walk.length) {
      // 序列帧模式：攻击一次性 > 步态循环（速度映射播放速率，减速同步变慢）> 待机第 0 帧
      const h = this.def.radius * MOB_ART_HEIGHT;
      if (this.atkAnimT > 0 && clip.attack.length) {
        this.footLeftWeight = this.footRightWeight = 0;
        this.atkAnimT = Math.max(0, this.atkAnimT - dt);
        const p = 1 - this.atkAnimT / ATK_ANIM;
        const t = Math.min(clip.attack.length - 1, p * clip.attack.length);
        const i = Math.floor(t);
        this.art.showSeq(clip.attack, i, i >= clip.attack.length - 1 ? 0 : t - i, h);
      } else if (this.state === 'move') {
        // 步态节奏：以源视频步态环真实时长为基准实时播放（相位连贯不踉跄），按移速微调档位，减速同步变慢
        const tempo = Math.min(1.25, Math.max(0.75, this.def.speed / 45));
        const cps = (1 / clip.loopDur) * tempo;
        const t = this.walkClock * cps * clip.walk.length;
        const index = Math.floor(t) % clip.walk.length;
        // 原视频已经提供完整步态：避免两帧鞋底叠加形成半透明滑动残影。
        this.art.showSeq(clip.walk, index, 0, h);
        this.syncGroundContact(clip, index, t - Math.floor(t));
      } else {
        this.art.showSeq(clip.walk, 0, 0, h);
        this.syncGroundContact(clip, 0, 0);
      }
      this.syncArtTint();
      if (this.flashNode) this.flashNode.active = false;
      return;
    }
    // 程序化步态兜底（序列帧缺失时保留旧行为）
    const moving = this.state === 'move';
    const gait = moving ? Math.sin(this.walkClock * (this.def.id === 'wolf_rider' ? 12 : 8)) : 0;
    this.art.node.angle = gait * 2.2;
    this.art.node.setScale(1 + gait * 0.012, 1 + Math.abs(gait) * 0.017, 1);
    this.syncArtTint();
    // Artwork tint follows the silhouette, replacing rectangular status masks.
    if (this.flashNode) this.flashNode.active = false;
  }

  private syncArtTint(): void {
    const cold = this.freezeT > 0 ? 'frozen' : this.slowT > 0 ? 'slow' : null;
    this.art?.cold(cold);
    // Loaded material supplies a real blue mix. Colder multiply tint is only the loading fallback.
    let tint = '#FFFFFF';
    if (this.flashT > 0) tint = '#FF9990';
    else if (cold && !this.art?.coldReady) tint = cold === 'frozen' ? '#91C3ED' : '#BCD8EF';
    else if (!cold && this.shockT > 0) tint = '#D8B5FF';
    if (tint !== this.lastTint) { this.lastTint = tint; Color.fromHEX(this.tint, tint); this.art?.tint(this.tint); }
  }

  private syncGroundContact(clip: MobClip, index: number, frac: number): void {
    this.groundOffset = clip.groundOffset;
    const a = clip.feet[index];
    const b = clip.feet[(index + 1) % clip.feet.length];
    if (!a || !b) { this.footLeftWeight = this.footRightWeight = 0; return; }
    const mix = (i: number): number => a[i] + (b[i] - a[i]) * frac;
    this.footLeftX = mix(0);
    this.footRightX = mix(2);
    // 抬脚阴影变淡，支撑脚阴影变实；阴影始终留在同一地面上。
    this.footLeftWeight = Math.max(0, Math.min(1, 1 - (mix(1) - this.groundOffset) / 0.055));
    this.footRightWeight = Math.max(0, Math.min(1, 1 - (mix(3) - this.groundOffset) / 0.055));
  }

  private draw(): void {
    if (!this.g) {
      this.g = this.node.addComponent(Graphics);
    }
    const g = this.g;
    g.enabled = true;
    const r = this.def.radius;
    g.clear();
    g.fillColor = this.hex(this.def.color);
    g.strokeColor = this.hex(PAL.ink);
    g.lineWidth = 3;
    g.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.45);
    g.fill();
    g.stroke();
    // 眼睛
    g.fillColor = Color.WHITE;
    g.circle(-r * 0.35, r * 0.15, r * 0.14);
    g.fill();
    g.circle(r * 0.35, r * 0.15, r * 0.14);
    g.fill();
    // 类型标记：远程=石丸 / 治疗=十字 / 精英=金框
    if (this.def.kind === 'ranged') {
      g.fillColor = this.hex('#B2A48B');
      g.circle(0, -r * 0.35, r * 0.22);
      g.fill();
    } else if (this.def.kind === 'heal') {
      g.strokeColor = Color.WHITE;
      g.lineWidth = 3;
      g.moveTo(-r * 0.3, -r * 0.5);
      g.lineTo(r * 0.3, -r * 0.5);
      g.moveTo(0, -r * 0.75);
      g.lineTo(0, -r * 0.25);
      g.stroke();
    }
    if (this.def.elite) {
      g.strokeColor = this.hex(PAL.gold);
      g.lineWidth = 4;
      g.roundRect(-r - 4, -r * 0.9 - 4, r * 2 + 8, r * 1.8 + 8, r * 0.5);
      g.stroke();
    }
    // 受击闪红蒙层：随体型重绘（半径随怪种复用变化），受击时显示、tick 手动淡出
    if (!this.flashNode) {
      this.flashNode = new Node('mobFlash');
      this.flashNode.layer = Layers.Enum.UI_2D;
      this.flashNode.setParent(this.node);
      this.flashOp = this.flashNode.addComponent(UIOpacity);
    }
    const fg = this.flashNode.getComponent(Graphics) || this.flashNode.addComponent(Graphics);
    fg.clear();
    const fc = this.hex('#E5484D');
    fc.a = 150;
    fg.fillColor = fc;
    fg.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.45);
    fg.fill();
    this.flashNode.active = false;
  }

  private hex(h: string): Color {
    const c = new Color();
    Color.fromHEX(c, h);
    return c;
  }

  get x(): number { return this.node.position.x; }
  get y(): number { return this.node.position.y; }
  get depthY(): number { return this.y - this.def.radius * 0.82; }
  get isBoss(): boolean { return !!this.def.boss || this.def.id === 'goblin_king'; }
  get immobilized(): boolean { return this.freezeT > 0 || this.stunT > 0; }

  drawIceFeet(g: Graphics): void {
    if (this.freezeT <= 0 && this.thawT <= 0) return;
    const r = this.def.radius;
    const footY = this.y - r * 0.82 + r * MOB_ART_HEIGHT * this.groundOffset;
    drawFootIce(g, this.x, footY, r, this.freezeAge, this.freezeT, this.thawT);
  }

  /** 单帧推进；返回是否死亡（死亡由 manager 清理） */
  tick(dt: number, line: { takeDamage: (d: number) => void }, mgr: MonsterManager): void {
    if (this.dead) return;
    this.deathMotion?.prepare();
    this.life += dt;
    const frozenLeft = this.freezeT;
    const motionDt = Math.max(0, dt - Math.max(this.freezeT, this.stunT));
    this.thawT = Math.max(0, this.thawT - dt);
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    if (this.slowT <= 0) this.slowAmp = 0.2;
    if (this.shockT > 0) this.shockT = Math.max(0, this.shockT - dt);
    if (this.vulnT > 0) this.vulnT = Math.max(0, this.vulnT - dt);
    if (this.hunterMarkT > 0) {
      this.hunterMarkAge += dt;
      this.hunterMarkT = Math.max(0, this.hunterMarkT - dt);
      if (this.hunterMarkT <= 0) { this.hunterMarkAmp = 0; this.hunterMarkVisual = false; }
    }
    if (this.stunT > 0) this.stunT = Math.max(0, this.stunT - dt);
    if (frozenLeft > 0) {
      this.freezeAge += Math.min(dt, frozenLeft);
      this.freezeT = Math.max(0, frozenLeft - dt);
      if (this.freezeT <= 0) {
        // Account for the fraction of this simulation step that occurs after thawing.
        const afterThaw = Math.max(0, dt - frozenLeft);
        if (this.freezeSlowDur > afterThaw) this.applySlow(this.freezeSlowAmp, this.freezeSlowDur - afterThaw);
        this.freezeSlowAmp = this.freezeSlowDur = 0;
        this.thawT = Math.max(0, 0.26 - afterThaw);
      }
    }
    // 受击闪红淡出（零 tween，受击高峰期零分配）
    if (this.flashT > 0 && this.flashOp) {
      this.flashT -= dt;
      this.flashOp.opacity = Math.max(0, Math.floor(255 * this.flashT / 0.12));
      if (this.flashT <= 0 && this.flashNode) this.flashNode.active = false;
    }
    if (this.state === 'move') this.walkClock += motionDt * (this.slowT > 0 ? 1 - this.slowAmp : 1);
    this.tickArt(motionDt);
    // 点燃 DoT：每 0.5s 聚合一条（§3.11）
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnTick += dt;
      if (this.burnTick >= 0.5) {
        this.burnTick -= 0.5;
        this.takeDamage(this.burnDps * 0.5, false, 'burn');
      }
      if (this.dead) return;
    }

    // Control stops movement and attacks, while burn damage and other status timers continue.
    if (motionDt <= 0) return;

    const mul = this.slowT > 0 ? (1 - this.slowAmp) : 1;
    if (this.state === 'move') {
      // 直线行进（用户确认：不蛇形）；横向松散由出生 x 与分离逻辑保证
      this.node.setPosition(this.baseX, this.node.position.y - this.def.speed * mul * motionDt, 0);
      const reach = this.def.kind === 'ranged' ? (this.def.atkRange || 0) : this.def.radius * 0.5;
      if (this.node.position.y - LINE_Y <= reach) {
        this.holdY = this.node.position.y;
        this.state = this.def.kind === 'melee' ? 'attack' : 'hold';
        this.atkT = Math.min(this.atkT, 0.4);
      }
    }
    if (this.state === 'attack' || this.state === 'hold') {
      this.atkT -= motionDt;
      if (this.atkT <= 0) {
        this.atkT = this.def.atkInterval;
        if (this.def.kind === 'heal') {
          this.atkAnimT = ATK_ANIM;   // 萨满施法也走攻击一次性帧（缺 attack 段则自动退化为待机帧）
          mgr.healAround(this, 160, this.def.healAmount || 40);
        } else {
          line.takeDamage(this.def.dmg);
          this.lunge();
          // 近战/石弹命中防线的概率词条（POW!/SOK!/咚!，30% 概率，ComicPop 内掷骰）
          bus.emit(EVT.COMIC_POP, this.x, this.y + this.def.radius, this.def.kind === 'ranged' ? 'stoneHit' : 'meleeHit');
        }
      }
      // 冲撞/投掷前摇（手动正弦脉冲，代替逐次 tween）
      if (this.lungeT > 0) {
        this.lungeT = Math.max(0, this.lungeT - motionDt);
        const pr = 1 - this.lungeT / 0.2;
        this.node.setPosition(this.node.position.x, this.holdY - Math.sin(pr * Math.PI) * 10, 0);
      }
    }
  }

  private lunge(): void {
    this.lungeT = 0.2;
    this.atkAnimT = ATK_ANIM;
  }

  /** 受击；crit 用于飘字样式；ignoreRes=无视物抗（狙击大招等）；返回是否击杀
   *  受击只掉血+闪红，不硬直/减速/击退——控制只来自特定 buff（applySlow 等后续技能效果） */
  /** 感电：雷系命中后受伤放大 3s（重复命中刷新时长，取更高倍率） */
  applyShock(amp: number, dur: number): void {
    this.shockAmp = Math.max(this.shockAmp, amp);
    this.shockT = Math.max(this.shockT, dur);
  }

  /** 易伤：坑内每帧刷新，出坑残留 dur */
  applyVuln(amp: number, dur: number): void {
    this.vulnAmp = Math.max(this.vulnAmp, amp);
    this.vulnT = Math.max(this.vulnT, dur);
  }

  applyHunterMark(amp: number, dur: number, visual: boolean): void {
    if (this.dead || amp <= 0 || dur <= 0) return;
    if (this.hunterMarkT <= 0) {
      this.hunterMarkAmp = 0; this.hunterMarkVisual = false; this.hunterMarkAge = 0;
    }
    this.hunterMarkAmp = Math.max(this.hunterMarkAmp, amp);
    this.hunterMarkT = Math.max(this.hunterMarkT, dur);
    this.hunterMarkVisual = this.hunterMarkVisual || visual;
    if (this.hunterMarkVisual) this.mgrRef?.refreshHunterMarks();
  }

  /** One shared Graphics layer draws marks above the complete current monster frame. */
  drawHunterMark(g: Graphics): void {
    if (this.dead || this.hunterMarkT <= 0 || !this.hunterMarkVisual) return;
    const x = this.x, y = this.y + this.def.radius * (MOB_ART_HEIGHT - .82) + 19;
    const r = 11 + 4 * Math.exp(-this.hunterMarkAge * 18);
    const alpha = Math.round(255 * Math.min(1, this.hunterMarkT / .2));
    for (let band = 0; band < 2; band++) {
      this.hunterMarkTint.set(band ? 63 : 10, band ? 163 : 34, band ? 255 : 65, band ? alpha : alpha * .8);
      g.strokeColor = this.hunterMarkTint; g.lineWidth = band ? 2.2 : 5;
      g.circle(x, y, r); g.stroke();
      g.moveTo(x - r - 5, y); g.lineTo(x - r + 4, y);
      g.moveTo(x + r - 4, y); g.lineTo(x + r + 5, y);
      g.moveTo(x, y - r - 5); g.lineTo(x, y - r + 4);
      g.moveTo(x, y + r - 4); g.lineTo(x, y + r + 5); g.stroke();
    }
    this.hunterMarkTint.set(183, 233, 255, alpha); g.fillColor = this.hunterMarkTint;
    g.circle(x, y, 1.8); g.fill();
  }

  takeDamage(amount: number, crit: boolean, killerId: string, ignoreRes = false, resCut = 0, impactAngle?: number, heavy = false): boolean {
    if (this.dead) return false;
    if (this.def.physRes && !ignoreRes) amount *= 1 - this.def.physRes * (1 - resCut);   // resCut=无视防御比例（英雄突破）
    if (this.shockT > 0) amount *= 1 + this.shockAmp;
    const vulnerability = Math.max(this.vulnT > 0 ? this.vulnAmp : 0, this.hunterMarkT > 0 ? this.hunterMarkAmp : 0);
    if (vulnerability > 0) amount *= 1 + vulnerability;
    this.hp -= amount;
    if (amount > 0 && killerId !== 'burn' && killerId !== 'gm') Sfx.impact(killerId, heavy || crit);
    this.ctx.dmgNumber(this.x, this.y + this.def.radius * 2.6,
      String(Math.round(amount)), crit ? '#FF3030' : '#FFFFFF', crit, { target: this, amount, periodic: killerId === 'burn' });
    this.ctx.impact?.(this.x, this.y + this.def.radius * 0.4, killerId, heavy || crit || this.hp <= 0 && !!this.def.elite, impactAngle);
    this.flash();
    if (this.hp <= 0) {
      this.die(killerId, impactAngle, heavy || crit, amount);
      return true;
    }
    return false;
  }

  private flash(): void {
    // 只闪红不变形（用户确认）；淡出由 tick 手动衰减（零 tween，受击高峰零分配）
    this.flashT = 0.12;
    if (this.art?.loaded) {
      this.lastTint = '#FF9990';
      Color.fromHEX(this.tint, this.lastTint); this.art.tint(this.tint);
      if (this.flashNode) this.flashNode.active = false;
      return;
    }
    if (this.flashNode && this.flashOp) {
      this.flashNode.active = true;
      this.flashOp.opacity = 255;
    }
  }

  private die(killerId: string, angle: number | undefined, heavy: boolean, amount: number): void {
    this.dead = true;
    const marked = this.hunterMarkVisual;
    this.hunterMarkT = this.hunterMarkAmp = this.hunterMarkAge = 0;
    this.hunterMarkVisual = false;
    if (marked) this.mgrRef?.refreshHunterMarks();
    this.deathMotion?.begin(this.def.radius, this.groundOffset, {
      killer: killerId, angle, heavy, force: Math.min(1.5, amount / this.maxHp),
      elite: !!this.def.elite, boss: this.isBoss, frozen: this.freezeT > 0,
    });
    if (killerId !== 'gm') Sfx.death(killerId, this.freezeT > 0, !!this.def.elite || this.isBoss);
    this.flashT = this.lungeT = this.atkAnimT = 0;
    this.freezeT = this.thawT = this.slowT = this.stunT = this.burnT = this.shockT = 0;
    this.footLeftWeight = this.footRightWeight = 0;
    if (this.flashNode) this.flashNode.active = false;
    // Gameplay death and rewards are immediate. The remaining body is cosmetic only.
    bus.emit(EVT.MOB_KILLED, this.def, killerId, { x: this.x, y: this.y, radius: this.def.radius });
  }

  tickDeath(dt: number): boolean { return this.deathMotion?.tick(dt) ?? true; }
  drawDeathGround(g: Graphics): void { this.deathMotion?.drawGround(g); }
  drawDeathAir(g: Graphics): void { this.deathMotion?.drawAir(g); }

  applySlow(ratio: number, dur: number): void {
    if (dur <= 0 || ratio <= 0 || this.dead) return;
    if (this.slowT <= 0) this.slowAmp = 0;
    this.slowT = Math.max(this.slowT, dur);
    this.slowAmp = Math.max(this.slowAmp, Math.min(0.9, ratio));
  }

  /** 精英仍可冰封；Boss 免疫。重复施加延长冰封，解冻减速只在最后一次解除时启动。 */
  applyFreeze(duration: number, postSlowRatio = 0, postSlowDuration = 0): boolean {
    if (this.dead || this.isBoss || duration <= 0) return false;
    if (this.freezeT <= 0) this.freezeAge = 0;
    this.freezeT = Math.max(this.freezeT, duration);
    this.thawT = 0;
    this.freezeSlowAmp = Math.max(this.freezeSlowAmp, postSlowRatio);
    this.freezeSlowDur = Math.max(this.freezeSlowDur, postSlowDuration);
    return true;
  }
  applyBurn(dps: number, dur: number): void {
    this.burnDps = dps;
    this.burnT = Math.max(this.burnT, dur);
  }
  heal(v: number): void {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + v);
    this.ctx.dmgNumber(this.x, this.y + this.def.radius, '+' + Math.round(v), '#7FB841');
  }
}

export class MonsterManager {
  list: Monster[] = [];
  /** 击杀统计（金币累计在 director） */
  killGold = 0;
  /** 怪物对象池：复用 Node/Graphics，杜绝刷怪波次的组件创建尖峰 */
  private pool: Monster[] = [];
  /** Corpses have no targeting/collision/wave role; a separate bounded visual list. */
  private dying: Monster[] = [];
  private deathAir: Graphics;
  private sepN = 0;
  private depthT = 0;
  private depthOrder: (Monster | DepthSprite)[] = [];
  private shadows: Graphics;
  private iceFeet: Graphics;
  private hunterMarks: Graphics;
  private disposed = false;
  private groundShadowColor = new Color(30, 24, 16, 38);
  private footShadowColor = new Color(26, 20, 13, 100);

  constructor(private field: Node, private ctx: MonsterHitCtx) {
    warmMonsterDeath();
    const node = new Node('groupContactShadows');
    node.layer = Layers.Enum.UI_2D;
    node.setParent(field);
    this.shadows = node.addComponent(Graphics);
    this.shadows.fillColor = new Color(30, 24, 16, 65);
    const ice = new Node('frozenFootCrystals'); ice.layer = Layers.Enum.UI_2D; ice.setParent(field);
    this.iceFeet = ice.addComponent(Graphics);
    const deathAir = new Node('deathFragments'); deathAir.layer = Layers.Enum.UI_2D; deathAir.setParent(field);
    this.deathAir = deathAir.addComponent(Graphics);
    const marks = new Node('hunterMarks'); marks.layer = Layers.Enum.UI_2D; marks.setParent(ctx.floatParent);
    marks.setSiblingIndex(0); this.hunterMarks = marks.addComponent(Graphics);
    setDepthSorter(field, () => this.sortDepth());
  }

  /** 难度倍率（普通 1 / 精英 1.6 / 地狱 2.4）：出怪时缩放 hp/dmg（BattleDirector 按 flow.diff 注入） */
  statMul = 1;
  /** 关卡内阶梯增长（WaveManager 逐波注入）：血量/伤害相对第 1 波的倍率 */
  rampHp = 1;
  rampDmg = 1;
  /** 首次遭遇回调（图鉴解锁）：同波次新怪种只报一次（BattleDirector 注入后解锁图鉴+横幅） */
  onFirstEncounter: ((def: MobDef) => void) | null = null;
  private seen = new Set<string>();

  spawn(def: MobDef, actual?: { hp: number; dmg: number }): boolean {
    if (this.disposed) return false;
    if (this.aliveCount >= 60) return false; // Corpses do not consume living-enemy capacity.
    def = {
      ...def,
      hp: actual ? actual.hp : Math.round(def.hp * MOB_HP_MUL * this.statMul * this.rampHp),
      dmg: actual ? actual.dmg : Math.round(def.dmg * MOB_DMG_MUL * this.statMul * this.rampDmg),
    };
    const m = this.pool.pop() || new Monster();
    m.init(def, this.field, Math.random() * 660 - 330, this.ctx, this);
    this.list.push(m);
    if (!this.seen.has(def.id)) { this.seen.add(def.id); this.onFirstEncounter?.(def); }
    return true;
  }

  /** Called only when the simulation-clock death presentation has completed. */
  recycleMob(m: Monster): void {
    if (this.disposed) return;
    const i = this.list.indexOf(m);
    if (i >= 0) this.list.splice(i, 1);
    const d = this.dying.indexOf(m);
    if (d >= 0) this.dying.splice(d, 1);
    m.node.removeFromParent();
    if (this.pool.indexOf(m) < 0) this.pool.push(m);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearDepthSorter(this.field);
    // Cocos destroys child nodes before BattleDirector.onDestroy. Only detached
    // pool entries belong to this cleanup; the scene owns actors and Graphics.
    for (const m of this.pool) if (isValid(m.node, true) && !m.node.parent) m.node.destroy();
    this.list.length = this.dying.length = this.pool.length = this.depthOrder.length = 0;
    this.seen.clear(); this.onFirstEncounter = null;
  }

  refreshHunterMarks(): void {
    if (this.disposed || !isValid(this.hunterMarks, true)) return;
    this.hunterMarks.clear();
    for (const m of this.list) m.drawHunterMark(this.hunterMarks);
  }

  get aliveCount(): number {
    let n = 0;
    for (const m of this.list) if (!m.dead) n++;
    return n;
  }

  /** 索敌：范围内最靠下（最接近防线）优先，距离相同取血少（§3.0） */
  pickTarget(hx: number, hy: number, range: number): Monster | null {
    let best: Monster | null = null;
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy > r2) continue;
      if (!best || m.y < best.y || (m.y === best.y && m.hp < best.hp)) best = m;
    }
    return best;
  }

  anyInRange(hx: number, hy: number, range: number): boolean {
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  }

  /** 全场最近存活怪（追踪弹目标死亡后切换） */
  nearest(x: number, y: number, maxDist = 900): Monster | null {
    let best: Monster | null = null;
    let bd = maxDist * maxDist;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - x, dy = m.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = m; }
    }
    return best;
  }

  /** 全场血量最高存活怪（狙击大招锁定目标） */
  highestHp(): Monster | null {
    let best: Monster | null = null;
    for (const m of this.list) {
      if (m.dead) continue;
      if (!best || m.hp > best.hp) best = m;
    }
    return best;
  }

  /** 范围内血量最高存活怪（狙击技能·穿颅射击锁定目标） */
  highestHpInRange(hx: number, hy: number, range: number): Monster | null {
    let best: Monster | null = null;
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy > r2) continue;
      if (!best || m.hp > best.hp) best = m;
    }
    return best;
  }

  /** 范围内离防线最近的存活怪（狙击技能·穿颅射击索敌——用户调整：不再选血量最高） */
  nearestToLineInRange(hx: number, hy: number, range: number): Monster | null {
    let best: Monster | null = null;
    let bestD = Infinity;
    const r2 = range * range;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - hx, dy = m.y - hy;
      if (dx * dx + dy * dy > r2) continue;
      const dLine = Math.abs(m.y - LINE_Y);
      if (dLine < bestD) { bestD = dLine; best = m; }
    }
    return best;
  }

  mobsInRadius(x: number, y: number, r: number): Monster[] {
    const out: Monster[] = [];
    const r2 = r * r;
    for (const m of this.list) {
      if (m.dead) continue;
      const dx = m.x - x, dy = m.y - y;
      if (dx * dx + dy * dy <= r2) out.push(m);
    }
    return out;
  }

  /** Count against the actual effect radius; refine each local cluster with its centroid. */
  densestArea(hx: number, hy: number, castRange: number, radius: number): { x: number; y: number } | null {
    const range2 = castRange * castRange, radius2 = radius * radius;
    let best: { x: number; y: number } | null = null, bestCount = -1, bestDistance = Infinity;
    const consider = (x: number, y: number): void => {
      if ((x - hx) ** 2 + (y - hy) ** 2 > range2) return;
      let count = 0;
      for (const m of this.list) if (!m.dead && (m.x - x) ** 2 + (m.y - y) ** 2 <= radius2) count++;
      const distance = (x - hx) ** 2 + (y - hy) ** 2;
      if (count > bestCount || count === bestCount && distance < bestDistance) {
        bestCount = count; bestDistance = distance; best = { x, y };
      }
    };
    for (const m of this.list) {
      if (m.dead || (m.x - hx) ** 2 + (m.y - hy) ** 2 > range2) continue;
      consider(m.x, m.y);
      let x = 0, y = 0, n = 0;
      for (const o of this.list) {
        if (!o.dead && (o.x - m.x) ** 2 + (o.y - m.y) ** 2 <= radius2) { x += o.x; y += o.y; n++; }
      }
      if (n > 1) consider(x / n, y / n);
    }
    return best;
  }

  healAround(src: Monster, r: number, amt: number): void {
    for (const m of this.mobsInRadius(src.x, src.y, r)) m.heal(amt);
  }

  tick(dt: number, line: { takeDamage: (d: number) => void }): void {
    if (this.disposed) return;
    this.advanceDeaths(dt);
    for (const m of this.list) m.tick(dt, line, this);
    // 自动分离（简单排斥半径，§3.1）：隔帧执行减半开销，视觉无感
    if ((this.sepN++ & 1) === 0) {
      for (let i = 0; i < this.list.length; i++) {
        const a = this.list[i];
        if (a.dead || a.state === 'attack') continue;
        for (let j = i + 1; j < this.list.length; j++) {
          const b = this.list[j];
          if (b.dead || b.state === 'attack') continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const min = a.def.radius + b.def.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2);
            const push = (min - d) * 0.5;
            const nx = dx / d, ny = dy / d;
            this.nudge(a, -nx * push, -ny * push);
            this.nudge(b, nx * push, ny * push);
          }
        }
      }
    }
    this.collectDeaths();
    this.drawPresentation(dt);
  }

  /** Settlement can finish already-dead bodies without resuming combat.
   * Paused and card-pick states never call this, so their whole battlefield freezes. */
  tickDeaths(dt: number): void {
    if (this.advanceDeaths(dt)) this.drawPresentation(dt);
  }

  private collectDeaths(): void {
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      const m = this.list[i];
      if (m.dead) this.dying.push(m);
      else this.list[w++] = m;
    }
    this.list.length = w;
    // Cosmetic pressure only: targeting, damage, loot and spawning never wait on this budget.
    while (this.dying.length > 64) this.recycleMob(this.dying[0]);
  }

  private advanceDeaths(dt: number): boolean {
    this.collectDeaths();
    const changed = this.dying.length > 0;
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const m = this.dying[i];
      if (m.tickDeath(dt)) this.recycleMob(m);
    }
    return changed;
  }

  private drawPresentation(dt: number): void {
    // 在移动与分离后同步绘制，避免 20Hz 阴影落后于角色而阶梯跳动。
    this.shadows.clear();
    this.shadows.fillColor = this.groundShadowColor;
    for (const m of this.list) {
      const r = m.def.radius;
      const footY = m.y - r * 0.82 + r * MOB_ART_HEIGHT * m.groundOffset;
      this.shadows.ellipse(m.x, footY, r * 1.02, r * 0.20);
    }
    if (this.list.length) this.shadows.fill();
    for (const m of this.list) {
      const r = m.def.radius, h = r * MOB_ART_HEIGHT;
      const footY = m.y - r * 0.82 + h * m.groundOffset;
      if (m.footLeftWeight > 0.02) {
        this.footShadowColor.a = Math.round(100 * m.footLeftWeight);
        this.shadows.fillColor = this.footShadowColor;
        this.shadows.ellipse(m.x + h * m.footLeftX, footY, r * 0.23, r * 0.07);
        this.shadows.fill();
      }
      if (m.footRightWeight > 0.02) {
        this.footShadowColor.a = Math.round(100 * m.footRightWeight);
        this.shadows.fillColor = this.footShadowColor;
        this.shadows.ellipse(m.x + h * m.footRightX, footY, r * 0.23, r * 0.07);
        this.shadows.fill();
      }
    }
    for (const m of this.dying) m.drawDeathGround(this.shadows);
    this.deathAir.clear();
    for (const m of this.dying) m.drawDeathAir(this.deathAir);
    this.depthT -= dt;
    if (this.depthT <= 0) {
      this.depthT = 0.12;
      this.sortDepth();
    }
    this.iceFeet.clear();
    for (const m of this.list) m.drawIceFeet(this.iceFeet);
    this.refreshHunterMarks();
    this.deathAir.node.setSiblingIndex(this.field.children.length - 1);
    this.iceFeet.node.setSiblingIndex(this.field.children.length - 1);
  }

  /** Falling ice is ordered by its fixed ground footprint, not its airborne
   * screen position. Nearby bodies can naturally occlude a farther needle. */
  private sortDepth(): void {
    if (this.disposed) return;
    if (!this.field.isValid) return;
    this.depthOrder.length = 0;
    for (const m of this.list) this.depthOrder.push(m);
    for (const m of this.dying) this.depthOrder.push(m);
    for (const d of depthSprites(this.field)) if (d.node.isValid && d.node.active) this.depthOrder.push(d);
    this.depthOrder.sort((a, b) => b.depthY - a.depthY);
    this.shadows.node.setSiblingIndex(0);
    this.depthOrder.forEach((item, i) => item.node.setSiblingIndex(i + 1));
    this.deathAir.node.setSiblingIndex(this.field.children.length - 1);
    this.iceFeet.node.setSiblingIndex(this.field.children.length - 1);
  }

  private nudge(m: Monster, dx: number, dy: number): void {
    if (m.immobilized) return;
    const p = m.node.position;
    let nx = Math.max(-355, Math.min(355, p.x + dx));
    let ny = Math.min(mobEntryY(m.def.radius) + 12, p.y + dy);
    if (m.state === 'hold') ny = p.y; // 停位怪不上下挤
    m.node.setPosition(nx, ny, 0);
    if (m.state === 'move') m.baseX = nx;
  }
}

/** 占位：血条仅 BOSS 显示（M0 预留钩子） */
export function drawMobHpBar(m: Monster, g: Graphics): void {
  const w = m.def.radius * 2;
  g.clear();
  g.fillColor = new Color(0, 0, 0, 140);
  g.roundRect(-w / 2, m.def.radius + 6, w, 6, 3);
  g.fill();
  g.fillColor = new Color(229, 72, 77, 255);
  g.roundRect(-w / 2, m.def.radius + 6, w * Math.max(0, m.hp / m.maxHp), 6, 3);
  g.fill();
}
