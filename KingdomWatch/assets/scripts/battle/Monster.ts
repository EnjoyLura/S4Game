/**
 * 怪物（§3.4 行为：松散虫群下行 + 正弦游动 + 自动分离；近战贴线攻击 / 远程停位投掷 / 萨满周期治疗）
 * 受击只闪红不掉速（用户确认：控制效果只属于特定 buff）；仅 BOSS 显示血条（M0 1-1 无 BOSS，钩子保留）
 */
import { Color, Graphics, isValid, Label, Layers, Node, Tween, UIOpacity } from 'cc';
import { damageKindFor, EnemyFormation, MOBS, MOB_DMG_MUL, MOB_HP_MUL, MobDef } from '../config/Mobs';
import { enemyArtRef, EnemyHealing } from '../config/ChapterContent';
import { MonsterTraits } from './MonsterTraits';
import { LINE_Y, LO, PAL } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { BattleSprite } from './BattleSprite';
import { FloatEvent } from './FloatText';
import { getMobAnims, MobClip, usesVideoWalkAnimation } from './MobAnim';
import { drawFootIce } from './FrostVFX';
import { clearDepthSorter, DepthSprite, depthSprites, setDepthSorter } from './BattleDepth';
import { MonsterDeath, warmMonsterDeath } from './MonsterDeath';

/** 攻击序列帧一次性时长（s）：与 lunge 0.2s 前摇错开，收招略长观感更实 */
const ATK_ANIM = 0.34;
/** 统一静态/序列帧显示高度，保持脚底锚点与碰撞半径不变。 */
const MOB_ART_HEIGHT = 3.85;
/** Cosmetic size only; combat radii, speed, HP and damage retain their original values. */
const MOB_ART_SCALE: Readonly<Record<string, number>> = { orc_axeman: 1.6, wolf_rider: 1.2, goblin_slinger: 1.3 };
/** Stable opaque top of existing walk clips; ignore their transparent headroom. */
const MOB_ANIM_TOP: Record<string, number> = { goblin_brute: .84, goblin_shaman: .92, wolf_rider: .92 };
/** Start the art's feet just beyond the physical top edge, then walk into view.
 * Do not use the HUD inset or shared SPAWN_Y (also used by ultimate presentations). */
function mobEntryY(radius: number): number {
  return LO.half + radius * .82 + 10;
}

export type MonsterHitCtx = {
  floatParent: Node;
  dmgNumber: (x: number, y: number, text: string, color: string, big?: boolean, event?: FloatEvent) => void;
  impact?: (x: number, y: number, hero: string, heavy: boolean, angle?: number) => void;
  combatFeedback?: (kind: string, x: number, y: number, radius: number, tx?: number, ty?: number) => void;
  damage?: (hero: string, amount: number) => void;
};

export class Monster {
  private static nextLifeId = 0;
  /** Stable for one spawn, so projectile deduplication/inspection survives node pooling. */
  lifeId = 0;
  private traits = new MonsterTraits(this);
  node = new Node('mob');
  def!: MobDef;
  hp = 0;
  maxHp = 0;
  lastDamageTaken = 0;
  state: 'move' | 'hold' | 'attack' = 'move';
  dead = false;
  baseX = 0;
  formation: EnemyFormation | null = null;
  /** Shared support lock: several healers cannot stack a heal on the same target. */
  supportHealT = 0;
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
  physicalShred = 0;
  magicShred = 0;
  private physicalShredT = 0;
  private magicShredT = 0;
  private burnOwner = 'pyro';
  /** Monotonic damage-event counter for this pooled life; reapplying burn must not replay an old event. */
  burnPulse = 0;
  private burnBurst = 0;
  private burnHealCutT = 0;
  private burnHealCut = 0;
  private overloadCd = 0;
  private knockbackT = 0;
  private knockbackLeft = 0;
  /** 眩晕硬直（预留：真正的眩晕类 buff 才会写入；受击不再写） */
  stunT = 0;
  /** 冰封与雷系眩晕独立；解冻时才启动后续减速。 */
  freezeT = 0;
  private freezeAge = 0;
  private freezeSlowAmp = 0;
  private freezeSlowDur = 0;
  private thawT = 0;
  private walkClock = 0;
  private walking = true;
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
  private bossHp: Graphics | null = null;
  private bossHpValue = -1;

  init(def: MobDef, parent: Node, x: number, ctx: MonsterHitCtx, mgr?: MonsterManager): void {
    this.deathMotion?.reset();
    this.def = def;
    this.lifeId = ++Monster.nextLifeId;
    this.traits.reset();
    this.ctx = ctx;
    this.mgrRef = mgr || null;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.lastDamageTaken = this.burnBurst = this.burnPulse = 0;
    this.burnHealCutT = this.burnHealCut = this.overloadCd = this.knockbackT = this.knockbackLeft = 0;
    this.state = 'move';
    this.dead = false;
    this.formation = null;
    this.supportHealT = 0;
    this.walking = true;
    this.life = Math.random() * 10;
    this.walkClock = this.life;
    this.groundOffset = 3 / 160;
    this.footLeftWeight = this.footRightWeight = 0;
    this.atkT = def.atkInterval;
    this.healT = def.atkInterval;
    this.slowT = this.burnT = this.burnTick = this.burnDps = this.stunT = this.lungeT = this.flashT = 0;
    this.burnOwner = 'pyro';
    this.physicalShred = this.magicShred = this.physicalShredT = this.magicShredT = 0;
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
    this.bossHpValue = -1;
    this.updateBossHp();
  }

  private buildArt(): void {
    if (!this.art) {
      this.art = new BattleSprite(this.node, enemyArtRef(this.def.id).atlas, () => { this.g.enabled = false; });
      this.deathMotion = new MonsterDeath(this.node, this.art);
    }
    this.art.node.setPosition(0, this.artBaseY, 0);
    this.art.setAtlas(enemyArtRef(this.def.id).atlas);
    this.art.show(this.def.id, this.artHeight);
    this.anims = null;
    const id = this.def.id;
    if (!this.def.homeChapter || usesVideoWalkAnimation(id)) getMobAnims(a => { if (this.node.isValid && this.def.id === id && !this.dead) this.anims = a; }, id);
    Tween.stopAllByTarget(this.art.node);
    this.art.node.setScale(1, 1, 1); this.art.node.angle = 0;
    this.art.cold(null);
    this.art.tint(Color.WHITE);
    if (this.art.loaded) this.g.enabled = false;
  }

  private tickArt(dt: number): void {
    this.updateBossHp();
    if (!this.art?.loaded) return;
    if (this.def.homeChapter && !usesVideoWalkAnimation(this.def.id)) this.art.show(this.def.id + (this.traits.enraged && this.def.boss ? '_phase' : ''), this.artHeight);
    if (this.immobilized) {
      // Hold the current walk/attack cel instead of snapping to idle or continuing a frozen attack.
      this.syncArtTint();
      if (this.flashNode) this.flashNode.active = false;
      return;
    }
    const clip = this.anims?.get(this.def.id);
    if (clip && clip.walk.length) {
      // 序列帧模式：攻击一次性 > 步态循环（速度映射播放速率，减速同步变慢）> 待机第 0 帧
      const h = this.artHeight;
      if (this.atkAnimT > 0 && clip.attack.length) {
        this.footLeftWeight = this.footRightWeight = 0;
        this.atkAnimT = Math.max(0, this.atkAnimT - dt);
        const p = 1 - this.atkAnimT / ATK_ANIM;
        const t = Math.min(clip.attack.length - 1, p * clip.attack.length);
        const i = Math.floor(t);
        this.art.showSeq(clip.attack, i, i >= clip.attack.length - 1 ? 0 : t - i, h);
      } else if (this.def.airborne || this.state === 'move' && this.walking) {
        // 步态节奏：以源视频步态环真实时长为基准实时播放（相位连贯不踉跄），按移速微调档位，减速同步变慢
        const tempo = Math.min(1.25, Math.max(0.75, this.def.speed / clip.referenceSpeed));
        const cps = (clip.playbackRate / clip.loopDur) * tempo;
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
    const moving = this.state === 'move' && this.walking;
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
    const y = this.artBaseY;
    if (this.art && this.art.node.position.y !== y) this.art.node.setPosition(0, y, 0);
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
  get artScale(): number { return MOB_ART_SCALE[this.def.id] || 1; }
  get artHeight(): number { return this.def.radius * MOB_ART_HEIGHT * this.artScale; }
  /** Enlarge around the fixed ground plane, so feet never jump upward with the canvas. */
  get artBaseY(): number { return -this.def.radius * .82 - (this.artHeight - this.def.radius * MOB_ART_HEIGHT) * this.groundOffset; }
  get groundY(): number { return this.y - this.def.radius * .82 + this.def.radius * MOB_ART_HEIGHT * this.groundOffset; }
  get depthY(): number { return this.y - this.def.radius * 0.82; }
  /** Local top for role icons, using the same foot offset and height as the art. */
  get headTop(): number {
    const clip = this.anims?.get(this.def.id);
    const ratio = clip?.walk.length ? clip.topRatio ?? (MOB_ANIM_TOP[this.def.id] || 1) : 1;
    return this.artBaseY + this.artHeight * ratio;
  }
  get isBoss(): boolean { return !!this.def.boss || this.def.id === 'goblin_king'; }
  get immobilized(): boolean { return this.freezeT > 0 || this.stunT > 0 || this.knockbackT > 0; }
  /** Read-only view of this living instance, rather than its original codex stats. */
  inspect(): { physical: number; magic: number; armorBroken: boolean; wardBroken: boolean; states: string[] } {
    const states = this.traits.activeStates;
    if (this.physicalShredT > 0) states.push('破甲' + Math.round(this.physicalShred * 100) + '%');
    if (this.magicShredT > 0) states.push('法抗削弱' + Math.round(this.magicShred * 100) + '%');
    if (this.freezeT > 0) states.push('冰封');
    if (this.stunT > 0) states.push('眩晕');
    if (this.burnT > 0) states.push(this.burnHealCutT > 0 ? '灼烧·治疗降低50%' : '灼烧');
    if (this.slowT > 0) states.push('减速' + Math.round(this.slowAmp * 100) + '%');
    if (this.shockT > 0) states.push('感电');
    if (this.vulnT > 0) states.push('易伤' + Math.round(this.vulnAmp * 100) + '%');
    if (this.hunterMarkT > 0) states.push('猎杀标记');
    if (!states.length) states.push(this.state === 'move' ? '行进中' : this.def.kind === 'melee' ? '攻击防线' : this.def.kind === 'heal' ? '治疗待命' : '远程攻击');
    return { ...this.traits.defenseInfo, states };
  }

  drawIceFeet(g: Graphics): void {
    if (this.freezeT <= 0 && this.thawT <= 0) return;
    const r = this.def.radius;
    drawFootIce(g, this.x, this.groundY, r * this.artScale, this.freezeAge, this.freezeT, this.thawT);
  }

  /** 单帧推进；返回是否死亡（死亡由 manager 清理） */
  tick(dt: number, line: { takeDamage: (d: number) => void }, mgr: MonsterManager): void {
    if (this.dead) return;
    this.physicalShredT = Math.max(0, this.physicalShredT - dt);
    this.magicShredT = Math.max(0, this.magicShredT - dt);
    if (!this.physicalShredT) this.physicalShred = 0;
    if (!this.magicShredT) this.magicShred = 0;
    this.deathMotion?.prepare();
    this.life += dt;
    this.supportHealT = Math.max(0, this.supportHealT - dt);
    this.overloadCd = Math.max(0, this.overloadCd - dt);
    this.burnHealCutT = Math.max(0, this.burnHealCutT - dt);
    if (this.burnHealCutT <= 0) this.burnHealCut = 0;
    const frozenLeft = this.freezeT;
    const motionDt = Math.max(0, dt - Math.max(this.freezeT, this.stunT, this.knockbackT));
    if (this.knockbackT > 0) {
      const step = this.knockbackLeft * Math.min(1, dt / this.knockbackT);
      this.node.setPosition(this.baseX, Math.min(mobEntryY(this.def.radius) + 12, this.y + step), 0);
      this.knockbackLeft = Math.max(0, this.knockbackLeft - step);
      this.knockbackT = Math.max(0, this.knockbackT - dt);
    }
    this.thawT = Math.max(0, this.thawT - dt);
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    if (this.slowT <= 0) this.slowAmp = 0.2;
    if (this.shockT > 0) this.shockT = Math.max(0, this.shockT - dt);
    if (this.shockT <= 0) this.shockAmp = 0;
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
    this.traits.tick(dt, motionDt, line, mgr);
    const slow = this.slowT > 0 ? 1 - this.slowAmp : 1;
    const travel = this.state === 'move'
      ? mgr.escortTravel(this, this.def.speed * slow * this.traits.speedMultiplier() * motionDt) : 0;
    this.walking = travel > 0;
    // Hovering video creatures keep beating their wings while attacking; control still stops motionDt.
    this.walkClock += this.def.airborne && usesVideoWalkAnimation(this.def.id)
      ? slow * motionDt : travel / Math.max(1, this.def.speed);
    this.tickArt(motionDt);
    // 点燃 DoT：每 0.5s 聚合一条（§3.11）
    if (this.burnT > 0) {
      this.burnTick += Math.min(dt, this.burnT);
      if (this.burnTick + 1e-8 >= 0.5) {
        this.burnTick = Math.max(0, this.burnTick - 0.5);
        this.takeDamage(this.burnDps * 0.5, false, 'burn');
        if (this.lastDamageTaken > 0) {
          this.burnPulse++; // A status flame represents an actual HP loss, including resisted damage.
          this.ctx.damage?.(this.burnOwner, this.lastDamageTaken);
        }
      }
      if (this.dead) return;
      this.burnT = Math.max(0, this.burnT - dt);
      if (this.burnT <= 0) this.burnDps = this.burnBurst = this.burnTick = 0;
    }

    // Control stops movement and attacks, while burn damage and other status timers continue.
    if (motionDt <= 0) return;

    if (this.state === 'move') {
      // 直线行进（用户确认：不蛇形）；横向松散由出生 x 与分离逻辑保证
      this.node.setPosition(this.baseX, this.node.position.y - travel, 0);
      const reach = this.def.kind === 'ranged' ? (this.def.atkRange || 0) : this.def.radius * 0.5;
      if (this.node.position.y - LINE_Y <= reach) {
        this.holdY = this.node.position.y;
        this.traits.onReachLine();
        this.state = this.def.kind === 'melee' ? 'attack' : 'hold';
        this.atkT = Math.min(this.atkT, 0.4);
      }
    }
    if (this.state === 'attack' || this.state === 'hold') {
      this.atkT -= motionDt;
      if (this.atkT <= 0) {
        this.atkT = this.def.atkInterval;
        if (this.def.kind !== 'heal') {
          this.traits.attack(line, mgr);
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

  strike(line: { takeDamage: (d: number) => void }, mgr: MonsterManager): void {
    if (this.dead || this.immobilized) return;
    const damage = this.def.dmg * this.traits.damageMultiplier() * mgr.attackMultiplier(this);
    const poison = this.def.venom;
    line.takeDamage(damage * (poison ? 1 - poison.portion : 1));
    if (poison) mgr.addLinePoison(damage * poison.portion, poison.duration);
    this.lunge();
    bus.emit(EVT.COMIC_POP, this.x, this.y + this.def.radius, this.def.kind === 'ranged' ? 'stoneHit' : 'meleeHit');
  }

  animateHeal(): void { this.atkAnimT = ATK_ANIM; }

  feedback(kind: string): void {
    this.ctx.combatFeedback?.(kind, this.x, this.y + (kind === 'rush' ? 0 : this.def.radius * 1.2), this.def.radius);
    if (kind === 'armorBreak') this.ctx.dmgNumber(this.x, this.y + this.def.radius * 3, '破甲', '#D4ECF4', true);
    else if (kind === 'wardBreak') this.ctx.dmgNumber(this.x, this.y + this.def.radius * 3, '破盾', '#D5B5FF', true);
    else if (kind === 'interrupt') this.ctx.dmgNumber(this.x, this.y + this.def.radius * 3, '打断', '#FFE29A');
  }

  private lunge(): void {
    this.lungeT = 0.2;
    this.atkAnimT = ATK_ANIM;
  }

  /** 受击；crit 用于飘字样式；ignoreRes=无视物抗/法抗（狙击大招等）；返回是否击杀
   *  受击只掉血+闪红，不硬直/减速/击退——控制只来自特定 buff（applySlow 等后续技能效果） */
  /** 感电：同类状态取高并刷新；过期强度不能被后续较弱的感电继承。 */
  applyShock(amp: number, dur: number): void {
    if (this.dead || amp <= 0 || dur <= 0) return;
    this.shockAmp = this.shockT > 0 ? Math.max(this.shockAmp, amp) : amp;
    this.shockT = Math.max(this.shockT, dur);
  }

  /** Only chain lightning can request this roll, before applying its new shock. */
  tryOverload(chance: number): boolean {
    if (this.dead || this.isBoss || this.shockT <= 0 || this.overloadCd > 0 || Math.random() >= chance) return false;
    this.stunT = Math.max(this.stunT, .4);
    this.overloadCd = 3;
    return true;
  }

  /** A card-owned displacement; ordinary hits still cause no movement or control. */
  applyKnockback(distance: number): boolean {
    if (this.dead || this.isBoss || distance <= 0) return false;
    const travel = Math.min(distance * (this.def.elite ? .4 : 1), mobEntryY(this.def.radius) + 12 - this.y);
    if (travel <= 0) return false;
    this.knockbackLeft = Math.max(this.knockbackLeft, travel);
    this.knockbackT = .18;
    this.lungeT = this.atkAnimT = 0;
    this.state = 'move';
    return true;
  }

  /** 易伤：坑内每帧刷新，出坑残留 dur */
  applyVuln(amp: number, dur: number): void {
    if (this.dead || amp <= 0 || dur <= 0) return;
    this.vulnAmp = this.vulnT > 0 ? Math.max(this.vulnAmp, amp) : amp;
    this.vulnT = Math.max(this.vulnT, dur);
  }

  private updateBossHp(): void {
    if (!this.isBoss || this.dead) {
      if (this.bossHp) this.bossHp.node.active = false;
      return;
    }
    if (!this.bossHp) {
      const n = new Node('bossHp'); n.layer = Layers.Enum.UI_2D; n.setParent(this.node);
      this.bossHp = n.addComponent(Graphics);
    }
    this.bossHp.node.active = true;
    if (this.bossHpValue !== this.hp) {
      this.bossHpValue = this.hp;
      drawMobHpBar(this, this.bossHp);
    }
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
    const x = this.x, y = this.y + this.artBaseY + this.artHeight + 19;
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
    this.lastDamageTaken = 0;
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return false;
    const raw = amount, kind = damageKindFor(killerId);
    if (!ignoreRes && kind !== 'true') {
      const resistance = kind === 'physical' ? this.traits.physicalResistance : this.traits.magicResistance;
      amount *= 1 - Math.max(0, Math.min(.95, resistance)) * (1 - Math.max(0, Math.min(1, resCut)));
    }
    if (this.shockT > 0) amount *= 1 + this.shockAmp;
    const vulnerability = Math.max(this.vulnT > 0 ? this.vulnAmp : 0, this.hunterMarkT > 0 ? this.hunterMarkAmp : 0);
    if (vulnerability > 0) amount *= 1 + vulnerability;
    amount = this.traits.incomingDamage(amount, killerId);
    this.lastDamageTaken = Math.min(this.hp, amount);
    this.hp -= amount;
    const visualSource = killerId === 'pyro_burst' ? 'pyro' : killerId;
    if (amount > 0 && killerId !== 'burn' && killerId !== 'gm') Sfx.impact(visualSource, heavy || crit);
    this.ctx.dmgNumber(this.x, this.y + this.def.radius * 2.6,
      String(Math.round(amount)), crit ? '#FF3030' : '#FFFFFF', crit, { target: this, amount, periodic: killerId === 'burn' });
    this.ctx.impact?.(this.x, this.y + this.def.radius * 0.4, visualSource, heavy || crit || this.hp <= 0 && !!this.def.elite, impactAngle);
    if (this.hp > 0) this.traits.recordHit(raw, kind);
    this.flash();
    if (this.hp <= 0) {
      if (this.traits.onLethal(killerId)) return false;
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
    if (this.burnT > 0 && this.burnBurst > 0 && killerId !== 'pyro_burst' && killerId !== 'gm') {
      this.mgrRef?.queueBurnBurst(this.x, this.y + this.def.radius * .4, this.burnBurst);
    }
    this.traits.onDie(killerId, this.mgrRef);
    if (this.bossHp) this.bossHp.node.active = false;
    const marked = this.hunterMarkVisual;
    this.hunterMarkT = this.hunterMarkAmp = this.hunterMarkAge = 0;
    this.hunterMarkVisual = false;
    if (marked) this.mgrRef?.refreshHunterMarks();
    this.deathMotion?.begin(this.def.radius, this.groundOffset, {
      killer: killerId === 'pyro_burst' ? 'pyro' : killerId, angle, heavy, force: Math.min(1.5, amount / this.maxHp),
      elite: !!this.def.elite, boss: this.isBoss, frozen: this.freezeT > 0,
    }, this.artHeight);
    if (killerId !== 'gm') Sfx.death(killerId === 'pyro_burst' ? 'pyro' : killerId, this.freezeT > 0, !!this.def.elite || this.isBoss);
    this.flashT = this.lungeT = this.atkAnimT = 0;
    this.freezeT = this.thawT = this.slowT = this.stunT = this.burnT = this.shockT = 0;
    this.burnHealCutT = this.burnHealCut = this.overloadCd = this.knockbackT = this.knockbackLeft = 0;
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
  applyBurn(dps: number, dur: number, burst = 0, healCut = 0, owner = 'pyro'): void {
    if (this.dead || !Number.isFinite(dps) || !Number.isFinite(dur) || dps <= 0 || dur <= 0) return;
    if (this.burnT <= 0 || dps > this.burnDps) this.burnOwner = owner;
    if (this.burnT <= 0) this.burnTick = 0;
    this.burnDps = this.burnT > 0 ? Math.max(this.burnDps, dps) : dps;
    this.burnBurst = this.burnT > 0 ? Math.max(this.burnBurst, burst) : burst;
    this.burnT = Math.max(this.burnT, dur);
    // An unrelated source extending burn must not extend the pyro-owned healing penalty.
    if (healCut > 0) {
      this.burnHealCut = this.burnHealCutT > 0 ? Math.max(this.burnHealCut, healCut) : healCut;
      this.burnHealCutT = Math.max(this.burnHealCutT, dur);
    }
  }
  applyResistanceShred(kind: 'physical' | 'magic', amount: number, seconds: number): void {
    if (this.dead || !Number.isFinite(amount + seconds) || amount <= 0 || seconds <= 0) return;
    if (kind === 'physical') {
      this.physicalShred = Math.max(this.physicalShred, Math.min(.95, amount));
      this.physicalShredT = Math.max(this.physicalShredT, seconds);
    } else {
      this.magicShred = Math.max(this.magicShred, Math.min(.95, amount));
      this.magicShredT = Math.max(this.magicShredT, seconds);
    }
  }
  heal(v: number): number {
    if (this.dead) return 0;
    const healed = Math.max(0, Math.min(v * (1 - Math.min(1, this.burnHealCutT > 0 ? this.burnHealCut : 0)), this.maxHp - this.hp));
    if (healed <= 0) return 0;
    this.hp += healed;
    this.ctx.dmgNumber(this.x, this.y + this.def.radius, '+' + Math.round(healed), '#7FB841');
    return healed;
  }
}

export class MonsterManager {
  private burnBursts: { x: number; y: number; damage: number }[] = [];
  queueBurnBurst(x: number, y: number, damage: number): void {
    if (!this.disposed && this.burnBursts.length < 32) this.burnBursts.push({ x, y, damage });
  }
  private drainBurnBursts(): void {
    // No recursive death explosions; separate deaths from area damage with a bounded queue.
    for (let i = 0; i < 8 && this.burnBursts.length; i++) {
      const burst = this.burnBursts.shift()!;
      this.ctx.combatFeedback?.('burnBurst', burst.x, burst.y, 100);
      for (const m of this.mobsInRadius(burst.x, burst.y, 100)) {
        m.takeDamage(burst.damage, false, 'pyro_burst', false, 0, Math.atan2(m.y - burst.y, m.x - burst.x));
        this.ctx.damage?.('pyro', m.lastDamageTaken);
      }
    }
  }
  private linePoisons: { remaining: number; rate: number }[] = [];
  private poisonClock = 0;
  private pendingPoisonDamage = 0;

  addLinePoison(total: number, duration: number): void {
    if (total <= 0 || duration <= 0) return;
    if (this.linePoisons.length < 24) this.linePoisons.push({ remaining: duration, rate: total / duration });
    else {
      const p = this.linePoisons[0], remainingTotal = p.rate * p.remaining + total;
      p.remaining = Math.max(p.remaining, duration); p.rate = remainingTotal / p.remaining;
    }
  }

  attackMultiplier(source: Monster): number {
    let multiplier = 1;
    for (const ally of this.list) {
      const aura = ally.def.aura;
      if (!ally.dead && aura && Math.hypot(ally.x - source.x, ally.y - source.y) <= aura.radius) multiplier = Math.max(multiplier, aura.attackMul);
    }
    return multiplier;
  }

  spawnOffspring(source: Monster, id: string, count: number): number {
    const base = MOBS[id], parentBase = MOBS[source.def.id];
    if (!base || !parentBase || this.disposed) return 0;
    let made = 0;
    for (let i = 0; i < Math.min(4, count); i++) {
      const child: MobDef = { ...base, offspring: true, exp: 0, gold: 0, charge: 0,
        summon: undefined, split: undefined, revive: undefined };
      if (!this.spawn(child, { hp: Math.max(1, Math.round(base.hp * source.maxHp / parentBase.hp)),
        dmg: Math.round(base.dmg * (parentBase.dmg > 0 ? source.def.dmg / parentBase.dmg : source.maxHp / parentBase.hp * MOB_DMG_MUL / MOB_HP_MUL)) })) break;
      const mob = this.list[this.list.length - 1];
      mob.baseX = Math.max(-330, Math.min(330, source.x + (i % 2 ? 1 : -1) * (24 + 14 * i)));
      mob.node.setPosition(mob.baseX, Math.max(LINE_Y + base.radius + 24, source.y + (i % 2) * 18), 0);
      made++;
    }
    return made;
  }
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

  spawn(def: MobDef, actual?: { hp: number; dmg: number }, formation?: EnemyFormation): boolean {
    if (this.disposed) return false;
    if (this.aliveCount >= 60) return false; // Corpses do not consume living-enemy capacity.
    def = {
      ...def,
      hp: actual ? actual.hp : Math.round(def.hp * MOB_HP_MUL * this.statMul * this.rampHp),
      dmg: actual ? actual.dmg : Math.round(def.dmg * MOB_DMG_MUL * this.statMul * this.rampDmg),
      healAmount: def.homeChapter && def.healAmount ? Math.round(def.healAmount * (actual ? actual.hp / def.hp : MOB_HP_MUL * this.statMul * this.rampHp)) : def.healAmount,
    };
    const m = this.pool.pop() || new Monster();
    const x = def.boss ? 0 : formation ? Math.max(-330, Math.min(330, formation.lane + Math.random() * 36 - 18)) : Math.random() * 660 - 330;
    m.init(def, this.field, x, this.ctx, this);
    if (formation?.id) {
      const groups = new Set(this.list.filter(o => !o.dead && o.formation?.id).map(o => o.formation!.id));
      const front = this.list.find(o => !o.dead && o.formation?.id === formation.id && o.formation.role === 'front');
      if ((formation.role !== 'support' || front) && (groups.has(formation.id) || groups.size < 2)) m.formation = { ...formation };
    }
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
    this.linePoisons.length = 0;
    this.burnBursts.length = 0;
    this.poisonClock = this.pendingPoisonDamage = 0;
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

  /** A rear unit waits for its own living front; it never teleports or walks backwards. */
  escortTravel(src: Monster, travel: number): number {
    if (src.formation?.role !== 'support') return travel;
    const front = this.list.find(m => !m.dead && m.formation?.id === src.formation!.id && m.formation.role === 'front');
    if (!front) { src.formation = null; return travel; }
    return Math.max(0, Math.min(travel, src.y - front.y - (src.formation.gap ?? 140)));
  }

  hasHealingTarget(src: Monster, radius: number): boolean {
    return this.list.some(m => !m.dead && m !== src && m.def.kind !== 'heal' && m.hp < m.maxHp &&
      m.supportHealT <= 0 && (m.x - src.x) ** 2 + (m.y - src.y) ** 2 <= radius * radius);
  }

  healAround(src: Monster, spec: Readonly<EnemyHealing>): number {
    const wounded = this.mobsInRadius(src.x, src.y, spec.radius)
      .filter(m => m !== src && m.def.kind !== 'heal' && m.hp < m.maxHp && m.supportHealT <= 0);
    const front = src.formation?.id ? this.list.find(m => !m.dead && m.formation?.id === src.formation!.id && m.formation.role === 'front') : undefined;
    wounded.sort((a, b) => a === front ? -1 : b === front ? 1 : a.hp / a.maxHp - b.hp / b.maxHp);
    let count = 0;
    for (const m of wounded.slice(0, Math.min(3, Math.max(1, spec.targets)))) {
      if (m.heal(Math.min(m.maxHp * spec.fraction, src.maxHp * spec.capRatio)) <= 0) continue;
      m.supportHealT = 4;
      count++;
      this.ctx.combatFeedback?.('heal', src.x, src.y + src.def.radius, m.def.radius, m.x, m.y + m.def.radius);
    }
    return count;
  }

  tick(dt: number, line: { takeDamage: (d: number) => void }): void {
    if (this.disposed) return;
    let poisonDamage = 0;
    let poisons = 0;
    for (const p of this.linePoisons) {
      poisonDamage += p.rate * Math.min(dt, p.remaining); p.remaining = Math.max(0, p.remaining - dt);
      if (p.remaining > 0) this.linePoisons[poisons++] = p;
    }
    this.linePoisons.length = poisons;
    this.pendingPoisonDamage += poisonDamage;
    if (this.pendingPoisonDamage > 0) {
      this.poisonClock += dt;
      if (this.poisonClock >= .5 || !this.linePoisons.length) {
        line.takeDamage(this.pendingPoisonDamage); this.pendingPoisonDamage = this.poisonClock = 0;
      }
    }
    this.advanceDeaths(dt);
    for (const m of this.list) m.tick(dt, line, this);
    this.drainBurnBursts();
    // 自动分离（简单排斥半径，§3.1）：隔帧执行减半开销，视觉无感
    if ((this.sepN++ & 1) === 0) {
      for (let i = 0; i < this.list.length; i++) {
        const a = this.list[i];
        if (a.dead || a.state === 'attack' || a.def.airborne) continue;
        for (let j = i + 1; j < this.list.length; j++) {
          const b = this.list[j];
          if (b.dead || b.state === 'attack' || b.def.airborne) continue;
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
      this.shadows.ellipse(m.x, m.groundY, r * m.artScale * 1.02, r * m.artScale * 0.20);
    }
    if (this.list.length) this.shadows.fill();
    for (const m of this.list) {
      const r = m.def.radius * m.artScale, h = m.artHeight;
      const footY = m.groundY;
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
    this.iceFeet.node.setSiblingIndex(this.field.children.length - 1);
    this.deathAir.node.setSiblingIndex(this.field.children.length - 2);
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
    this.iceFeet.node.setSiblingIndex(this.field.children.length - 1);
    this.deathAir.node.setSiblingIndex(this.field.children.length - 2);
  }

  private nudge(m: Monster, dx: number, dy: number): void {
    if (m.immobilized) return;
    const p = m.node.position;
    const edge = m.isBoss ? 375 - m.def.radius * MOB_ART_HEIGHT / 2 - 12 : 355;
    let nx = Math.max(-edge, Math.min(edge, p.x + dx));
    let ny = Math.min(mobEntryY(m.def.radius) + 12, p.y + dy);
    if (m.formation?.id) {
      nx = Math.max(-edge, Math.min(edge, Math.max(m.formation.lane - 32, Math.min(m.formation.lane + 32, nx))));
      if (m.formation.role === 'support') {
        const front = this.list.find(o => !o.dead && o.formation?.id === m.formation!.id && o.formation.role === 'front');
        if (front) ny = Math.max(ny, Math.min(p.y, front.y + (m.formation.gap ?? 140)));
      }
    }
    if (m.state === 'hold') ny = p.y; // 停位怪不上下挤
    m.node.setPosition(nx, ny, 0);
    if (m.state === 'move') m.baseX = nx;
  }
}

/** Boss-only health bar above the full character art, including a pooled king. */
export function drawMobHpBar(m: Monster, g: Graphics): void {
  const w = m.def.radius * 2.8;
  const y = m.artBaseY + m.artHeight + 8;
  g.clear();
  g.fillColor = new Color(0, 0, 0, 140);
  g.roundRect(-w / 2, y, w, 8, 4);
  g.fill();
  g.fillColor = new Color(229, 72, 77, 255);
  const hpWidth = w * Math.max(0, Math.min(1, m.hp / m.maxHp));
  if (hpWidth > 0) { g.roundRect(-w / 2, y, hpWidth, 8, Math.min(4, hpWidth / 2)); g.fill(); }
}
