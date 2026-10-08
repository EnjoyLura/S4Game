/**
 * 怪物（§3.4 行为：松散虫群下行 + 正弦游动 + 自动分离；近战贴线攻击 / 远程停位投掷 / 萨满周期治疗）
 * 受击只闪红不掉速（用户确认：控制效果只属于特定 buff）；仅 BOSS 显示血条（M0 1-1 无 BOSS，钩子保留）
 */
import { Color, Graphics, Label, Layers, Node, Tween, UIOpacity, tween } from 'cc';
import { MOB_DMG_MUL, MOB_HP_MUL, MobDef } from '../config/Mobs';
import { LINE_Y, PAL, SPAWN_Y } from '../config/GameConfig';
import { bus, EVT } from '../core/EventBus';
import { BattleSprite } from './BattleSprite';
import { FloatEvent } from './FloatText';
import { getMobAnims, MobClip } from './MobAnim';

/** 攻击序列帧一次性时长（s）：与 lunge 0.2s 前摇错开，收招略长观感更实 */
const ATK_ANIM = 0.34;

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
  /** 感电（沃尔·雷霆）：受雷系命中后受伤放大，持续 shockT 秒 */
  shockT = 0;
  shockAmp = 0;
  /** 易伤（焰法陨石坑）：站在坑内受伤放大，出坑后短暂残留 */
  vulnT = 0;
  vulnAmp = 0;
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
  /** 冰霜蒙层：被减速/冻结时罩一层淡蓝冰壳（slowT 驱动，tick 手动开关，零 tween） */
  private frostNode: Node | null = null;
  private frostOp: UIOpacity | null = null;
  private art: BattleSprite | null = null;
  private tint = new Color();
  private lastTint = '';

  init(def: MobDef, parent: Node, x: number, ctx: MonsterHitCtx, mgr?: MonsterManager): void {
    this.def = def;
    this.ctx = ctx;
    this.mgrRef = mgr || null;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.state = 'move';
    this.dead = false;
    this.life = Math.random() * 10;
    this.atkT = def.atkInterval;
    this.healT = def.atkInterval;
    this.slowT = this.burnT = this.burnTick = this.burnDps = this.stunT = this.lungeT = this.flashT = 0;
    this.atkAnimT = 0;
    this.slowAmp = 0.2;
    this.shockT = this.shockAmp = 0;
    this.vulnT = this.vulnAmp = 0;
    this.baseX = x;
    this.node.removeFromParent();
    this.node.setPosition(x, SPAWN_Y + 40 + Math.random() * 60, 0);
    this.node.setScale(1, 1, 1);
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
    }
    this.art.node.setPosition(0, -r * 0.82, 0);
    this.art.show(this.def.id, r * 3.35);   // 显示高度≈3.35×半径（用户反馈 2.85 太瘦弱）
    getMobAnims(a => { this.anims = a; });
    Tween.stopAllByTarget(this.art.node);
    this.art.node.setScale(1, 1, 1); this.art.node.angle = 0;
    this.art.tint(Color.WHITE);
    if (this.art.loaded) this.g.enabled = false;
  }

  private tickArt(dt: number): void {
    if (!this.art?.loaded) return;
    const clip = this.anims?.get(this.def.id);
    if (clip && clip.walk.length) {
      // 序列帧模式：攻击一次性 > 步态循环（速度映射播放速率，减速同步变慢）> 待机第 0 帧
      const h = this.def.radius * 3.35;
      if (this.atkAnimT > 0 && clip.attack.length) {
        this.atkAnimT = Math.max(0, this.atkAnimT - dt);
        const p = 1 - this.atkAnimT / ATK_ANIM;
        this.art.showSeq(clip.attack, Math.min(clip.attack.length - 1, Math.floor(p * clip.attack.length)), h);
      } else if (this.state === 'move' && this.stunT <= 0) {
        const slowMul = this.slowT > 0 ? (1 - this.slowAmp) : 1;
        // 步态节奏：8 帧源片约 2.3s 一个完整步态环；speed/45 映射后小怪轻快、精英沉重
        const cps = Math.min(1.15, Math.max(0.55, this.def.speed / 45)) * slowMul;
        this.art.showSeq(clip.walk, Math.floor(this.life * cps * clip.walk.length) % clip.walk.length, h);
      } else {
        this.art.showSeq(clip.walk, 0, h);
      }
      const tint = this.flashT > 0 ? '#FF9990' : this.slowT > 0 ? '#B5E9FA' : this.shockT > 0 ? '#D8B5FF' : '#FFFFFF';
      if (tint !== this.lastTint) { this.lastTint = tint; Color.fromHEX(this.tint, tint); this.art.tint(this.tint); }
      if (this.flashNode) this.flashNode.active = false;
      if (this.frostNode) this.frostNode.active = false;
      return;
    }
    // 程序化步态兜底（序列帧缺失时保留旧行为）
    const moving = this.state === 'move' && this.stunT <= 0;
    const gait = moving ? Math.sin(this.life * (this.def.id === 'wolf_rider' ? 12 : 8)) : 0;
    this.art.node.angle = gait * 2.2;
    this.art.node.setScale(1 + gait * 0.012, 1 + Math.abs(gait) * 0.017, 1);
    const tint = this.flashT > 0 ? '#FF9990' : this.slowT > 0 ? '#B5E9FA' : this.shockT > 0 ? '#D8B5FF' : '#FFFFFF';
    if (tint !== this.lastTint) { this.lastTint = tint; Color.fromHEX(this.tint, tint); this.art.tint(this.tint); }
    // Artwork tint follows the silhouette, replacing rectangular status masks.
    if (this.flashNode) this.flashNode.active = false;
    if (this.frostNode) this.frostNode.active = false;
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
    // 冰霜蒙层：淡蓝冰壳 + 顶部三枚冰晶尖（被减速/冻结时显示）
    if (!this.frostNode) {
      this.frostNode = new Node('mobFrost');
      this.frostNode.layer = Layers.Enum.UI_2D;
      this.frostNode.setParent(this.node);
      this.frostOp = this.frostNode.addComponent(UIOpacity);
    }
    const frg = this.frostNode.getComponent(Graphics) || this.frostNode.addComponent(Graphics);
    frg.clear();
    const fz = this.hex('#8ED4F5');
    fz.a = 145;
    frg.fillColor = fz;
    frg.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.45);
    frg.fill();
    const fzb = this.hex('#E8FAFF');
    fzb.a = 190;
    frg.strokeColor = fzb;
    frg.lineWidth = 2;
    frg.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.45);
    frg.stroke();
    const fzi = this.hex('#E8FAFF');
    fzi.a = 170;
    frg.fillColor = fzi;
    for (let k = -1; k <= 1; k++) {   // 顶部冰晶尖
      const bx = k * r * 0.42;
      frg.moveTo(bx - r * 0.16, r * 0.9);
      frg.lineTo(bx + r * 0.16, r * 0.9);
      frg.lineTo(bx + k * r * 0.05, r * 0.9 + r * (k === 0 ? 0.42 : 0.3));
      frg.close(); frg.fill();
    }
    this.frostNode.active = false;
  }

  private hex(h: string): Color {
    const c = new Color();
    Color.fromHEX(c, h);
    return c;
  }

  get x(): number { return this.node.position.x; }
  get y(): number { return this.node.position.y; }

  /** 单帧推进；返回是否死亡（死亡由 manager 清理） */
  tick(dt: number, line: { takeDamage: (d: number) => void }, mgr: MonsterManager): void {
    if (this.dead) return;
    this.life += dt;
    // 受击闪红淡出（零 tween，受击高峰期零分配）
    if (this.flashT > 0 && this.flashOp) {
      this.flashT -= dt;
      this.flashOp.opacity = Math.max(0, Math.floor(255 * this.flashT / 0.12));
      if (this.flashT <= 0 && this.flashNode) this.flashNode.active = false;
    }
    // 冰霜蒙层：被减速（含冻结）期间常亮，解除即熄灭（零分配）
    if (this.frostNode && this.frostOp) {
      const frozen = this.slowT > 0;
      if (this.frostNode.active !== frozen) this.frostNode.active = frozen;
      if (frozen) this.frostOp.opacity = 255;
    }
    this.tickArt(dt);
    if (this.stunT > 0) { this.stunT -= dt; return; }
    if (this.slowT > 0) this.slowT -= dt;
    if (this.shockT > 0) this.shockT -= dt;
    if (this.vulnT > 0) this.vulnT -= dt;
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

    const mul = this.slowT > 0 ? (1 - this.slowAmp) : 1;
    if (this.state === 'move') {
      // 直线行进（用户确认：不蛇形）；横向松散由出生 x 与分离逻辑保证
      this.node.setPosition(this.baseX, this.node.position.y - this.def.speed * mul * dt, 0);
      const reach = this.def.kind === 'ranged' ? (this.def.atkRange || 0) : this.def.radius * 0.5;
      if (this.node.position.y - LINE_Y <= reach) {
        this.holdY = this.node.position.y;
        this.state = this.def.kind === 'melee' ? 'attack' : 'hold';
        this.atkT = Math.min(this.atkT, 0.4);
      }
    }
    if (this.state === 'attack' || this.state === 'hold') {
      this.atkT -= dt;
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
        this.lungeT = Math.max(0, this.lungeT - dt);
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

  takeDamage(amount: number, crit: boolean, killerId: string, ignoreRes = false, resCut = 0, impactAngle?: number, heavy = false): boolean {
    if (this.dead) return false;
    if (this.def.physRes && !ignoreRes) amount *= 1 - this.def.physRes * (1 - resCut);   // resCut=无视防御比例（英雄突破）
    if (this.shockT > 0) amount *= 1 + this.shockAmp;
    if (this.vulnT > 0) amount *= 1 + this.vulnAmp;
    this.hp -= amount;
    this.ctx.dmgNumber(this.x, this.y + this.def.radius * 2.6,
      String(Math.round(amount)), crit ? '#FF3030' : '#FFFFFF', crit, { target: this, amount, periodic: killerId === 'burn' });
    this.ctx.impact?.(this.x, this.y + this.def.radius * 0.4, killerId, heavy || crit || this.hp <= 0 && !!this.def.elite, impactAngle);
    this.flash();
    if (this.hp <= 0) {
      this.die(killerId);
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

  private die(killerId: string): void {
    this.dead = true;
    if (this.art?.loaded) {
      tween(this.art.node).to(0.18, { angle: 16 }).start();
    }
    bus.emit(EVT.MOB_KILLED, this.def, killerId);
    const op = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    tween(op)
      .to(0.18, { opacity: 60 })
      .call(() => { if (this.mgrRef) this.mgrRef.recycleMob(this); })
      .start();
  }

  applySlow(ratio: number, dur: number): void {
    this.slowT = Math.max(this.slowT, dur);
    this.slowAmp = Math.max(this.slowAmp, ratio);
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
  private sepN = 0;
  private depthT = 0;
  private depthOrder: Monster[] = [];
  private shadows: Graphics;
  private shadowT = 0;

  constructor(private field: Node, private ctx: MonsterHitCtx) {
    const node = new Node('groupContactShadows');
    node.layer = Layers.Enum.UI_2D;
    node.setParent(field);
    this.shadows = node.addComponent(Graphics);
    this.shadows.fillColor = new Color(30, 24, 16, 65);
  }

  /** 难度倍率（普通 1 / 精英 1.6 / 地狱 2.4）：出怪时缩放 hp/dmg（BattleDirector 按 flow.diff 注入） */
  statMul = 1;
  /** 关卡内阶梯增长（WaveManager 逐波注入）：血量/伤害相对第 1 波的倍率 */
  rampHp = 1;
  rampDmg = 1;
  /** 首次遭遇回调（图鉴解锁）：同波次新怪种只报一次（BattleDirector 注入后解锁图鉴+横幅） */
  onFirstEncounter: ((def: MobDef) => void) | null = null;
  private seen = new Set<string>();

  spawn(def: MobDef): boolean {
    if (this.list.length >= 60) return false; // §12.4 同屏上限
    def = {
      ...def,
      hp: Math.round(def.hp * MOB_HP_MUL * this.statMul * this.rampHp),
      dmg: Math.round(def.dmg * MOB_DMG_MUL * this.statMul * this.rampDmg),
    };
    const m = this.pool.pop() || new Monster();
    m.init(def, this.field, Math.random() * 660 - 330, this.ctx, this);
    this.list.push(m);
    if (!this.seen.has(def.id)) { this.seen.add(def.id); this.onFirstEncounter?.(def); }
    return true;
  }

  /** 死亡渐隐结束后回池（节点不移除出场景树，只摘下挂载） */
  recycleMob(m: Monster): void {
    m.node.removeFromParent();
    this.pool.push(m);
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

  healAround(src: Monster, r: number, amt: number): void {
    for (const m of this.mobsInRadius(src.x, src.y, r)) m.heal(amt);
  }

  tick(dt: number, line: { takeDamage: (d: number) => void }): void {
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
    // 就地压缩清除死亡（替代 filter，零每帧数组分配）
    let w = 0;
    for (let i = 0; i < this.list.length; i++) {
      if (!this.list[i].dead) this.list[w++] = this.list[i];
    }
    this.list.length = w;
    this.shadowT -= dt;
    if (this.shadowT <= 0) {
      this.shadowT = 1 / 20;
      this.shadows.clear();
      for (const m of this.list) {
        const r = m.def.radius;
        this.shadows.ellipse(m.x, m.y - r * 0.82, r * 0.86, r * 0.25);
      }
      if (this.list.length) this.shadows.fill();
    }
    this.depthT -= dt;
    if (this.depthT <= 0) {
      this.depthT = 0.12;
      this.depthOrder.length = 0;
      for (const m of this.list) this.depthOrder.push(m);
      this.depthOrder.sort((a, b) => (b.y - b.def.radius * 0.82) - (a.y - a.def.radius * 0.82));
      this.depthOrder.forEach((m, i) => m.node.setSiblingIndex(i + 1));
    }
  }

  private nudge(m: Monster, dx: number, dy: number): void {
    const p = m.node.position;
    let nx = Math.max(-355, Math.min(355, p.x + dx));
    let ny = Math.min(SPAWN_Y, p.y + dy);
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
